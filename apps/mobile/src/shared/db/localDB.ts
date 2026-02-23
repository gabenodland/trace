/**
 * Local SQLite database for mobile app
 * Provides offline-first storage with background sync to Supabase
 *
 * SIMPLIFIED VERSION - No migrations, single createTables schema
 * Uses the new normalized location model with locations table
 */

import * as SQLite from 'expo-sqlite';
import { Entry, CreateEntryInput, LocationEntity, CreateLocationInput, Attachment } from '@trace/core';
import { createScopedLogger, LogScopes } from '../utils/logger';

const log = createScopedLogger(LogScopes.Database);

class LocalDatabase {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private currentUserId: string | null = null;

  /**
   * Initialize database and create tables
   * Safe to call multiple times - will only initialize once
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initInternal();
    return this.initPromise;
  }

  private async _initInternal(): Promise<void> {
    try {
      // Open database (creates if doesn't exist)
      // Single database stores data for ALL users, filtered by user_id
      this.db = await SQLite.openDatabaseAsync('trace.db');

      // Enable WAL mode — allows concurrent reads + serialized writes instead of full lock
      const walResult = await this.db.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode = WAL');
      if (walResult?.journal_mode !== 'wal') {
        log.warn('Failed to enable WAL mode', { result: walResult });
      }
      // Retry writes for up to 3s instead of failing immediately on lock contention
      await this.db.execAsync('PRAGMA busy_timeout = 3000');
      // NORMAL sync is safe with WAL — only risks last transaction on OS crash, recoverable from server
      await this.db.execAsync('PRAGMA synchronous = NORMAL');

      // Log database opened
      log.info('SQLite database opened', { dbName: 'trace.db' });

      // Create tables (without indexes that depend on migrated columns)
      await this.createTables();

      // Run migrations for existing databases (adds missing columns)
      await this.runMigrations();

      // Create indexes (after migrations have added any missing columns)
      await this.createIndexes();

      log.info('SQLite tables and indexes created');
    } catch (error) {
      log.error('Failed to initialize database', error);
      throw error;
    }
  }

  /**
   * Run migrations to update existing database schemas
   * Uses ALTER TABLE ADD COLUMN for columns that may not exist
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Migration: Add location_id column to entries table if it doesn't exist
    try {
      // Check if location_id column exists in entries table
      const result = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('entries') WHERE name = 'location_id'`
      );

      if (!result) {
        log.info('Running migration: Adding location_id to entries table');
        await this.db.execAsync(`ALTER TABLE entries ADD COLUMN location_id TEXT`);
        // Create index for the new column
        await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_entries_location_id ON entries(location_id)`);
        log.info('Migration complete: location_id added to entries');
      }
    } catch (error) {
      log.error('Migration error (location_id)', error);
      // Don't throw - the column might already exist or there could be other reasons
    }

    // Migration: Add priority, rating, is_pinned columns to entries table
    try {
      const priorityCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('entries') WHERE name = 'priority'`
      );

      if (!priorityCheck) {
        log.info('Running migration: Adding priority, rating, is_pinned to entries table');
        await this.db.execAsync(`
          ALTER TABLE entries ADD COLUMN priority INTEGER DEFAULT 0;
          ALTER TABLE entries ADD COLUMN rating REAL DEFAULT 0.00;
          ALTER TABLE entries ADD COLUMN is_pinned INTEGER DEFAULT 0;
        `);
        log.info('Migration complete: priority, rating, is_pinned added to entries');
      }
    } catch (error) {
      log.error('Migration error (priority/rating/is_pinned)', error);
    }

    // Migration: Add is_archived column to entries table
    try {
      const archivedCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('entries') WHERE name = 'is_archived'`
      );

      if (!archivedCheck) {
        log.info('Running migration: Adding is_archived to entries table');
        await this.db.execAsync(`
          ALTER TABLE entries ADD COLUMN is_archived INTEGER DEFAULT 0;
        `);
        await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_entries_is_archived ON entries(is_archived)`);
        log.info('Migration complete: is_archived added to entries');
      }
    } catch (error) {
      log.error('Migration error (is_archived)', error);
    }

    // Migration: Add locations table if it doesn't exist (should be handled by CREATE TABLE IF NOT EXISTS, but just in case)
    try {
      const result = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='locations'`
      );

      if (!result) {
        log.info('Running migration: Creating locations table');
        await this.db.execAsync(`
          CREATE TABLE IF NOT EXISTS locations (
            location_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            latitude REAL NOT NULL,
            longitude REAL NOT NULL,
            source TEXT,
            address TEXT,
            neighborhood TEXT,
            postal_code TEXT,
            city TEXT,
            subdivision TEXT,
            region TEXT,
            country TEXT,
            location_radius REAL,
            mapbox_place_id TEXT,
            foursquare_fsq_id TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            deleted_at INTEGER,
            synced INTEGER DEFAULT 0,
            sync_action TEXT
          );

          CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);
          CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
          CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
          CREATE INDEX IF NOT EXISTS idx_locations_synced ON locations(synced);
        `);
        log.info('Migration complete: locations table created');
      }
    } catch (error) {
      log.error('Migration error (locations table)', error);
    }

    // Migration: Update status CHECK constraint to include 'in_progress'
    // SQLite doesn't allow altering CHECK constraints, so we need to recreate the table
    try {
      // Check if migration is needed by looking for a marker in sync_metadata
      const migrationCheck = await this.db.getFirstAsync<{ value: string }>(
        `SELECT value FROM sync_metadata WHERE key = 'migration_status_in_progress_done'`
      );

      if (!migrationCheck) {
        log.info('Running migration: Updating entries status constraint to include in_progress');

        // Get existing column names from the entries table
        const columns = await this.db.getAllAsync<{ name: string }>(
          `SELECT name FROM pragma_table_info('entries')`
        );
        const columnNames = columns.map(c => c.name);
        log.debug('Found columns in entries table', { count: columnNames.length });

        // Define the new table columns (matching current schema)
        const newTableColumns = `
          entry_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT,
          content TEXT NOT NULL,
          tags TEXT,
          mentions TEXT,
          stream_id TEXT,
          entry_date INTEGER,
          entry_latitude REAL,
          entry_longitude REAL,
          location_radius REAL,
          location_id TEXT,
          status TEXT CHECK (status IN ('none', 'new', 'todo', 'in_progress', 'in_review', 'waiting', 'on_hold', 'done', 'closed', 'cancelled')) DEFAULT 'none',
          due_date INTEGER,
          completed_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER,
          priority INTEGER DEFAULT 0,
          rating REAL DEFAULT 0.00,
          is_pinned INTEGER DEFAULT 0,
          is_archived INTEGER DEFAULT 0,
          local_only INTEGER DEFAULT 0,
          synced INTEGER DEFAULT 0,
          sync_action TEXT,
          sync_error TEXT,
          sync_retry_count INTEGER DEFAULT 0,
          sync_last_attempt INTEGER,
          version INTEGER DEFAULT 1,
          base_version INTEGER DEFAULT 1,
          conflict_status TEXT,
          conflict_backup TEXT,
          last_edited_by TEXT,
          last_edited_device TEXT
        `;

        // Build explicit column list for INSERT (only columns that exist in both old and new tables)
        const newTableColumnNames = [
          'entry_id', 'user_id', 'title', 'content', 'tags', 'mentions', 'stream_id',
          'entry_date', 'entry_latitude', 'entry_longitude', 'location_radius', 'location_id',
          'status', 'due_date', 'completed_at', 'created_at', 'updated_at', 'deleted_at',
          'priority', 'rating', 'is_pinned', 'is_archived', 'local_only', 'synced', 'sync_action',
          'sync_error', 'sync_retry_count', 'sync_last_attempt', 'version', 'base_version',
          'conflict_status', 'conflict_backup', 'last_edited_by', 'last_edited_device'
        ];

        // Only copy columns that exist in the old table
        const columnsToMigrate = newTableColumnNames.filter(col => columnNames.includes(col));
        const columnList = columnsToMigrate.join(', ');

        log.debug('Migrating columns', { columns: columnList });

        // Drop any existing entries_new table from previous failed migration
        await this.db.execAsync(`DROP TABLE IF EXISTS entries_new;`);

        // Create new table
        await this.db.execAsync(`
          CREATE TABLE entries_new (${newTableColumns});
        `);

        // Copy data with explicit column names
        await this.db.execAsync(`
          INSERT INTO entries_new (${columnList})
          SELECT ${columnList} FROM entries;
        `);

        // Drop old table and rename new (must be separate statements in SQLite)
        await this.db.execAsync(`DROP TABLE entries;`);
        await this.db.execAsync(`ALTER TABLE entries_new RENAME TO entries;`);

        // Mark migration as done
        await this.db.execAsync(`
          INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
          VALUES ('migration_status_in_progress_done', 'true', ${Date.now()});
        `);

        log.info('Migration complete: entries status constraint updated to include in_progress');
      }
    } catch (error) {
      log.error('Migration error (status in_progress constraint)', error);
    }

    // Migration: Update to new 9-status system (incomplete->todo, complete->done, add new statuses)
    try {
      const migrationCheck = await this.db.getFirstAsync<{ value: string }>(
        `SELECT value FROM sync_metadata WHERE key = 'migration_9_status_system_done'`
      );

      if (!migrationCheck) {
        log.info('Running migration: Converting to 9-status system');

        // Get existing column names from the entries table
        const columns = await this.db.getAllAsync<{ name: string }>(
          `SELECT name FROM pragma_table_info('entries')`
        );
        const columnNames = columns.map(c => c.name);
        log.debug('Found columns in entries table', { count: columnNames.length });

        // Define the new table columns with updated status constraint
        const newTableColumns = `
          entry_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT,
          content TEXT NOT NULL,
          tags TEXT,
          mentions TEXT,
          stream_id TEXT,
          entry_date INTEGER,
          entry_latitude REAL,
          entry_longitude REAL,
          location_radius REAL,
          location_id TEXT,
          status TEXT CHECK (status IN ('none', 'new', 'todo', 'in_progress', 'in_review', 'waiting', 'on_hold', 'done', 'closed', 'cancelled')) DEFAULT 'none',
          due_date INTEGER,
          completed_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER,
          priority INTEGER DEFAULT 0,
          rating REAL DEFAULT 0.00,
          is_pinned INTEGER DEFAULT 0,
          is_archived INTEGER DEFAULT 0,
          local_only INTEGER DEFAULT 0,
          synced INTEGER DEFAULT 0,
          sync_action TEXT,
          sync_error TEXT,
          sync_retry_count INTEGER DEFAULT 0,
          sync_last_attempt INTEGER,
          version INTEGER DEFAULT 1,
          base_version INTEGER DEFAULT 1,
          conflict_status TEXT,
          conflict_backup TEXT,
          last_edited_by TEXT,
          last_edited_device TEXT
        `;

        // Build explicit column list for INSERT
        const newTableColumnNames = [
          'entry_id', 'user_id', 'title', 'content', 'tags', 'mentions', 'stream_id',
          'entry_date', 'entry_latitude', 'entry_longitude', 'location_radius', 'location_id',
          'status', 'due_date', 'completed_at', 'created_at', 'updated_at', 'deleted_at',
          'priority', 'rating', 'is_pinned', 'is_archived', 'local_only', 'synced', 'sync_action',
          'sync_error', 'sync_retry_count', 'sync_last_attempt', 'version', 'base_version',
          'conflict_status', 'conflict_backup', 'last_edited_by', 'last_edited_device'
        ];

        const columnsToMigrate = newTableColumnNames.filter(col => columnNames.includes(col));
        const columnsList = columnsToMigrate.join(', ');

        // Build SELECT with status conversion (incomplete->todo, complete->done)
        const selectColumns = columnsToMigrate.map(col => {
          if (col === 'status') {
            return `CASE
              WHEN status = 'incomplete' THEN 'todo'
              WHEN status = 'complete' THEN 'done'
              ELSE status
            END as status`;
          }
          return col;
        }).join(', ');

        // Recreate table with new constraint and migrate data
        // Drop any leftover entries_new from failed migration
        await this.db.execAsync(`DROP TABLE IF EXISTS entries_new;`);
        await this.db.execAsync(`CREATE TABLE entries_new (${newTableColumns});`);
        await this.db.execAsync(`INSERT INTO entries_new (${columnsList}) SELECT ${selectColumns} FROM entries;`);
        await this.db.execAsync(`DROP TABLE entries;`);
        await this.db.execAsync(`ALTER TABLE entries_new RENAME TO entries;`);

        // Mark migration as done
        await this.db.execAsync(`
          INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
          VALUES ('migration_9_status_system_done', 'true', ${Date.now()});
        `);

        log.info('Migration complete: converted to 9-status system (incomplete->todo, complete->done)');
      }
    } catch (error) {
      log.error('Migration error (9-status system)', error);
    }

    // Migration: Add entry_statuses and entry_default_status columns to streams table
    try {
      const statusesCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('streams') WHERE name = 'entry_statuses'`
      );

      if (!statusesCheck) {
        log.info('Running migration: Adding entry_statuses and entry_default_status to streams table');
        await this.db.execAsync(`
          ALTER TABLE streams ADD COLUMN entry_statuses TEXT DEFAULT '["new","todo","in_progress","done"]';
          ALTER TABLE streams ADD COLUMN entry_default_status TEXT DEFAULT 'new';
        `);
        log.info('Migration complete: entry_statuses and entry_default_status added to streams');
      }
    } catch (error) {
      log.error('Migration error (streams status config)', error);
    }

    // Migration: Add entry_types and entry_use_type columns to streams table
    try {
      const typesCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('streams') WHERE name = 'entry_types'`
      );

      if (!typesCheck) {
        log.info('Running migration: Adding entry_types and entry_use_type to streams table');
        await this.db.execAsync(`
          ALTER TABLE streams ADD COLUMN entry_types TEXT DEFAULT '[]';
          ALTER TABLE streams ADD COLUMN entry_use_type INTEGER DEFAULT 0;
        `);
        log.info('Migration complete: entry_types and entry_use_type added to streams');
      }
    } catch (error) {
      log.error('Migration error (streams type config)', error);
    }

    // Migration: Add type column to entries table
    try {
      const typeCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('entries') WHERE name = 'type'`
      );

      if (!typeCheck) {
        log.info('Running migration: Adding type column to entries table');
        await this.db.execAsync(`
          ALTER TABLE entries ADD COLUMN type TEXT;
        `);
        // Create index for type lookups
        await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type)`);
        log.info('Migration complete: type added to entries');
      }
    } catch (error) {
      log.error('Migration error (entries type)', error);
    }

    // Migration: Add entry_rating_type column to streams table
    try {
      const ratingTypeCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('streams') WHERE name = 'entry_rating_type'`
      );

      if (!ratingTypeCheck) {
        log.info('Running migration: Adding entry_rating_type to streams table');
        await this.db.execAsync(`
          ALTER TABLE streams ADD COLUMN entry_rating_type TEXT DEFAULT 'stars';
        `);
        log.info('Migration complete: entry_rating_type added to streams');
      }
    } catch (error) {
      log.error('Migration error (streams entry_rating_type)', error);
    }

    // Migration: Add location hierarchy fields to entries table
    try {
      const placeNameCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('entries') WHERE name = 'place_name'`
      );

      if (!placeNameCheck) {
        log.info('Running migration: Adding location hierarchy fields to entries table');
        await this.db.execAsync(`
          ALTER TABLE entries ADD COLUMN place_name TEXT;
          ALTER TABLE entries ADD COLUMN address TEXT;
          ALTER TABLE entries ADD COLUMN neighborhood TEXT;
          ALTER TABLE entries ADD COLUMN postal_code TEXT;
          ALTER TABLE entries ADD COLUMN city TEXT;
          ALTER TABLE entries ADD COLUMN subdivision TEXT;
          ALTER TABLE entries ADD COLUMN region TEXT;
          ALTER TABLE entries ADD COLUMN country TEXT;
        `);
        // Create indexes for location queries
        await this.db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_entries_place_name ON entries(place_name);
          CREATE INDEX IF NOT EXISTS idx_entries_city ON entries(city);
          CREATE INDEX IF NOT EXISTS idx_entries_region ON entries(region);
          CREATE INDEX IF NOT EXISTS idx_entries_country ON entries(country);
        `);
        log.info('Migration complete: location hierarchy fields added to entries');

        // Backfill from locations table
        log.info('Backfilling entry location data from locations table');
        await this.db.execAsync(`
          UPDATE entries
          SET
            place_name = (SELECT name FROM locations WHERE locations.location_id = entries.location_id),
            address = (SELECT address FROM locations WHERE locations.location_id = entries.location_id),
            neighborhood = (SELECT neighborhood FROM locations WHERE locations.location_id = entries.location_id),
            postal_code = (SELECT postal_code FROM locations WHERE locations.location_id = entries.location_id),
            city = (SELECT city FROM locations WHERE locations.location_id = entries.location_id),
            subdivision = (SELECT subdivision FROM locations WHERE locations.location_id = entries.location_id),
            region = (SELECT region FROM locations WHERE locations.location_id = entries.location_id),
            country = (SELECT country FROM locations WHERE locations.location_id = entries.location_id)
          WHERE location_id IS NOT NULL AND place_name IS NULL
        `);
        log.info('Backfill complete: entry location data populated from locations');
      }
    } catch (error) {
      log.error('Migration error (entries location hierarchy)', error);
    }

    // Migration: Add missing columns to attachments table FIRST (before data copy)
    try {
      const attachmentsExists = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='attachments'`
      );

      if (attachmentsExists) {
        const columns = await this.db.getAllAsync<{ name: string }>(
          `PRAGMA table_info(attachments)`
        );
        const columnNames = columns.map(c => c.name);

        if (!columnNames.includes('thumbnail_path')) {
          await this.db.execAsync(`ALTER TABLE attachments ADD COLUMN thumbnail_path TEXT`);
          log.info('Added thumbnail_path column to attachments');
        }
        if (!columnNames.includes('captured_at')) {
          await this.db.execAsync(`ALTER TABLE attachments ADD COLUMN captured_at TEXT`);
          log.info('Added captured_at column to attachments');
        }
        if (!columnNames.includes('sync_error')) {
          await this.db.execAsync(`ALTER TABLE attachments ADD COLUMN sync_error TEXT`);
          log.info('Added sync_error column to attachments');
        }
      }
    } catch (error) {
      log.error('Migration error (attachments columns)', error);
    }

    // Migration: Rename photos table to attachments
    try {
      // Check if old 'photos' table exists
      const photosTableCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='photos'`
      );

      // Check if new 'attachments' table already exists
      const attachmentsTableCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='attachments'`
      );

      if (photosTableCheck) {
        log.info('Running migration: Migrating photos table to attachments');

        if (attachmentsTableCheck) {
          // Both tables exist - copy data from photos to attachments, then drop photos
          log.info('Both tables exist - copying data and dropping old table');

          // Get columns from both tables to find common ones
          const photosColumns = await this.db.getAllAsync<{ name: string }>(
            `PRAGMA table_info(photos)`
          );
          const attachmentsColumns = await this.db.getAllAsync<{ name: string }>(
            `PRAGMA table_info(attachments)`
          );

          const photosColNames = new Set(photosColumns.map(c => c.name));
          const attachmentsColNames = new Set(attachmentsColumns.map(c => c.name));

          // Find common columns (excluding photo_id which maps to attachment_id)
          const commonCols: string[] = [];
          for (const col of photosColNames) {
            if (col === 'photo_id') continue; // handled separately
            if (attachmentsColNames.has(col)) {
              commonCols.push(col);
            }
          }

          // Build dynamic INSERT
          const attachmentsCols = ['attachment_id', ...commonCols].join(', ');
          const photosCols = ['photo_id', ...commonCols].join(', ');

          log.debug('Copying columns', { columns: attachmentsCols });

          await this.db.execAsync(`
            INSERT OR IGNORE INTO attachments (${attachmentsCols})
            SELECT ${photosCols} FROM photos
          `);

          // Drop the old photos table
          await this.db.execAsync(`DROP TABLE photos`);
          log.info('Data migrated and old photos table dropped');
        } else {
          // Only photos table exists - rename it
          await this.db.execAsync(`ALTER TABLE photos RENAME TO attachments`);
          await this.db.execAsync(`ALTER TABLE attachments RENAME COLUMN photo_id TO attachment_id`);
          log.info('Photos table renamed to attachments');
        }

        // Drop old indexes (they may or may not exist)
        await this.db.execAsync(`
          DROP INDEX IF EXISTS idx_photos_entry_id;
          DROP INDEX IF EXISTS idx_photos_user_id;
          DROP INDEX IF EXISTS idx_photos_position;
          DROP INDEX IF EXISTS idx_photos_uploaded;
          DROP INDEX IF EXISTS idx_photos_synced;
        `);

        log.info('Migration complete: photos migrated to attachments');
      }
    } catch (error) {
      log.error('Migration error (photos to attachments)', error);
    }

    // Migration: Add geocode_status field to entries table
    try {
      const geocodeStatusCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('entries') WHERE name = 'geocode_status'`
      );

      if (!geocodeStatusCheck) {
        log.info('Running migration: Adding geocode_status to entries table');
        await this.db.execAsync(`
          ALTER TABLE entries ADD COLUMN geocode_status TEXT;
        `);
        // Create index for finding entries that need geocoding
        await this.db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_entries_geocode_pending
          ON entries(user_id)
          WHERE geocode_status IS NULL AND entry_latitude IS NOT NULL;
        `);
        log.info('Migration complete: geocode_status added to entries');
      }
    } catch (error) {
      log.error('Migration error (entries geocode_status)', error);
    }

    // Migration: Add location_radius field to locations table (renamed from accuracy)
    try {
      const locationRadiusCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('locations') WHERE name = 'location_radius'`
      );

      if (!locationRadiusCheck) {
        log.info('Running migration: Adding location_radius to locations table');
        await this.db.execAsync(`
          ALTER TABLE locations ADD COLUMN location_radius REAL;
        `);
        log.info('Migration complete: location_radius added to locations');
      }
    } catch (error) {
      log.error('Migration error (locations location_radius)', error);
    }

    // Migration: Rename accuracy to location_radius (for existing databases)
    try {
      const hasAccuracy = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('locations') WHERE name = 'accuracy'`
      );
      const hasLocationRadius = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('locations') WHERE name = 'location_radius'`
      );

      if (hasAccuracy && !hasLocationRadius) {
        log.info('Running migration: Renaming accuracy to location_radius');
        await this.db.execAsync(`
          ALTER TABLE locations RENAME COLUMN accuracy TO location_radius;
        `);
        log.info('Migration complete: locations.accuracy renamed to location_radius');
      }

      // Also rename on entries table
      const entriesHasAccuracy = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('entries') WHERE name = 'location_accuracy'`
      );
      const entriesHasRadius = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('entries') WHERE name = 'location_radius'`
      );

      if (entriesHasAccuracy && !entriesHasRadius) {
        log.info('Running migration: Renaming entries.location_accuracy to location_radius');
        await this.db.execAsync(`
          ALTER TABLE entries RENAME COLUMN location_accuracy TO location_radius;
        `);
        log.info('Migration complete: entries.location_accuracy renamed to location_radius');
      }
    } catch (error) {
      log.error('Migration error (rename accuracy to location_radius)', error);
    }

    // Migration: Remove unused geo_ fields (never used for filtering)
    // These fields were added but never actually used - location filtering uses regular display fields
    try {
      const migrationCheck = await this.db.getFirstAsync<{ value: string }>(
        `SELECT value FROM sync_metadata WHERE key = 'migration_remove_geo_fields_done'`
      );

      if (!migrationCheck) {
        log.info('Running migration: Removing unused geo_ fields from entries and locations tables');

        // Drop indexes first
        await this.db.execAsync(`
          DROP INDEX IF EXISTS idx_entries_geo_city;
          DROP INDEX IF EXISTS idx_entries_geo_region;
          DROP INDEX IF EXISTS idx_entries_geo_country;
          DROP INDEX IF EXISTS idx_locations_geo_city;
          DROP INDEX IF EXISTS idx_locations_geo_region;
          DROP INDEX IF EXISTS idx_locations_geo_country;
        `);

        // SQLite doesn't support DROP COLUMN directly, so we need to recreate tables
        // For simplicity, we'll skip dropping the columns since they're unused and don't hurt
        // The columns will be absent in fresh installs (CREATE TABLE doesn't include them)
        // and existing users will have empty geo_ columns that are never read or written

        // Mark migration as done
        await this.db.execAsync(`
          INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
          VALUES ('migration_remove_geo_fields_done', 'true', ${Date.now()});
        `);

        log.info('Migration complete: Removed geo_ field indexes');
      }
    } catch (error) {
      log.error('Migration error (remove geo_ fields)', error);
    }

    // Migration: Add sync_error column to locations table
    // Locations should follow the same sync pattern as entries/streams/attachments
    try {
      const syncErrorCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('locations') WHERE name = 'sync_error'`
      );

      if (!syncErrorCheck) {
        log.info('Running migration: Adding sync_error column to locations table');
        await this.db.execAsync(`
          ALTER TABLE locations ADD COLUMN sync_error TEXT;
        `);
        log.info('Migration complete: sync_error added to locations');
      }
    } catch (error) {
      log.error('Migration error (locations sync_error)', error);
    }

    // Migration: Add merge_ignore_ids column to locations table
    try {
      const mergeIgnoreCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('locations') WHERE name = 'merge_ignore_ids'`
      );

      if (!mergeIgnoreCheck) {
        log.info('Running migration: Adding merge_ignore_ids column to locations table');
        await this.db.execAsync(`
          ALTER TABLE locations ADD COLUMN merge_ignore_ids TEXT;
        `);
        log.info('Migration complete: merge_ignore_ids added to locations');
      }
    } catch (error) {
      log.error('Migration error (locations merge_ignore_ids)', error);
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      -- Locations table (stores unique locations)
      CREATE TABLE IF NOT EXISTS locations (
        location_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        source TEXT,                  -- 'mapbox_poi', 'foursquare', 'user_custom', 'gps'
        -- Display fields (user-editable)
        address TEXT,
        neighborhood TEXT,
        postal_code TEXT,
        city TEXT,
        subdivision TEXT,
        region TEXT,
        country TEXT,
        location_radius REAL,         -- User-selected radius in meters for location generalization
        merge_ignore_ids TEXT,        -- JSON array of location_ids to suppress merge suggestions
        mapbox_place_id TEXT,
        foursquare_fsq_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,           -- Soft delete
        synced INTEGER DEFAULT 0,
        sync_action TEXT,
        sync_error TEXT               -- Error message from last sync attempt
      );

      -- Indexes for locations are created in createIndexes() after migrations

      -- Entries table (mirrors Supabase schema + sync fields)
      CREATE TABLE IF NOT EXISTS entries (
        entry_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        tags TEXT,                    -- JSON array: '["tag1","tag2"]'
        mentions TEXT,                -- JSON array: '["person1","person2"]'
        stream_id TEXT,
        entry_date INTEGER,           -- Unix timestamp for calendar grouping

        -- GPS coordinates (where user was when creating entry)
        entry_latitude REAL,
        entry_longitude REAL,
        location_radius REAL,

        -- Location reference (optional FK to locations table for anchors)
        location_id TEXT,

        -- Location hierarchy - display fields (user-editable)
        place_name TEXT,              -- Named place (e.g., "Starbucks", "Home")
        address TEXT,                 -- Street address
        neighborhood TEXT,            -- Neighborhood name
        postal_code TEXT,             -- Postal/ZIP code
        city TEXT,                    -- City name
        subdivision TEXT,             -- County/district
        region TEXT,                  -- State/province
        country TEXT,                 -- Country name
        geocode_status TEXT,          -- Reverse geocode status: null, 'pending', 'success', 'no_data', 'error'

        status TEXT CHECK (status IN ('none', 'new', 'todo', 'in_progress', 'in_review', 'waiting', 'on_hold', 'done', 'closed', 'cancelled')) DEFAULT 'none',
        type TEXT,                    -- User-defined type from stream's entry_types
        due_date INTEGER,             -- Unix timestamp
        completed_at INTEGER,         -- Unix timestamp
        created_at INTEGER NOT NULL,  -- Unix timestamp
        updated_at INTEGER NOT NULL,  -- Unix timestamp
        deleted_at INTEGER,           -- Unix timestamp (soft delete)

        -- Priority, rating, pinning, and archive fields
        priority INTEGER DEFAULT 0,   -- Integer priority level for sorting
        rating REAL DEFAULT 0.00,     -- Decimal rating from 0.00 to 5.00
        is_pinned INTEGER DEFAULT 0,  -- Boolean flag (0=false, 1=true) to pin entries
        is_archived INTEGER DEFAULT 0, -- Boolean flag (0=false, 1=true) to archive entries

        -- Sync tracking fields
        local_only INTEGER DEFAULT 0,     -- 0 = sync enabled, 1 = local only
        synced INTEGER DEFAULT 0,         -- 0 = needs sync, 1 = synced
        sync_action TEXT,                 -- 'create', 'update', 'delete', or NULL
        sync_error TEXT,                  -- Error message if sync failed
        sync_retry_count INTEGER DEFAULT 0,
        sync_last_attempt INTEGER,        -- Unix timestamp of last sync attempt

        -- Conflict resolution fields
        version INTEGER DEFAULT 1,        -- Increments with each local edit
        base_version INTEGER DEFAULT 1,   -- Server version this edit is based on
        conflict_status TEXT,             -- null, 'conflicted', 'resolved'
        conflict_backup TEXT,             -- JSON backup of losing version
        last_edited_by TEXT,              -- User email who last edited
        last_edited_device TEXT           -- Device name that last edited
      );

      -- Indexes for entries are created in createIndexes() after migrations

      -- Streams table (flat organization, no hierarchy)
      CREATE TABLE IF NOT EXISTS streams (
        stream_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        entry_count INTEGER DEFAULT 0,
        color TEXT,
        icon TEXT,
        entry_title_template TEXT,
        entry_content_template TEXT,
        entry_use_rating INTEGER DEFAULT 0,
        entry_rating_type TEXT DEFAULT 'stars',
        entry_use_priority INTEGER DEFAULT 0,
        entry_use_status INTEGER DEFAULT 1,
        entry_use_duedates INTEGER DEFAULT 0,
        entry_use_location INTEGER DEFAULT 1,
        entry_use_photos INTEGER DEFAULT 1,
        entry_content_type TEXT DEFAULT 'richformat',
        entry_statuses TEXT DEFAULT '["new","todo","in_progress","done"]',
        entry_default_status TEXT DEFAULT 'new',
        entry_use_type INTEGER DEFAULT 0,
        entry_types TEXT DEFAULT '[]',
        is_private INTEGER DEFAULT 0,
        is_localonly INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        synced INTEGER DEFAULT 0,
        sync_action TEXT,
        sync_error TEXT,
        version INTEGER DEFAULT 1,
        base_version INTEGER DEFAULT 1,
        conflict_status TEXT,
        conflict_backup TEXT,
        last_edited_by TEXT,
        last_edited_device TEXT
      );

      -- Indexes for streams are created in createIndexes() after migrations

      -- Attachments table (renamed from photos)
      CREATE TABLE IF NOT EXISTS attachments (
        attachment_id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        thumbnail_path TEXT,
        local_path TEXT,
        mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
        file_size INTEGER,
        width INTEGER,
        height INTEGER,
        position INTEGER NOT NULL DEFAULT 0,
        captured_at TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        uploaded INTEGER DEFAULT 0,
        synced INTEGER DEFAULT 0,
        sync_error TEXT,
        sync_action TEXT,
        FOREIGN KEY (entry_id) REFERENCES entries(entry_id) ON DELETE CASCADE
      );

      -- Indexes for attachments are created in createIndexes() after migrations

      -- Sync metadata table
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Sync logs table
      CREATE TABLE IF NOT EXISTS sync_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp INTEGER NOT NULL,
        log_level TEXT NOT NULL CHECK (log_level IN ('info', 'warning', 'error')),
        operation TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        entries_pushed INTEGER DEFAULT 0,
        entries_errors INTEGER DEFAULT 0,
        streams_pushed INTEGER DEFAULT 0,
        streams_errors INTEGER DEFAULT 0,
        attachments_pushed INTEGER DEFAULT 0,
        attachments_errors INTEGER DEFAULT 0,
        entries_pulled INTEGER DEFAULT 0
      );

      -- Indexes for sync_logs are created in createIndexes() after migrations
    `);
  }

  /**
   * Create all database indexes
   * Called after migrations to ensure all columns exist
   */
  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      -- Indexes for locations
      CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);
      CREATE INDEX IF NOT EXISTS idx_locations_name ON locations(name);
      CREATE INDEX IF NOT EXISTS idx_locations_city ON locations(city);
      CREATE INDEX IF NOT EXISTS idx_locations_synced ON locations(synced);

      -- Indexes for entries
      CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_entries_deleted_at ON entries(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_entries_entry_date ON entries(entry_date);
      CREATE INDEX IF NOT EXISTS idx_entries_stream_id ON entries(stream_id);
      CREATE INDEX IF NOT EXISTS idx_entries_location_id ON entries(location_id);
      CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
      CREATE INDEX IF NOT EXISTS idx_entries_type ON entries(type);
      CREATE INDEX IF NOT EXISTS idx_entries_synced ON entries(synced);
      CREATE INDEX IF NOT EXISTS idx_entries_local_only ON entries(local_only);

      -- Indexes for streams
      CREATE INDEX IF NOT EXISTS idx_streams_user_id ON streams(user_id);
      CREATE INDEX IF NOT EXISTS idx_streams_synced ON streams(synced);

      -- Indexes for attachments
      CREATE INDEX IF NOT EXISTS idx_attachments_entry_id ON attachments(entry_id);
      CREATE INDEX IF NOT EXISTS idx_attachments_user_id ON attachments(user_id);
      CREATE INDEX IF NOT EXISTS idx_attachments_position ON attachments(entry_id, position);
      CREATE INDEX IF NOT EXISTS idx_attachments_uploaded ON attachments(uploaded);
      CREATE INDEX IF NOT EXISTS idx_attachments_synced ON attachments(synced);

      -- Indexes for sync_logs
      CREATE INDEX IF NOT EXISTS idx_sync_logs_timestamp ON sync_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_sync_logs_level ON sync_logs(log_level);
    `);
  }

  // ========================================
  // ENTRY OPERATIONS
  // ========================================

  /**
   * Save an entry to local database
   */
  async saveEntry(entry: Entry): Promise<Entry> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();

    await this.db.runAsync(
      `INSERT OR REPLACE INTO entries (
        entry_id, user_id, title, content, tags, mentions,
        stream_id, entry_date,
        entry_latitude, entry_longitude,
        location_id,
        place_name, address, neighborhood, postal_code, city, subdivision, region, country,
        geocode_status,
        status, type, due_date, completed_at, created_at, updated_at,
        deleted_at,
        priority, rating, is_pinned, is_archived,
        local_only, synced, sync_action,
        version, base_version,
        conflict_status, conflict_backup,
        last_edited_by, last_edited_device
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.entry_id,
        entry.user_id,
        entry.title || null,
        entry.content,
        JSON.stringify(entry.tags || []),
        JSON.stringify(entry.mentions || []),
        entry.stream_id || null,
        entry.entry_date ? Date.parse(entry.entry_date) : (entry.created_at ? Date.parse(entry.created_at) : now),
        entry.entry_latitude ?? null,
        entry.entry_longitude ?? null,
        entry.location_id || null,
        entry.place_name || null,
        entry.address || null,
        entry.neighborhood || null,
        entry.postal_code || null,
        entry.city || null,
        entry.subdivision || null,
        entry.region || null,
        entry.country || null,
        entry.geocode_status || null,
        entry.status || 'none',
        entry.type || null,
        entry.due_date ? Date.parse(entry.due_date) : null,
        entry.completed_at ? Date.parse(entry.completed_at) : null,
        entry.created_at ? Date.parse(entry.created_at) : now,
        entry.updated_at ? Date.parse(entry.updated_at) : now,
        entry.deleted_at ? Date.parse(entry.deleted_at) : null,
        entry.priority !== undefined ? entry.priority : 0,
        entry.rating !== undefined ? entry.rating : 0.00,
        entry.is_pinned ? 1 : 0,
        entry.is_archived ? 1 : 0,
        entry.local_only !== undefined ? entry.local_only : 0,
        entry.synced !== undefined ? entry.synced : 0,
        entry.sync_action !== undefined ? entry.sync_action : 'create',
        entry.version !== undefined ? entry.version : 1,
        entry.base_version !== undefined ? entry.base_version : 1,
        entry.conflict_status || null,
        entry.conflict_backup || null,
        entry.last_edited_by || null,
        entry.last_edited_device || null
      ]
    );

    return this.getEntry(entry.entry_id) as Promise<Entry>;
  }

  /**
   * Get a single entry by ID
   */
  async getEntry(entryId: string): Promise<Entry | null> {
    const t0 = performance.now();
    await this.init();
    const t1 = performance.now();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM entries WHERE entry_id = ?';
    const params: any[] = [entryId];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    // Debug: Check query plan and table size
    try {
      const countResult = await this.db.getFirstAsync<{count: number}>('SELECT COUNT(*) as count FROM entries');
      const explainResult = await this.db.getAllAsync<any>(`EXPLAIN QUERY PLAN ${query}`, params);
      console.log('[localDB] ⏱️ DEBUG', {
        entryCount: countResult?.count,
        query,
        plan: JSON.stringify(explainResult)
      });
    } catch (e) {
      console.log('[localDB] DEBUG failed', e);
    }

    const row = await this.db.getFirstAsync<any>(query, params);
    const t2 = performance.now();

    if (!row) return null;

    const result = this.rowToEntry(row);
    const t3 = performance.now();

    console.log('[localDB] ⏱️ getEntry timing', {
      initMs: Math.round(t1 - t0),
      queryMs: Math.round(t2 - t1),
      rowToEntryMs: Math.round(t3 - t2),
      totalMs: Math.round(t3 - t0),
    });

    return result;
  }

  /**
   * Get all entries (with optional filters)
   * Excludes soft-deleted entries by default
   */
  async getAllEntries(filter?: {
    stream_id?: string | null;
    status?: string;
    tag?: string;
    mention?: string;
    location_id?: string;
    includeDeleted?: boolean;
    excludePrivateStreams?: boolean;
    // Location hierarchy filters
    filter_country?: string;
    filter_region?: string;
    filter_city?: string;
    filter_neighborhood?: string;
    filter_place_name?: string;
    filter_address?: string;
    filter_no_place?: boolean;
    filter_has_place?: boolean;
    filter_unnamed?: boolean;
  }): Promise<Entry[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // Include photo_count as a subquery for filtering (avoids separate attachmentCounts query)
    let query = `SELECT e.*,
      (SELECT COUNT(*) FROM attachments a
       WHERE a.entry_id = e.entry_id
       AND (a.sync_action IS NULL OR a.sync_action != 'delete')) as photo_count
      FROM entries e WHERE 1=1`;
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' AND e.user_id = ?';
      params.push(this.currentUserId);
    }

    if (!filter?.includeDeleted) {
      query += ' AND e.deleted_at IS NULL';
    }

    if (filter) {
      if (filter.stream_id !== undefined) {
        if (filter.stream_id === null) {
          query += ' AND e.stream_id IS NULL';
        } else {
          query += ' AND e.stream_id = ?';
          params.push(filter.stream_id);
        }
      }

      if (filter.status) {
        query += ' AND e.status = ?';
        params.push(filter.status);
      }

      if (filter.tag) {
        query += ' AND e.tags LIKE ?';
        params.push(`%"${filter.tag.toLowerCase()}"%`);
      }

      if (filter.mention) {
        query += ' AND e.mentions LIKE ?';
        params.push(`%"${filter.mention.toLowerCase()}"%`);
      }

      if (filter.location_id) {
        query += ' AND e.location_id = ?';
        params.push(filter.location_id);
      }

      // Location hierarchy filters
      if (filter.filter_country) {
        query += ' AND e.country = ?';
        params.push(filter.filter_country);
      }

      if (filter.filter_region) {
        query += ' AND e.region = ?';
        params.push(filter.filter_region);
      }

      if (filter.filter_city) {
        query += ' AND e.city = ?';
        params.push(filter.filter_city);
      }

      if (filter.filter_neighborhood) {
        query += ' AND e.neighborhood = ?';
        params.push(filter.filter_neighborhood);
      }

      if (filter.filter_place_name) {
        query += ' AND e.place_name = ?';
        params.push(filter.filter_place_name);
      }

      if (filter.filter_address) {
        query += ' AND e.address = ?';
        params.push(filter.filter_address);
      }

      // Filter for entries with no place data at all
      if (filter.filter_no_place) {
        query += ' AND e.country IS NULL AND e.region IS NULL AND e.city IS NULL AND e.neighborhood IS NULL AND e.place_name IS NULL AND e.entry_latitude IS NULL';
      }

      // Filter for entries that have any location/place data (GPS coords exist)
      if (filter.filter_has_place) {
        query += ' AND e.entry_latitude IS NOT NULL';
      }

      // Filter for unnamed entries (have GPS/geocode data but no place_name)
      if (filter.filter_unnamed) {
        query += ' AND e.place_name IS NULL AND e.location_id IS NULL AND e.entry_latitude IS NOT NULL';
      }

      // Privacy filtering - exclude entries from private streams
      // Only applies when NOT viewing a specific stream (i.e., viewing "All Entries")
      if (filter.excludePrivateStreams) {
        query += ` AND (e.stream_id IS NULL OR e.stream_id NOT IN (
          SELECT stream_id FROM streams WHERE is_private = 1 AND (sync_action IS NULL OR sync_action != 'delete')
        ))`;
      }
    }

    query += ' ORDER BY e.updated_at DESC';

    const rows = await this.db.getAllAsync<any>(query, params);

    return rows.map(row => this.rowToEntry(row));
  }

  /**
   * Get location hierarchy aggregated from entries
   * Returns rows grouped by country, region, city, neighborhood, place_name, and location_id
   * location_id is the stable unique identifier for places (no GPS jitter issues)
   * Used for building the location tree in the drawer
   */
  async getLocationHierarchy(): Promise<Array<{
    country: string | null;
    region: string | null;
    city: string | null;
    neighborhood: string | null;
    place_name: string | null;
    location_id: string | null;
    entry_count: number;
  }>> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // Group by location_id for places - it's a stable UUID, no jitter issues
    let query = `
      SELECT
        country,
        region,
        city,
        neighborhood,
        place_name,
        location_id,
        COUNT(*) as entry_count
      FROM entries
      WHERE deleted_at IS NULL
        AND (country IS NOT NULL OR region IS NOT NULL OR city IS NOT NULL OR neighborhood IS NOT NULL OR place_name IS NOT NULL)
    `;
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    query += `
      GROUP BY country, region, city, neighborhood, place_name, location_id
      ORDER BY country, region, city, neighborhood, place_name
    `;

    const rows = await this.db.getAllAsync<any>(query, params);

    return rows.map(row => ({
      country: row.country,
      region: row.region,
      city: row.city,
      neighborhood: row.neighborhood,
      place_name: row.place_name,
      location_id: row.location_id,
      entry_count: row.entry_count,
    }));
  }

  /**
   * Get count of entries with no location data
   * Used for the "No Location" node in the location tree
   */
  async getNoLocationCount(): Promise<number> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = `
      SELECT COUNT(*) as count
      FROM entries
      WHERE deleted_at IS NULL
        AND country IS NULL
        AND region IS NULL
        AND city IS NULL
        AND place_name IS NULL
        AND entry_latitude IS NULL
    `;
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    const result = await this.db.getFirstAsync<{ count: number }>(query, params);
    return result?.count || 0;
  }

  /**
   * Update an entry
   */
  async updateEntry(entryId: string, updates: Partial<Entry>): Promise<Entry> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const existing = await this.getEntry(entryId);
    if (!existing) throw new Error('Entry not found');

    const now = Date.now();
    const updated = {
      ...existing,
      ...updates,
      updated_at: updates.updated_at || new Date(now).toISOString()
    };

    log.debug('updateEntry called', {
      entryId,
      is_pinned: updated.is_pinned,
      priority: updated.priority,
      rating: updated.rating
    });

    await this.db.runAsync(
      `UPDATE entries SET
        title = ?, content = ?, tags = ?, mentions = ?,
        stream_id = ?, entry_date = ?,
        entry_latitude = ?, entry_longitude = ?,
        location_id = ?,
        place_name = ?, address = ?, neighborhood = ?, postal_code = ?,
        city = ?, subdivision = ?, region = ?, country = ?,
        geocode_status = ?,
        status = ?, type = ?, due_date = ?, completed_at = ?,
        priority = ?, rating = ?, is_pinned = ?, is_archived = ?,
        updated_at = ?, deleted_at = ?,
        local_only = ?, synced = ?, sync_action = ?,
        version = ?, base_version = ?,
        conflict_status = ?, conflict_backup = ?,
        last_edited_by = ?, last_edited_device = ?
      WHERE entry_id = ?`,
      [
        updated.title || null,
        updated.content,
        JSON.stringify(updated.tags || []),
        JSON.stringify(updated.mentions || []),
        updated.stream_id || null,
        updated.entry_date ? Date.parse(updated.entry_date) : null,
        updated.entry_latitude ?? null,
        updated.entry_longitude ?? null,
        updated.location_id || null,
        updated.place_name || null,
        updated.address || null,
        updated.neighborhood || null,
        updated.postal_code || null,
        updated.city || null,
        updated.subdivision || null,
        updated.region || null,
        updated.country || null,
        updated.geocode_status || null,
        updated.status || 'none',
        updated.type || null,
        updated.due_date ? Date.parse(updated.due_date) : null,
        updated.completed_at ? Date.parse(updated.completed_at) : null,
        updated.priority !== undefined ? updated.priority : 0,
        updated.rating !== undefined ? updated.rating : 0.00,
        updated.is_pinned ? 1 : 0,
        updated.is_archived ? 1 : 0,
        Date.parse(updated.updated_at),
        updated.deleted_at ? Date.parse(updated.deleted_at) : null,
        updated.local_only !== undefined ? updated.local_only : 0,
        updated.synced !== undefined ? updated.synced : 0,
        updated.sync_action !== undefined ? updated.sync_action : 'update',
        updated.version !== undefined ? updated.version : 1,
        updated.base_version !== undefined ? updated.base_version : 1,
        updated.conflict_status || null,
        updated.conflict_backup || null,
        updated.last_edited_by || null,
        updated.last_edited_device || null,
        entryId
      ]
    );

    log.debug('UPDATE executed, fetching updated entry');
    const result = await this.getEntry(entryId);
    if (!result) throw new Error('Entry not found after update');
    log.debug('Retrieved entry', {
      entryId: result.entry_id,
      is_pinned: result.is_pinned,
      priority: result.priority,
      rating: result.rating
    });
    return result;
  }

  /**
   * Delete an entry (soft delete)
   */
  async deleteEntry(entryId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const entry = await this.getEntry(entryId);
    if (!entry) return;

    const now = Date.now();

    // Mark all associated attachments for deletion
    const attachments = await this.getAttachmentsForEntry(entryId);
    for (const attachment of attachments) {
      await this.deleteAttachment(attachment.attachment_id);
    }

    if (entry.local_only) {
      await this.db.runAsync('DELETE FROM entries WHERE entry_id = ?', [entryId]);
    } else {
      // Soft delete: set deleted_at and release the location
      await this.db.runAsync(
        `UPDATE entries SET
          deleted_at = ?,
          location_id = NULL,
          synced = 0,
          sync_action = 'delete'
        WHERE entry_id = ?`,
        [now, entryId]
      );
    }
  }

  /**
   * Get unsynced entries
   */
  async getUnsyncedEntries(): Promise<Entry[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.getAllAsync<any>(
      'SELECT * FROM entries WHERE synced = 0 AND local_only = 0 ORDER BY updated_at ASC'
    );

    return rows.map(row => this.rowToEntry(row));
  }

  /**
   * Mark entry as synced
   */
  async markSynced(entryId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const entry = await this.getEntry(entryId);

    if (entry && entry.sync_action === 'delete') {
      await this.db.runAsync('DELETE FROM entries WHERE entry_id = ?', [entryId]);
    } else {
      await this.db.runAsync(
        `UPDATE entries SET
          synced = 1,
          sync_action = NULL,
          sync_error = NULL,
          sync_retry_count = 0
        WHERE entry_id = ?`,
        [entryId]
      );
    }
  }

  /**
   * Record sync error
   */
  async recordSyncError(entryId: string, error: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `UPDATE entries SET
        sync_error = ?,
        sync_retry_count = sync_retry_count + 1,
        sync_last_attempt = ?
      WHERE entry_id = ?`,
      [error, Date.now(), entryId]
    );
  }

  /**
   * Get count of unsynced entries
   */
  async getUnsyncedCount(): Promise<number> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM entries WHERE synced = 0 AND local_only = 0'
    );

    return result?.count || 0;
  }

  /**
   * Get entry counts for navigation display
   * Returns total entries and entries with no stream - fast COUNT queries
   * "Total" count excludes entries from private streams (same as "All Entries" view)
   */
  async getEntryCounts(): Promise<{ total: number; noStream: number; hasPlace: number; noPlace: number }> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const privateStreamExclusion = `AND (stream_id IS NULL OR stream_id NOT IN (
           SELECT stream_id FROM streams WHERE is_private = 1 AND (sync_action IS NULL OR sync_action != 'delete')
         ))`;

    const [totalResult, noStreamResult, hasPlaceResult, noPlaceResult] = await Promise.all([
      // Total count excludes private streams - same filtering as getAllEntries with excludePrivateStreams=true
      this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM entries
         WHERE deleted_at IS NULL
         ${privateStreamExclusion}`
      ),
      // Unassigned count - entries with no stream are never private
      this.db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) as count FROM entries WHERE deleted_at IS NULL AND stream_id IS NULL'
      ),
      // Has place - entries with any GPS coordinates (excludes private streams)
      this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM entries
         WHERE deleted_at IS NULL AND entry_latitude IS NOT NULL
         ${privateStreamExclusion}`
      ),
      // No place - entries without any location data (excludes private streams)
      this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM entries
         WHERE deleted_at IS NULL
         AND country IS NULL AND region IS NULL AND city IS NULL AND neighborhood IS NULL AND place_name IS NULL AND entry_latitude IS NULL
         ${privateStreamExclusion}`
      ),
    ]);

    return {
      total: totalResult?.count || 0,
      noStream: noStreamResult?.count || 0,
      hasPlace: hasPlaceResult?.count || 0,
      noPlace: noPlaceResult?.count || 0,
    };
  }

  /**
   * Convert database row to Entry object
   */
  private rowToEntry(row: any): Entry {
    return {
      entry_id: row.entry_id,
      user_id: row.user_id,
      title: row.title,
      content: row.content,
      tags: row.tags ? JSON.parse(row.tags) : [],
      mentions: row.mentions ? JSON.parse(row.mentions) : [],
      stream_id: row.stream_id,
      entry_date: row.entry_date ? new Date(row.entry_date).toISOString() : null,
      entry_latitude: row.entry_latitude,
      entry_longitude: row.entry_longitude,
      location_id: row.location_id,
      // Location hierarchy fields
      place_name: row.place_name || null,
      address: row.address || null,
      neighborhood: row.neighborhood || null,
      postal_code: row.postal_code || null,
      city: row.city || null,
      subdivision: row.subdivision || null,
      region: row.region || null,
      country: row.country || null,
      geocode_status: row.geocode_status || null,
      status: row.status || 'none',
      type: row.type || null,
      due_date: row.due_date ? new Date(row.due_date).toISOString() : null,
      completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
      deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
      attachments: null,
      priority: row.priority !== undefined ? row.priority : 0,
      rating: row.rating !== undefined ? row.rating : 0.00,
      is_pinned: row.is_pinned === 1,
      is_archived: row.is_archived === 1,
      local_only: row.local_only,
      synced: row.synced,
      sync_action: row.sync_action,
      sync_error: row.sync_error,
      // Version tracking fields
      version: row.version !== undefined ? row.version : 1,
      base_version: row.base_version !== undefined ? row.base_version : 1,
      conflict_status: row.conflict_status || null,
      conflict_backup: row.conflict_backup || null,
      last_edited_by: row.last_edited_by || null,
      last_edited_device: row.last_edited_device || null,
      // Computed field for photo filtering (may be undefined if not queried with subquery)
      photo_count: row.photo_count !== undefined ? row.photo_count : undefined,
    } as Entry;
  }

  // ========================================
  // LOCATION OPERATIONS
  // ========================================

  /**
   * Save a location to local database
   */
  async saveLocation(location: LocationEntity): Promise<LocationEntity> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();

    await this.db.runAsync(
      `INSERT OR REPLACE INTO locations (
        location_id, user_id, name, latitude, longitude,
        source, address, neighborhood, postal_code, city,
        subdivision, region, country, mapbox_place_id, foursquare_fsq_id,
        merge_ignore_ids, created_at, updated_at, synced, sync_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        location.location_id,
        location.user_id,
        location.name,
        location.latitude,
        location.longitude,
        location.source || null,
        location.address || null,
        location.neighborhood || null,
        location.postal_code || null,
        location.city || null,
        location.subdivision || null,
        location.region || null,
        location.country || null,
        location.mapbox_place_id || null,
        location.foursquare_fsq_id || null,
        location.merge_ignore_ids || null,
        location.created_at ? Date.parse(location.created_at) : now,
        location.updated_at ? Date.parse(location.updated_at) : now,
        location.synced !== undefined ? location.synced : 0,
        location.sync_action !== undefined ? location.sync_action : 'create'
      ]
    );

    return this.getLocation(location.location_id) as Promise<LocationEntity>;
  }

  /**
   * Get a single location by ID
   */
  async getLocation(locationId: string): Promise<LocationEntity | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM locations WHERE location_id = ?';
    const params: any[] = [locationId];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    const row = await this.db.getFirstAsync<any>(query, params);

    if (!row) return null;

    return this.rowToLocation(row);
  }

  /**
   * Get all locations for current user
   */
  async getAllLocations(): Promise<LocationEntity[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM locations WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    query += ' ORDER BY name ASC';

    const rows = await this.db.getAllAsync<any>(query, params);

    return rows.map(row => this.rowToLocation(row));
  }

  /**
   * Get locations with entry counts
   */
  async getLocationsWithCounts(): Promise<Array<LocationEntity & { entry_count: number }>> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = `
      SELECT l.*, COUNT(e.entry_id) as entry_count
      FROM locations l
      LEFT JOIN entries e ON l.location_id = e.location_id AND e.deleted_at IS NULL
      WHERE l.deleted_at IS NULL
    `;
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' AND l.user_id = ?';
      params.push(this.currentUserId);
    }

    query += ' GROUP BY l.location_id ORDER BY entry_count DESC, l.name ASC';

    const rows = await this.db.getAllAsync<any>(query, params);

    return rows.map(row => ({
      ...this.rowToLocation(row),
      entry_count: row.entry_count || 0
    }));
  }

  /**
   * Get entry-only location groups — entries with GPS but no saved location
   * Groups by city/region/country, returns counts and average coordinates
   */
  async getEntryOnlyLocationGroups(): Promise<Array<{
    city: string | null;
    region: string | null;
    country: string | null;
    entry_count: number;
    avg_latitude: number;
    avg_longitude: number;
    has_ungeocoded: boolean;
  }>> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = `
      SELECT
        city, region, country,
        COUNT(*) as entry_count,
        AVG(entry_latitude) as avg_latitude,
        AVG(entry_longitude) as avg_longitude,
        SUM(CASE WHEN geocode_status IS NULL THEN 1 ELSE 0 END) as ungeocoded_count
      FROM entries
      WHERE location_id IS NULL
        AND entry_latitude IS NOT NULL
        AND deleted_at IS NULL
    `;
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    query += ' GROUP BY city, region, country ORDER BY entry_count DESC';

    const rows = await this.db.getAllAsync<any>(query, params);

    return rows.map(row => ({
      city: row.city || null,
      region: row.region || null,
      country: row.country || null,
      entry_count: row.entry_count || 0,
      avg_latitude: row.avg_latitude || 0,
      avg_longitude: row.avg_longitude || 0,
      has_ungeocoded: (row.ungeocoded_count || 0) > 0,
    }));
  }

  /**
   * Get entry-derived places — ALL entries grouped by place_name + address
   * Uses denormalized entry data directly (not the locations table).
   * This is the universal view of places across all entries regardless of location_id.
   */
  async getEntryDerivedPlaces(): Promise<Array<{
    place_name: string | null;
    address: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
    entry_count: number;
    avg_latitude: number;
    avg_longitude: number;
    is_favorite: boolean;
    location_id: string | null;
    ungeocoded_count: number;
  }>> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const params: any[] = [];
    if (this.currentUserId) params.push(this.currentUserId); // entries query
    if (this.currentUserId) params.push(this.currentUserId); // locations query

    const query = `
      SELECT place_name, address, city, region, country, entry_count, avg_latitude, avg_longitude, is_favorite, location_id, ungeocoded_count
      FROM (
        -- Entry-derived places (grouped by place fields)
        SELECT
          place_name, address, city, region, country,
          COUNT(*) as entry_count,
          AVG(entry_latitude) as avg_latitude,
          AVG(entry_longitude) as avg_longitude,
          MAX(CASE WHEN location_id IS NOT NULL THEN 1 ELSE 0 END) as is_favorite,
          MAX(location_id) as location_id,
          SUM(CASE WHEN geocode_status IS NULL OR geocode_status = 'error' THEN 1 ELSE 0 END) as ungeocoded_count
        FROM entries
        WHERE (place_name IS NOT NULL OR city IS NOT NULL)
          AND deleted_at IS NULL
          ${this.currentUserId ? 'AND user_id = ?' : ''}
        GROUP BY COALESCE(place_name, ''), COALESCE(address, ''), city, region, country

        UNION ALL

        -- Saved locations with 0 entries (not represented in entries table)
        SELECT
          l.name as place_name,
          l.address,
          l.city,
          l.region,
          l.country,
          0 as entry_count,
          l.latitude as avg_latitude,
          l.longitude as avg_longitude,
          1 as is_favorite,
          l.location_id,
          0 as ungeocoded_count
        FROM locations l
        WHERE l.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM entries e
          WHERE e.location_id = l.location_id
            AND e.deleted_at IS NULL
        )
        ${this.currentUserId ? 'AND l.user_id = ?' : ''}
      )
      ORDER BY entry_count DESC`;

    const rows = await this.db.getAllAsync<any>(query, params);

    return rows.map(row => ({
      place_name: row.place_name || null,
      address: row.address || null,
      city: row.city || null,
      region: row.region || null,
      country: row.country || null,
      entry_count: row.entry_count || 0,
      avg_latitude: row.avg_latitude || 0,
      avg_longitude: row.avg_longitude || 0,
      is_favorite: !!row.is_favorite,
      location_id: row.location_id || null,
      ungeocoded_count: row.ungeocoded_count || 0,
    }));
  }

  /**
   * Get location health counts for the health tab
   */
  async getLocationHealthCounts(): Promise<{
    missingHierarchy: number;
    duplicates: number;
    unlinkedEntries: number;
    unusedLocations: number;
  }> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const userFilter = this.currentUserId ? ' AND user_id = ?' : '';
    const userFilterAliased = this.currentUserId ? ' AND l.user_id = ?' : '';
    const userParams = this.currentUserId ? [this.currentUserId] : [];

    const [missingResult, duplicateResult, unlinkedResult, unusedResult] = await Promise.all([
      // Locations with missing hierarchy data
      this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM locations
         WHERE deleted_at IS NULL
           AND (city IS NULL OR region IS NULL OR country IS NULL)${userFilter}`,
        userParams
      ),
      // Duplicate locations (same name + address, case insensitive)
      this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM (
          SELECT LOWER(name) as n, LOWER(COALESCE(address, '')) as a
          FROM locations
          WHERE deleted_at IS NULL${userFilter}
          GROUP BY LOWER(name), LOWER(COALESCE(address, ''))
          HAVING COUNT(*) > 1
        )`,
        userParams
      ),
      // Entries with GPS that need snapping/geocoding (not yet processed)
      this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM entries
         WHERE deleted_at IS NULL
           AND entry_latitude IS NOT NULL
           AND entry_longitude IS NOT NULL
           AND (geocode_status IS NULL OR geocode_status = 'error')${userFilter}`,
        userParams
      ),
      // Locations not referenced by any entry
      this.db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM locations l
         LEFT JOIN entries e ON l.location_id = e.location_id AND e.deleted_at IS NULL
         WHERE l.deleted_at IS NULL
           AND e.entry_id IS NULL${userFilterAliased}`,
        userParams
      ),
    ]);

    return {
      missingHierarchy: missingResult?.count ?? 0,
      duplicates: duplicateResult?.count ?? 0,
      unlinkedEntries: unlinkedResult?.count ?? 0,
      unusedLocations: unusedResult?.count ?? 0,
    };
  }

  /**
   * Update a location
   */
  async updateLocation(locationId: string, updates: Partial<LocationEntity>): Promise<LocationEntity> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const existing = await this.getLocation(locationId);
    if (!existing) throw new Error('Location not found');

    const now = Date.now();
    const updatedAt = updates.updated_at !== undefined
      ? (typeof updates.updated_at === 'string' ? Date.parse(updates.updated_at) : updates.updated_at)
      : now;

    await this.db.runAsync(
      `UPDATE locations SET
        name = ?, latitude = ?, longitude = ?,
        source = ?, address = ?, neighborhood = ?, postal_code = ?,
        city = ?, subdivision = ?, region = ?, country = ?,
        mapbox_place_id = ?, foursquare_fsq_id = ?, merge_ignore_ids = ?,
        updated_at = ?, synced = ?, sync_action = ?
      WHERE location_id = ?`,
      [
        updates.name !== undefined ? updates.name : existing.name,
        updates.latitude !== undefined ? updates.latitude : existing.latitude,
        updates.longitude !== undefined ? updates.longitude : existing.longitude,
        updates.source !== undefined ? updates.source : existing.source,
        updates.address !== undefined ? updates.address : existing.address,
        updates.neighborhood !== undefined ? updates.neighborhood : existing.neighborhood,
        updates.postal_code !== undefined ? updates.postal_code : existing.postal_code,
        updates.city !== undefined ? updates.city : existing.city,
        updates.subdivision !== undefined ? updates.subdivision : existing.subdivision,
        updates.region !== undefined ? updates.region : existing.region,
        updates.country !== undefined ? updates.country : existing.country,
        updates.mapbox_place_id !== undefined ? updates.mapbox_place_id : existing.mapbox_place_id,
        updates.foursquare_fsq_id !== undefined ? updates.foursquare_fsq_id : existing.foursquare_fsq_id,
        updates.merge_ignore_ids !== undefined ? updates.merge_ignore_ids : existing.merge_ignore_ids || null,
        updatedAt,
        updates.synced !== undefined ? updates.synced : 0,
        updates.sync_action !== undefined ? updates.sync_action : 'update',
        locationId
      ]
    );

    return this.getLocation(locationId) as Promise<LocationEntity>;
  }

  /**
   * Delete a location (soft delete)
   */
  async deleteLocation(locationId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();

    await this.db.runAsync(
      `UPDATE locations SET
        deleted_at = ?,
        synced = 0,
        sync_action = 'delete'
      WHERE location_id = ?`,
      [now, locationId]
    );
  }

  /**
   * Get unsynced locations
   */
  async getUnsyncedLocations(): Promise<LocationEntity[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.getAllAsync<any>(
      'SELECT * FROM locations WHERE synced = 0 ORDER BY updated_at ASC'
    );

    return rows.map(row => this.rowToLocation(row));
  }

  /**
   * Record location sync error
   */
  async recordLocationSyncError(locationId: string, error: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `UPDATE locations SET
        sync_error = ?
      WHERE location_id = ?`,
      [error, locationId]
    );
  }

  /**
   * Mark location as synced
   */
  async markLocationSynced(locationId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const location = await this.getLocation(locationId);

    if (location && location.sync_action === 'delete') {
      await this.db.runAsync('DELETE FROM locations WHERE location_id = ?', [locationId]);
    } else {
      await this.db.runAsync(
        `UPDATE locations SET
          synced = 1,
          sync_action = NULL,
          sync_error = NULL
        WHERE location_id = ?`,
        [locationId]
      );
    }
  }

  /**
   * Convert database row to LocationEntity
   */
  private rowToLocation(row: any): LocationEntity {
    return {
      location_id: row.location_id,
      user_id: row.user_id,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      source: row.source,
      address: row.address,
      neighborhood: row.neighborhood,
      postal_code: row.postal_code,
      city: row.city,
      subdivision: row.subdivision,
      region: row.region,
      country: row.country,
      mapbox_place_id: row.mapbox_place_id,
      foursquare_fsq_id: row.foursquare_fsq_id,
      merge_ignore_ids: row.merge_ignore_ids || null,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
      deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
      synced: row.synced,
      sync_action: row.sync_action,
    };
  }

  // ========================================
  // STREAM OPERATIONS
  // ========================================

  /**
   * Get all streams
   */
  async getAllStreams(): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = `
      SELECT
        s.*,
        COALESCE(COUNT(e.entry_id), 0) as entry_count,
        MAX(e.updated_at) as last_entry_updated_at
      FROM streams s
      LEFT JOIN entries e ON s.stream_id = e.stream_id
        AND (e.deleted_at IS NULL OR e.deleted_at = '')
    `;

    const params: any[] = [];

    if (this.currentUserId) {
      query += ` WHERE (s.sync_action IS NULL OR s.sync_action != 'delete')
        AND s.user_id = ?`;
      params.push(this.currentUserId);
    } else {
      query += ` WHERE s.sync_action IS NULL OR s.sync_action != 'delete'`;
    }

    query += `
      GROUP BY s.stream_id
      ORDER BY s.name
    `;

    const rows = await this.db.getAllAsync<any>(query, params);

    // Convert SQLite integer booleans (0/1) to proper booleans and parse JSON arrays
    return rows.map(row => {
      // Parse entry_statuses JSON array
      // Handle double-escaped JSON (e.g., "[\"new\"]" -> ["new"])
      let entryStatuses: string[] = ['new', 'todo', 'in_progress', 'done'];
      if (row.entry_statuses) {
        try {
          let parsed = JSON.parse(row.entry_statuses);
          // If result is still a string (double-escaped), parse again
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }
          if (Array.isArray(parsed)) {
            entryStatuses = parsed;
          }
        } catch (e) {
          log.warn('Failed to parse entry_statuses', { error: e });
        }
      }

      // Parse entry_types JSON array
      let entryTypes: string[] = [];
      if (row.entry_types) {
        try {
          let parsed = JSON.parse(row.entry_types);
          // If result is still a string (double-escaped), parse again
          if (typeof parsed === 'string') {
            parsed = JSON.parse(parsed);
          }
          if (Array.isArray(parsed)) {
            entryTypes = parsed;
          }
        } catch (e) {
          log.warn('Failed to parse entry_types', { error: e });
        }
      }

      return {
        ...row,
        entry_use_rating: !!row.entry_use_rating,
        entry_rating_type: row.entry_rating_type || 'stars',
        entry_use_priority: !!row.entry_use_priority,
        entry_use_status: !!row.entry_use_status,
        entry_use_duedates: !!row.entry_use_duedates,
        entry_use_location: !!row.entry_use_location,
        entry_use_photos: !!row.entry_use_photos,
        entry_use_type: !!row.entry_use_type,
        is_private: !!row.is_private,
        is_localonly: !!row.is_localonly,
        entry_statuses: entryStatuses,
        entry_default_status: row.entry_default_status || 'new',
        entry_types: entryTypes,
      };
    });
  }

  /**
   * Get a single stream by ID
   */
  async getStream(streamId: string): Promise<any | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const row = await this.db.getFirstAsync<any>(
      `SELECT
        s.*,
        COALESCE(COUNT(e.entry_id), 0) as entry_count
      FROM streams s
      LEFT JOIN entries e ON s.stream_id = e.stream_id
        AND (e.deleted_at IS NULL OR e.deleted_at = '')
      WHERE s.stream_id = ?
      GROUP BY s.stream_id`,
      [streamId]
    );

    if (!row) return null;

    // Parse entry_statuses JSON array
    // Handle double-escaped JSON (e.g., "[\"new\"]" -> ["new"])
    let entryStatuses: string[] = ['new', 'todo', 'in_progress', 'done'];
    if (row.entry_statuses) {
      try {
        let parsed = JSON.parse(row.entry_statuses);
        // If result is still a string (double-escaped), parse again
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
        if (Array.isArray(parsed)) {
          entryStatuses = parsed;
        }
      } catch (e) {
        log.warn('Failed to parse entry_statuses', { error: e });
      }
    }

    // Parse entry_types JSON array
    let entryTypes: string[] = [];
    if (row.entry_types) {
      try {
        let parsed = JSON.parse(row.entry_types);
        // If result is still a string (double-escaped), parse again
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
        if (Array.isArray(parsed)) {
          entryTypes = parsed;
        }
      } catch (e) {
        log.warn('Failed to parse entry_types', { error: e });
      }
    }

    // Convert SQLite integer booleans (0/1) to proper booleans
    return {
      ...row,
      entry_use_rating: !!row.entry_use_rating,
      entry_rating_type: row.entry_rating_type || 'stars',
      entry_use_priority: !!row.entry_use_priority,
      entry_use_status: !!row.entry_use_status,
      entry_use_duedates: !!row.entry_use_duedates,
      entry_use_location: !!row.entry_use_location,
      entry_use_photos: !!row.entry_use_photos,
      entry_use_type: !!row.entry_use_type,
      is_private: !!row.is_private,
      is_localonly: !!row.is_localonly,
      entry_statuses: entryStatuses,
      entry_default_status: row.entry_default_status || 'new',
      entry_types: entryTypes,
    };
  }

  /**
   * Save a stream
   */
  async saveStream(stream: any): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // Serialize entry_statuses to JSON string
    // Handle: array (from Supabase), string (from local DB read), or undefined
    let entryStatusesJson = '["new","todo","in_progress","done"]';
    if (Array.isArray(stream.entry_statuses)) {
      entryStatusesJson = JSON.stringify(stream.entry_statuses);
    } else if (typeof stream.entry_statuses === 'string' && stream.entry_statuses.startsWith('[')) {
      // Already a JSON string - use as-is
      entryStatusesJson = stream.entry_statuses;
    }

    // Serialize entry_types to JSON string
    let entryTypesJson = '[]';
    if (Array.isArray(stream.entry_types)) {
      entryTypesJson = JSON.stringify(stream.entry_types);
    } else if (typeof stream.entry_types === 'string' && stream.entry_types.startsWith('[')) {
      // Already a JSON string - use as-is
      entryTypesJson = stream.entry_types;
    }

    await this.db.runAsync(
      `INSERT OR REPLACE INTO streams (
        stream_id, user_id, name, entry_count, color, icon,
        entry_title_template, entry_content_template,
        entry_use_rating, entry_rating_type, entry_use_priority, entry_use_status,
        entry_use_duedates, entry_use_location, entry_use_photos,
        entry_content_type, entry_statuses, entry_default_status,
        entry_use_type, entry_types,
        is_private, is_localonly,
        created_at, updated_at, synced, sync_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stream.stream_id,
        stream.user_id,
        stream.name,
        stream.entry_count || 0,
        stream.color || null,
        stream.icon || null,
        stream.entry_title_template || null,
        stream.entry_content_template || null,
        stream.entry_use_rating ? 1 : 0,
        stream.entry_rating_type || 'stars',
        stream.entry_use_priority ? 1 : 0,
        stream.entry_use_status !== false ? 1 : 0,
        stream.entry_use_duedates ? 1 : 0,
        stream.entry_use_location !== false ? 1 : 0,
        stream.entry_use_photos !== false ? 1 : 0,
        stream.entry_content_type || 'richformat',
        entryStatusesJson,
        stream.entry_default_status || 'new',
        stream.entry_use_type ? 1 : 0,
        entryTypesJson,
        stream.is_private ? 1 : 0,
        stream.is_localonly ? 1 : 0,
        Date.parse(stream.created_at),
        Date.parse(stream.updated_at || stream.created_at),
        0,
        'create'
      ]
    );
  }

  /**
   * Update a stream
   */
  async updateStream(streamId: string, updates: any): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();

    // Build dynamic SET clause - only update fields that are provided
    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.color !== undefined) {
      setClauses.push('color = ?');
      values.push(updates.color || null);
    }
    if (updates.icon !== undefined) {
      setClauses.push('icon = ?');
      values.push(updates.icon || null);
    }
    if (updates.entry_title_template !== undefined) {
      setClauses.push('entry_title_template = ?');
      values.push(updates.entry_title_template);
    }
    if (updates.entry_content_template !== undefined) {
      setClauses.push('entry_content_template = ?');
      values.push(updates.entry_content_template);
    }
    if (updates.entry_use_rating !== undefined) {
      setClauses.push('entry_use_rating = ?');
      values.push(updates.entry_use_rating ? 1 : 0);
    }
    if (updates.entry_rating_type !== undefined) {
      setClauses.push('entry_rating_type = ?');
      values.push(updates.entry_rating_type || 'stars');
    }
    if (updates.entry_use_priority !== undefined) {
      setClauses.push('entry_use_priority = ?');
      values.push(updates.entry_use_priority ? 1 : 0);
    }
    if (updates.entry_use_status !== undefined) {
      setClauses.push('entry_use_status = ?');
      values.push(updates.entry_use_status ? 1 : 0);
    }
    if (updates.entry_use_duedates !== undefined) {
      setClauses.push('entry_use_duedates = ?');
      values.push(updates.entry_use_duedates ? 1 : 0);
    }
    if (updates.entry_use_location !== undefined) {
      setClauses.push('entry_use_location = ?');
      values.push(updates.entry_use_location ? 1 : 0);
    }
    if (updates.entry_use_photos !== undefined) {
      setClauses.push('entry_use_photos = ?');
      values.push(updates.entry_use_photos ? 1 : 0);
    }
    if (updates.entry_content_type !== undefined) {
      setClauses.push('entry_content_type = ?');
      values.push(updates.entry_content_type);
    }
    if (updates.entry_statuses !== undefined) {
      setClauses.push('entry_statuses = ?');
      // Handle: array (from UI), string (from sync), or other
      if (Array.isArray(updates.entry_statuses)) {
        values.push(JSON.stringify(updates.entry_statuses));
      } else if (typeof updates.entry_statuses === 'string' && updates.entry_statuses.startsWith('[')) {
        // Already a JSON string - use as-is
        values.push(updates.entry_statuses);
      } else {
        values.push('["new","todo","in_progress","done"]');
      }
    }
    if (updates.entry_default_status !== undefined) {
      setClauses.push('entry_default_status = ?');
      values.push(updates.entry_default_status);
    }
    if (updates.entry_use_type !== undefined) {
      setClauses.push('entry_use_type = ?');
      values.push(updates.entry_use_type ? 1 : 0);
    }
    if (updates.entry_types !== undefined) {
      setClauses.push('entry_types = ?');
      // Handle: array (from UI), string (from sync), or other
      if (Array.isArray(updates.entry_types)) {
        values.push(JSON.stringify(updates.entry_types));
      } else if (typeof updates.entry_types === 'string' && updates.entry_types.startsWith('[')) {
        // Already a JSON string - use as-is
        values.push(updates.entry_types);
      } else {
        values.push('[]');
      }
    }
    if (updates.is_private !== undefined) {
      setClauses.push('is_private = ?');
      values.push(updates.is_private ? 1 : 0);
    }
    if (updates.is_localonly !== undefined) {
      setClauses.push('is_localonly = ?');
      values.push(updates.is_localonly ? 1 : 0);
    }

    // Always update timestamp and sync status
    setClauses.push('updated_at = ?');
    values.push(updates.updated_at !== undefined
      ? (typeof updates.updated_at === 'string' ? Date.parse(updates.updated_at) : updates.updated_at)
      : now);

    setClauses.push('synced = ?');
    values.push(updates.synced !== undefined ? updates.synced : 0);

    setClauses.push('sync_action = ?');
    values.push(updates.sync_action !== undefined ? updates.sync_action : 'update');

    // Add streamId for WHERE clause
    values.push(streamId);

    await this.db.runAsync(
      `UPDATE streams SET ${setClauses.join(', ')} WHERE stream_id = ?`,
      values
    );
  }

  /**
   * Delete a stream (moves entries to Uncategorized)
   */
  async deleteStream(streamId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const stream = await this.getStream(streamId);
    if (!stream) return;

    // Move entries to Uncategorized (null stream_id)
    await this.db.runAsync(
      `UPDATE entries
       SET stream_id = NULL, synced = 0
       WHERE stream_id = ?`,
      [streamId]
    );

    // Mark for deletion
    await this.db.runAsync(
      `UPDATE streams SET synced = 0, sync_action = 'delete' WHERE stream_id = ?`,
      [streamId]
    );
  }

  /**
   * Get unsynced streams
   */
  async getUnsyncedStreams(): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.getAllAsync<any>(
      'SELECT * FROM streams WHERE synced = 0'
    );

    return rows;
  }

  /**
   * Mark stream as synced
   */
  async markStreamSynced(streamId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const stream = await this.getStream(streamId);

    if (stream && stream.sync_action === 'delete') {
      await this.db.runAsync('DELETE FROM streams WHERE stream_id = ?', [streamId]);
    } else {
      await this.db.runAsync(
        `UPDATE streams SET
          synced = 1,
          sync_action = NULL,
          sync_error = NULL
        WHERE stream_id = ?`,
        [streamId]
      );
    }
  }

  /**
   * Record stream sync error
   */
  async recordStreamSyncError(streamId: string, error: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `UPDATE streams SET
        sync_error = ?
      WHERE stream_id = ?`,
      [error, streamId]
    );
  }

  // ========================================
  // TAG AND MENTION OPERATIONS
  // ========================================

  /**
   * Get all unique tags with entry counts
   */
  async getAllTags(): Promise<Array<{ tag: string; count: number }>> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.getAllAsync<any>(
      `SELECT tags FROM entries
       WHERE tags IS NOT NULL
       AND tags != '[]'
       AND deleted_at IS NULL`
    );

    const tagCounts = new Map<string, number>();

    rows.forEach(row => {
      if (row.tags) {
        try {
          const tags: string[] = JSON.parse(row.tags);
          tags.forEach(tag => {
            const lowerTag = tag.toLowerCase();
            tagCounts.set(lowerTag, (tagCounts.get(lowerTag) || 0) + 1);
          });
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.tag.localeCompare(b.tag);
      });
  }

  /**
   * Get all unique mentions with entry counts
   */
  async getAllMentions(): Promise<Array<{ mention: string; count: number }>> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.getAllAsync<any>(
      `SELECT mentions FROM entries
       WHERE mentions IS NOT NULL
       AND mentions != '[]'
       AND deleted_at IS NULL`
    );

    const mentionCounts = new Map<string, number>();

    rows.forEach(row => {
      if (row.mentions) {
        try {
          const mentions: string[] = JSON.parse(row.mentions);
          mentions.forEach(mention => {
            const lowerMention = mention.toLowerCase();
            mentionCounts.set(lowerMention, (mentionCounts.get(lowerMention) || 0) + 1);
          });
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    return Array.from(mentionCounts.entries())
      .map(([mention, count]) => ({ mention, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        return a.mention.localeCompare(b.mention);
      });
  }

  // ========================================
  // SYNC LOG OPERATIONS
  // ========================================

  /**
   * Add a sync log entry
   */
  async addSyncLog(
    logLevel: 'info' | 'warning' | 'error',
    operation: string,
    message: string,
    details?: {
      entries_pushed?: number;
      entries_errors?: number;
      streams_pushed?: number;
      streams_errors?: number;
      attachments_pushed?: number;
      attachments_errors?: number;
      entries_pulled?: number;
    }
  ): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT INTO sync_logs (
        timestamp, log_level, operation, message,
        entries_pushed, entries_errors, streams_pushed, streams_errors, entries_pulled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Date.now(),
        logLevel,
        operation,
        message,
        details?.entries_pushed || 0,
        details?.entries_errors || 0,
        details?.streams_pushed || 0,
        details?.streams_errors || 0,
        details?.entries_pulled || 0,
      ]
    );

    await this.cleanupOldSyncLogs();
  }

  /**
   * Get recent sync logs
   */
  async getSyncLogs(limit: number = 100): Promise<Array<{
    id: number;
    timestamp: number;
    log_level: 'info' | 'warning' | 'error';
    operation: string;
    message: string;
    entries_pushed: number;
    entries_errors: number;
    streams_pushed: number;
    streams_errors: number;
    entries_pulled: number;
  }>> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const logs = await this.db.getAllAsync<any>(
      'SELECT * FROM sync_logs ORDER BY timestamp DESC LIMIT ?',
      [limit]
    );

    return logs;
  }

  /**
   * Clean up sync logs older than 7 days
   */
  async cleanupOldSyncLogs(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    await this.db.runAsync(
      'DELETE FROM sync_logs WHERE timestamp < ?',
      [sevenDaysAgo]
    );
  }

  // ========================================
  // ATTACHMENT OPERATIONS
  // ========================================

  /**
   * Create a new attachment record
   * @param attachment - Attachment data
   * @param fromSync - If true, attachment is from cloud sync (already synced, no sync_action needed)
   */
  async createAttachment(attachment: {
    attachment_id: string;
    entry_id: string;
    user_id: string;
    file_path: string;
    local_path?: string;
    mime_type: string;
    file_size?: number;
    width?: number;
    height?: number;
    position: number;
    uploaded?: boolean;
    created_at?: number;
    updated_at?: number;
  }, fromSync: boolean = false): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();

    await this.db.runAsync(
      `INSERT INTO attachments (
        attachment_id, entry_id, user_id, file_path, local_path,
        mime_type, file_size, width, height, position,
        created_at, updated_at, uploaded, synced, sync_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attachment.attachment_id,
        attachment.entry_id,
        attachment.user_id,
        attachment.file_path,
        attachment.local_path || null,
        attachment.mime_type,
        attachment.file_size || null,
        attachment.width || null,
        attachment.height || null,
        attachment.position,
        attachment.created_at || now,
        attachment.updated_at || now,
        attachment.uploaded ? 1 : 0,
        fromSync ? 1 : 0,           // If from sync, mark as synced
        fromSync ? null : 'create', // If from sync, no sync action needed
      ]
    );

    log.debug('Attachment created', { attachmentId: attachment.attachment_id, fromSync });
  }

  /**
   * Get all attachments for an entry
   */
  async getAttachmentsForEntry(entryId: string): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM attachments WHERE entry_id = ? AND (sync_action IS NULL OR sync_action != ?)';
    const params: any[] = [entryId, 'delete'];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    query += ' ORDER BY position ASC';

    const attachments = await this.db.getAllAsync<any>(query, params);
    return attachments;
  }

  /**
   * Get all attachments for multiple entries (bulk query)
   * More efficient than calling getAttachmentsForEntry multiple times
   */
  async getAttachmentsForEntries(entryIds: string[]): Promise<Attachment[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // Return empty array if no entry IDs provided
    if (!entryIds || entryIds.length === 0) {
      return [];
    }

    // SQLite has a limit on the number of variables in a single query.
    // Batch into chunks of 500 to avoid hitting the limit with large entry sets.
    const BATCH_SIZE = 500;
    const allAttachments: Attachment[] = [];

    for (let i = 0; i < entryIds.length; i += BATCH_SIZE) {
      const batch = entryIds.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => '?').join(', ');

      let query = `SELECT * FROM attachments WHERE entry_id IN (${placeholders}) AND (sync_action IS NULL OR sync_action != ?)`;
      const params: (string | number)[] = [...batch, 'delete'];

      if (this.currentUserId) {
        query += ' AND user_id = ?';
        params.push(this.currentUserId);
      }

      query += ' ORDER BY entry_id, position ASC';

      const attachments = await this.db.getAllAsync<Attachment>(query, params);
      allAttachments.push(...attachments);
    }

    return allAttachments;
  }

  /**
   * Get a single attachment by ID
   */
  async getAttachment(attachmentId: string): Promise<Attachment | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM attachments WHERE attachment_id = ?';
    const params: (string | number)[] = [attachmentId];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    const attachment = await this.db.getFirstAsync<Attachment>(query, params);
    return attachment || null;
  }

  /**
   * Update an attachment
   */
  async updateAttachment(attachmentId: string, updates: Partial<{
    file_path: string;
    local_path: string;
    file_size: number;
    width: number;
    height: number;
    position: number;
    uploaded: boolean;
    synced: number;
    sync_action: string | null;
  }>): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.file_path !== undefined) {
      fields.push('file_path = ?');
      values.push(updates.file_path);
    }
    if (updates.local_path !== undefined) {
      fields.push('local_path = ?');
      values.push(updates.local_path);
    }
    if (updates.file_size !== undefined) {
      fields.push('file_size = ?');
      values.push(updates.file_size);
    }
    if (updates.width !== undefined) {
      fields.push('width = ?');
      values.push(updates.width);
    }
    if (updates.height !== undefined) {
      fields.push('height = ?');
      values.push(updates.height);
    }
    if (updates.position !== undefined) {
      fields.push('position = ?');
      values.push(updates.position);
    }
    if (updates.uploaded !== undefined) {
      fields.push('uploaded = ?');
      values.push(updates.uploaded ? 1 : 0);
    }
    if (updates.synced !== undefined) {
      fields.push('synced = ?');
      values.push(updates.synced);
    }
    if (updates.sync_action !== undefined) {
      fields.push('sync_action = ?');
      values.push(updates.sync_action);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(Date.now());

    values.push(attachmentId);

    const sql = `UPDATE attachments SET ${fields.join(', ')} WHERE attachment_id = ?`;
    await this.db.runAsync(sql, values);

    log.debug('Attachment updated', { attachmentId });
  }

  /**
   * Update entry_id for all attachments
   */
  async updateAttachmentEntryIds(oldEntryId: string, newEntryId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    log.debug('updateAttachmentEntryIds', { oldEntryId, newEntryId });

    const attachments = await this.db.getAllAsync<any>(
      'SELECT attachment_id, file_path, local_path FROM attachments WHERE entry_id = ?',
      [oldEntryId]
    );

    log.debug('Found attachments to update', { count: attachments.length });

    if (attachments.length === 0) return;

    const FileSystem = await import('expo-file-system/legacy');

    for (const attachment of attachments) {
      log.debug('Processing attachment', { attachmentId: attachment.attachment_id, oldPath: attachment.local_path });

      const newFilePath = attachment.file_path.replace(oldEntryId, newEntryId);
      let newLocalPath = attachment.local_path ? attachment.local_path.replace(oldEntryId, newEntryId) : null;

      if (attachment.local_path && newLocalPath) {
        try {
          const oldFileInfo = await FileSystem.getInfoAsync(attachment.local_path);

          if (oldFileInfo.exists) {
            const newDir = newLocalPath.substring(0, newLocalPath.lastIndexOf('/'));
            await FileSystem.makeDirectoryAsync(newDir, { intermediates: true });

            await FileSystem.moveAsync({
              from: attachment.local_path,
              to: newLocalPath,
            });

            log.debug('Moved attachment file successfully', { attachmentId: attachment.attachment_id, newPath: newLocalPath });
          } else {
            log.warn('Old file does not exist', { path: attachment.local_path });
          }
        } catch (error) {
          log.error('Failed to move attachment file', error, { attachmentId: attachment.attachment_id });
        }
      }

      await this.db.runAsync(
        'UPDATE attachments SET entry_id = ?, file_path = ?, local_path = ?, synced = 0 WHERE attachment_id = ?',
        [newEntryId, newFilePath, newLocalPath, attachment.attachment_id]
      );
      log.debug('Updated database for attachment', { attachmentId: attachment.attachment_id });
    }

    log.debug('Finished updating attachments', { count: attachments.length });
  }

  /**
   * Delete an attachment
   */
  async deleteAttachment(attachmentId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'UPDATE attachments SET sync_action = ?, synced = 0 WHERE attachment_id = ?',
      ['delete', attachmentId]
    );

    log.debug('Attachment marked for deletion', { attachmentId });
  }

  /**
   * Permanently delete an attachment
   */
  async permanentlyDeleteAttachment(attachmentId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync('DELETE FROM attachments WHERE attachment_id = ?', [attachmentId]);
    log.debug('Attachment permanently deleted', { attachmentId });
  }

  /**
   * Clean up orphaned attachments
   */
  async cleanupOrphanedAttachments(): Promise<number> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    log.debug('Searching for orphaned attachments');

    let query = 'SELECT * FROM attachments WHERE sync_action IS NULL OR sync_action != ?';
    const params: any[] = ['delete'];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    const attachments = await this.db.getAllAsync<any>(query, params);
    let orphanCount = 0;

    for (const attachment of attachments) {
      const entry = await this.getEntry(attachment.entry_id);

      if (!entry || entry.deleted_at) {
        log.debug('Found orphaned attachment', { attachmentId: attachment.attachment_id, entryId: attachment.entry_id, reason: !entry ? 'not found' : 'deleted' });
        await this.deleteAttachment(attachment.attachment_id);
        orphanCount++;
      }
    }

    if (orphanCount > 0) {
      log.info('Cleanup complete: Found and marked orphaned attachments for deletion', { count: orphanCount });
    } else {
      log.debug('No orphaned attachments found');
    }

    return orphanCount;
  }

  /**
   * Get all attachments needing upload
   */
  async getAttachmentsNeedingUpload(): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM attachments WHERE uploaded = 0';
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    query += ' ORDER BY created_at ASC';

    const attachments = await this.db.getAllAsync<any>(query, params);
    return attachments;
  }

  /**
   * Get all attachments needing sync
   */
  async getAttachmentsNeedingSync(): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = `
      SELECT a.*
      FROM attachments a
      LEFT JOIN entries e ON a.entry_id = e.entry_id
      WHERE a.synced = 0
        AND a.sync_action IS NOT NULL
        AND (e.synced = 1 OR a.sync_action = 'delete' OR e.entry_id IS NULL)
    `;
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' AND a.user_id = ?';
      params.push(this.currentUserId);
    }

    query += ' ORDER BY a.created_at ASC';

    const attachments = await this.db.getAllAsync<any>(query, params);
    return attachments;
  }

  /**
   * Get all attachments for current user
   */
  async getAllAttachments(): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM attachments';
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' WHERE user_id = ?';
      params.push(this.currentUserId);
    }

    query += ' ORDER BY created_at DESC';

    const attachments = await this.db.getAllAsync<any>(query, params);
    return attachments;
  }

  /**
   * Get attachment counts per entry (for filtering)
   * Returns a map of entry_id -> attachment count
   */
  async getEntryAttachmentCounts(): Promise<Record<string, number>> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = `
      SELECT entry_id, COUNT(*) as count
      FROM attachments
      WHERE (sync_action IS NULL OR sync_action != 'delete')
    `;
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    query += ' GROUP BY entry_id';

    const rows = await this.db.getAllAsync<{ entry_id: string; count: number }>(query, params);

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[row.entry_id] = row.count;
    }
    return counts;
  }

  // ========================================
  // UTILITY OPERATIONS
  // ========================================

  /**
   * DEBUG: Run raw SQL query
   */
  async debugQuery(sql: string): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    log.debug('Debug query', { sql });
    const result = await this.db.getAllAsync<any>(sql);
    log.debug('Debug query result', { rowCount: result.length });
    return result;
  }

  /**
   * Clear all data
   */
  async clearAllData(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      DELETE FROM attachments;
      DELETE FROM entries;
      DELETE FROM streams;
      DELETE FROM locations;
      DELETE FROM sync_metadata;
      DELETE FROM sync_logs;
    `);

    log.info('All local data cleared');
  }

  /**
   * Reset database schema - drops all tables and recreates them
   * Use this when migrations fail or schema is corrupted
   */
  async resetSchema(): Promise<void> {
    log.info('Resetting database schema');

    // Close existing connection if open
    if (this.db) {
      try {
        await this.db.closeAsync();
        log.debug('Closed existing database connection');
      } catch (e) {
        log.warn('Could not close db (may already be closed)', { error: e });
      }
      this.db = null;
    }

    // Reset init state
    this.initPromise = null;

    // Open fresh connection
    this.db = await SQLite.openDatabaseAsync('trace.db');
    log.debug('Opened fresh database connection');

    // Drop all tables one by one (more robust than multi-statement)
    const tables = ['attachments', 'photos', 'entries', 'streams', 'locations', 'sync_metadata', 'sync_logs', 'entries_new'];
    for (const table of tables) {
      try {
        await this.db.execAsync(`DROP TABLE IF EXISTS ${table};`);
        log.debug('Dropped table', { table });
      } catch (e) {
        log.warn('Could not drop table', { table, error: e });
      }
    }

    log.info('All tables dropped');

    // Close and reopen to ensure clean state
    await this.db.closeAsync();
    this.db = null;

    // Recreate tables with fresh schema via init
    await this.init();

    log.info('Database schema reset complete');
  }

  /**
   * Run custom SQL query
   */
  async runCustomQuery(sql: string, params?: any[]): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getAllAsync(sql, params || []);
    return result;
  }

  /**
   * Execute a SQL statement that does not return rows (e.g. BEGIN, COMMIT, ROLLBACK)
   */
  async execSQL(sql: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    await this.db.execAsync(sql);
  }

  /**
   * Set current user ID
   */
  setCurrentUser(userId: string): void {
    if (this.currentUserId !== userId) {
      log.debug('Switched to user', { userId });
      this.currentUserId = userId;
    }
  }

  /**
   * Clear current user
   */
  clearCurrentUser(): void {
    log.debug('Cleared current user');
    this.currentUserId = null;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }
}

// Export singleton instance
export const localDB = new LocalDatabase();
