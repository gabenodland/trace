/**
 * Local SQLite database for mobile app
 * Provides offline-first storage with background sync to Supabase
 *
 * SIMPLIFIED VERSION - No migrations, single createTables schema
 * Uses the new normalized location model with locations table
 */

import * as SQLite from 'expo-sqlite';
import { Entry, CreateEntryInput, LocationEntity, CreateLocationInput } from '@trace/core';

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

      // Log database opened
      console.log('📦 SQLite database opened: trace.db');

      // Create tables (without indexes that depend on migrated columns)
      await this.createTables();

      // Run migrations for existing databases (adds missing columns)
      await this.runMigrations();

      // Create indexes (after migrations have added any missing columns)
      await this.createIndexes();

      console.log('✅ SQLite tables and indexes created');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
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
        console.log('📦 Running migration: Adding location_id to entries table...');
        await this.db.execAsync(`ALTER TABLE entries ADD COLUMN location_id TEXT`);
        // Create index for the new column
        await this.db.execAsync(`CREATE INDEX IF NOT EXISTS idx_entries_location_id ON entries(location_id)`);
        console.log('✅ Migration complete: location_id added to entries');
      }
    } catch (error) {
      console.error('Migration error (location_id):', error);
      // Don't throw - the column might already exist or there could be other reasons
    }

    // Migration: Add priority, rating, is_pinned columns to entries table
    try {
      const priorityCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('entries') WHERE name = 'priority'`
      );

      if (!priorityCheck) {
        console.log('📦 Running migration: Adding priority, rating, is_pinned to entries table...');
        await this.db.execAsync(`
          ALTER TABLE entries ADD COLUMN priority INTEGER DEFAULT 0;
          ALTER TABLE entries ADD COLUMN rating REAL DEFAULT 0.00;
          ALTER TABLE entries ADD COLUMN is_pinned INTEGER DEFAULT 0;
        `);
        console.log('✅ Migration complete: priority, rating, is_pinned added to entries');
      }
    } catch (error) {
      console.error('Migration error (priority/rating/is_pinned):', error);
    }

    // Migration: Add locations table if it doesn't exist (should be handled by CREATE TABLE IF NOT EXISTS, but just in case)
    try {
      const result = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='locations'`
      );

      if (!result) {
        console.log('📦 Running migration: Creating locations table...');
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
        console.log('✅ Migration complete: locations table created');
      }
    } catch (error) {
      console.error('Migration error (locations table):', error);
    }

    // Migration: Add category properties columns
    try {
      const propertyCheck = await this.db.getFirstAsync<{ name: string }>(
        `SELECT name FROM pragma_table_info('categories') WHERE name = 'entry_title_template'`
      );

      if (!propertyCheck) {
        console.log('📦 Running migration: Adding category properties columns...');
        await this.db.execAsync(`
          ALTER TABLE categories ADD COLUMN entry_title_template TEXT;
          ALTER TABLE categories ADD COLUMN entry_content_template TEXT;
          ALTER TABLE categories ADD COLUMN entry_use_rating INTEGER DEFAULT 0;
          ALTER TABLE categories ADD COLUMN entry_use_priority INTEGER DEFAULT 0;
          ALTER TABLE categories ADD COLUMN entry_use_status INTEGER DEFAULT 1;
          ALTER TABLE categories ADD COLUMN entry_use_duedates INTEGER DEFAULT 0;
          ALTER TABLE categories ADD COLUMN entry_use_location INTEGER DEFAULT 1;
          ALTER TABLE categories ADD COLUMN entry_use_photos INTEGER DEFAULT 1;
          ALTER TABLE categories ADD COLUMN entry_content_type TEXT DEFAULT 'richformat';
          ALTER TABLE categories ADD COLUMN is_private INTEGER DEFAULT 0;
          ALTER TABLE categories ADD COLUMN is_localonly INTEGER DEFAULT 0;
        `);
        console.log('✅ Migration complete: category properties added');
      }
    } catch (error) {
      console.error('Migration error (category properties):', error);
    }

    // Migration: Update status CHECK constraint to include 'in_progress'
    // SQLite doesn't allow altering CHECK constraints, so we need to recreate the table
    try {
      // Check if migration is needed by looking for a marker in sync_metadata
      const migrationCheck = await this.db.getFirstAsync<{ value: string }>(
        `SELECT value FROM sync_metadata WHERE key = 'migration_status_in_progress_done'`
      );

      if (!migrationCheck) {
        console.log('📦 Running migration: Updating entries status constraint to include in_progress...');

        // Get existing column names from the entries table
        const columns = await this.db.getAllAsync<{ name: string }>(
          `SELECT name FROM pragma_table_info('entries')`
        );
        const columnNames = columns.map(c => c.name);
        console.log(`Found ${columnNames.length} columns in entries table`);

        // Define the new table columns (matching current schema)
        const newTableColumns = `
          entry_id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT,
          content TEXT NOT NULL,
          tags TEXT,
          mentions TEXT,
          category_id TEXT,
          entry_date INTEGER,
          entry_latitude REAL,
          entry_longitude REAL,
          location_accuracy REAL,
          location_id TEXT,
          status TEXT CHECK (status IN ('none', 'incomplete', 'in_progress', 'complete')) DEFAULT 'none',
          due_date INTEGER,
          completed_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          deleted_at INTEGER,
          priority INTEGER DEFAULT 0,
          rating REAL DEFAULT 0.00,
          is_pinned INTEGER DEFAULT 0,
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
          'entry_id', 'user_id', 'title', 'content', 'tags', 'mentions', 'category_id',
          'entry_date', 'entry_latitude', 'entry_longitude', 'location_accuracy', 'location_id',
          'status', 'due_date', 'completed_at', 'created_at', 'updated_at', 'deleted_at',
          'priority', 'rating', 'is_pinned', 'local_only', 'synced', 'sync_action',
          'sync_error', 'sync_retry_count', 'sync_last_attempt', 'version', 'base_version',
          'conflict_status', 'conflict_backup', 'last_edited_by', 'last_edited_device'
        ];

        // Only copy columns that exist in the old table
        const columnsToMigrate = newTableColumnNames.filter(col => columnNames.includes(col));
        const columnList = columnsToMigrate.join(', ');

        console.log(`Migrating columns: ${columnList}`);

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

        // Drop old table and rename new
        await this.db.execAsync(`
          DROP TABLE entries;
          ALTER TABLE entries_new RENAME TO entries;
        `);

        // Mark migration as done
        await this.db.execAsync(`
          INSERT OR REPLACE INTO sync_metadata (key, value, updated_at)
          VALUES ('migration_status_in_progress_done', 'true', ${Date.now()});
        `);

        console.log('✅ Migration complete: entries status constraint updated to include in_progress');
      }
    } catch (error) {
      console.error('Migration error (status in_progress constraint):', error);
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
        address TEXT,
        neighborhood TEXT,
        postal_code TEXT,
        city TEXT,
        subdivision TEXT,
        region TEXT,
        country TEXT,
        mapbox_place_id TEXT,
        foursquare_fsq_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER,           -- Soft delete
        synced INTEGER DEFAULT 0,
        sync_action TEXT
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
        category_id TEXT,
        entry_date INTEGER,           -- Unix timestamp for calendar grouping

        -- GPS coordinates (where user was when creating entry)
        entry_latitude REAL,
        entry_longitude REAL,
        location_accuracy REAL,

        -- Location reference (FK to locations table)
        location_id TEXT,

        status TEXT CHECK (status IN ('none', 'incomplete', 'in_progress', 'complete')) DEFAULT 'none',
        due_date INTEGER,             -- Unix timestamp
        completed_at INTEGER,         -- Unix timestamp
        created_at INTEGER NOT NULL,  -- Unix timestamp
        updated_at INTEGER NOT NULL,  -- Unix timestamp
        deleted_at INTEGER,           -- Unix timestamp (soft delete)

        -- Priority, rating, and pinning fields
        priority INTEGER DEFAULT 0,   -- Integer priority level for sorting
        rating REAL DEFAULT 0.00,     -- Decimal rating from 0.00 to 5.00
        is_pinned INTEGER DEFAULT 0,  -- Boolean flag (0=false, 1=true) to pin entries

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

      -- Categories table
      CREATE TABLE IF NOT EXISTS categories (
        category_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        full_path TEXT NOT NULL,
        parent_category_id TEXT,
        depth INTEGER NOT NULL,
        entry_count INTEGER DEFAULT 0,
        color TEXT,
        icon TEXT,
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

      -- Indexes for categories are created in createIndexes() after migrations

      -- Photos table
      CREATE TABLE IF NOT EXISTS photos (
        photo_id TEXT PRIMARY KEY,
        entry_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        local_path TEXT,
        mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
        file_size INTEGER,
        width INTEGER,
        height INTEGER,
        position INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        uploaded INTEGER DEFAULT 0,
        synced INTEGER DEFAULT 0,
        sync_action TEXT,
        FOREIGN KEY (entry_id) REFERENCES entries(entry_id) ON DELETE CASCADE
      );

      -- Indexes for photos are created in createIndexes() after migrations

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
        categories_pushed INTEGER DEFAULT 0,
        categories_errors INTEGER DEFAULT 0,
        photos_pushed INTEGER DEFAULT 0,
        photos_errors INTEGER DEFAULT 0,
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
      CREATE INDEX IF NOT EXISTS idx_entries_category_id ON entries(category_id);
      CREATE INDEX IF NOT EXISTS idx_entries_location_id ON entries(location_id);
      CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
      CREATE INDEX IF NOT EXISTS idx_entries_synced ON entries(synced);
      CREATE INDEX IF NOT EXISTS idx_entries_local_only ON entries(local_only);

      -- Indexes for categories
      CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
      CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_category_id);
      CREATE INDEX IF NOT EXISTS idx_categories_synced ON categories(synced);

      -- Indexes for photos
      CREATE INDEX IF NOT EXISTS idx_photos_entry_id ON photos(entry_id);
      CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
      CREATE INDEX IF NOT EXISTS idx_photos_position ON photos(entry_id, position);
      CREATE INDEX IF NOT EXISTS idx_photos_uploaded ON photos(uploaded);
      CREATE INDEX IF NOT EXISTS idx_photos_synced ON photos(synced);

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
        category_id, entry_date,
        entry_latitude, entry_longitude, location_accuracy,
        location_id,
        status, due_date, completed_at, created_at, updated_at,
        priority, rating, is_pinned,
        local_only, synced, sync_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.entry_id,
        entry.user_id,
        entry.title || null,
        entry.content,
        JSON.stringify(entry.tags || []),
        JSON.stringify(entry.mentions || []),
        entry.category_id || null,
        entry.entry_date ? Date.parse(entry.entry_date) : (entry.created_at ? Date.parse(entry.created_at) : now),
        entry.entry_latitude || null,
        entry.entry_longitude || null,
        entry.location_accuracy || null,
        entry.location_id || null,
        entry.status || 'none',
        entry.due_date ? Date.parse(entry.due_date) : null,
        entry.completed_at ? Date.parse(entry.completed_at) : null,
        entry.created_at ? Date.parse(entry.created_at) : now,
        entry.updated_at ? Date.parse(entry.updated_at) : now,
        entry.priority !== undefined ? entry.priority : 0,
        entry.rating !== undefined ? entry.rating : 0.00,
        entry.is_pinned ? 1 : 0,
        entry.local_only !== undefined ? entry.local_only : 0,
        entry.synced !== undefined ? entry.synced : 0,
        entry.sync_action !== undefined ? entry.sync_action : 'create'
      ]
    );

    return this.getEntry(entry.entry_id) as Promise<Entry>;
  }

  /**
   * Get a single entry by ID
   */
  async getEntry(entryId: string): Promise<Entry | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM entries WHERE entry_id = ?';
    const params: any[] = [entryId];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    const row = await this.db.getFirstAsync<any>(query, params);

    if (!row) return null;

    return this.rowToEntry(row);
  }

  /**
   * Get all entries (with optional filters)
   * Excludes soft-deleted entries by default
   */
  async getAllEntries(filter?: {
    category_id?: string | null;
    status?: string;
    tag?: string;
    mention?: string;
    location_id?: string;
    includeDeleted?: boolean;
    includeChildren?: boolean;
    childCategoryIds?: string[];
  }): Promise<Entry[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM entries WHERE 1=1';
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    if (!filter?.includeDeleted) {
      query += ' AND deleted_at IS NULL';
    }

    if (filter) {
      if (filter.category_id !== undefined) {
        if (filter.category_id === null) {
          query += ' AND category_id IS NULL';
        } else if (filter.includeChildren && filter.childCategoryIds && filter.childCategoryIds.length > 0) {
          const placeholders = filter.childCategoryIds.map(() => '?').join(',');
          query += ` AND category_id IN (?, ${placeholders})`;
          params.push(filter.category_id, ...filter.childCategoryIds);
        } else {
          query += ' AND category_id = ?';
          params.push(filter.category_id);
        }
      }

      if (filter.status) {
        query += ' AND status = ?';
        params.push(filter.status);
      }

      if (filter.tag) {
        query += ' AND tags LIKE ?';
        params.push(`%"${filter.tag.toLowerCase()}"%`);
      }

      if (filter.mention) {
        query += ' AND mentions LIKE ?';
        params.push(`%"${filter.mention.toLowerCase()}"%`);
      }

      if (filter.location_id) {
        query += ' AND location_id = ?';
        params.push(filter.location_id);
      }
    }

    query += ' ORDER BY updated_at DESC';

    const rows = await this.db.getAllAsync<any>(query, params);

    return rows.map(row => this.rowToEntry(row));
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

    console.log('🔧 [LocalDB] updateEntry called:', {
      entryId,
      updates,
      'updated.is_pinned': updated.is_pinned,
      'updated.priority': updated.priority,
      'updated.rating': updated.rating
    });

    await this.db.runAsync(
      `UPDATE entries SET
        title = ?, content = ?, tags = ?, mentions = ?,
        category_id = ?, entry_date = ?,
        entry_latitude = ?, entry_longitude = ?, location_accuracy = ?,
        location_id = ?,
        status = ?, due_date = ?, completed_at = ?,
        priority = ?, rating = ?, is_pinned = ?,
        updated_at = ?, local_only = ?, synced = ?, sync_action = ?
      WHERE entry_id = ?`,
      [
        updated.title || null,
        updated.content,
        JSON.stringify(updated.tags || []),
        JSON.stringify(updated.mentions || []),
        updated.category_id || null,
        updated.entry_date ? Date.parse(updated.entry_date) : null,
        updated.entry_latitude || null,
        updated.entry_longitude || null,
        updated.location_accuracy || null,
        updated.location_id || null,
        updated.status || 'none',
        updated.due_date ? Date.parse(updated.due_date) : null,
        updated.completed_at ? Date.parse(updated.completed_at) : null,
        updated.priority !== undefined ? updated.priority : 0,
        updated.rating !== undefined ? updated.rating : 0.00,
        updated.is_pinned ? 1 : 0,
        Date.parse(updated.updated_at),
        updated.local_only !== undefined ? updated.local_only : 0,
        updated.synced !== undefined ? updated.synced : 0,
        updated.sync_action !== undefined ? updated.sync_action : 'update',
        entryId
      ]
    );

    console.log('✅ [LocalDB] UPDATE executed, fetching updated entry...');
    const result = await this.getEntry(entryId);
    if (!result) throw new Error('Entry not found after update');
    console.log('📖 [LocalDB] Retrieved entry:', {
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

    // Mark all associated photos for deletion
    const photos = await this.getPhotosForEntry(entryId);
    for (const photo of photos) {
      await this.deletePhoto(photo.photo_id);
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
      category_id: row.category_id,
      entry_date: row.entry_date ? new Date(row.entry_date).toISOString() : null,
      entry_latitude: row.entry_latitude,
      entry_longitude: row.entry_longitude,
      location_accuracy: row.location_accuracy,
      location_id: row.location_id,
      status: row.status || 'none',
      due_date: row.due_date ? new Date(row.due_date).toISOString() : null,
      completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
      deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
      attachments: null,
      priority: row.priority !== undefined ? row.priority : 0,
      rating: row.rating !== undefined ? row.rating : 0.00,
      is_pinned: row.is_pinned === 1,
      local_only: row.local_only,
      synced: row.synced,
      sync_action: row.sync_action,
      sync_error: row.sync_error,
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
        created_at, updated_at, synced, sync_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        mapbox_place_id = ?, foursquare_fsq_id = ?,
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
          sync_action = NULL
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
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
      deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
      synced: row.synced,
      sync_action: row.sync_action,
    };
  }

  // ========================================
  // CATEGORY OPERATIONS
  // ========================================

  /**
   * Get all categories
   */
  async getAllCategories(): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = `
      SELECT
        c.*,
        COALESCE(COUNT(e.entry_id), 0) as entry_count
      FROM categories c
      LEFT JOIN entries e ON c.category_id = e.category_id
        AND (e.deleted_at IS NULL OR e.deleted_at = '')
    `;

    const params: any[] = [];

    if (this.currentUserId) {
      query += ` WHERE (c.sync_action IS NULL OR c.sync_action != 'delete')
        AND c.user_id = ?`;
      params.push(this.currentUserId);
    } else {
      query += ` WHERE c.sync_action IS NULL OR c.sync_action != 'delete'`;
    }

    query += `
      GROUP BY c.category_id
      ORDER BY c.full_path
    `;

    const rows = await this.db.getAllAsync<any>(query, params);

    // Convert SQLite integer booleans (0/1) to proper booleans
    return rows.map(row => ({
      ...row,
      entry_use_rating: !!row.entry_use_rating,
      entry_use_priority: !!row.entry_use_priority,
      entry_use_status: !!row.entry_use_status,
      entry_use_duedates: !!row.entry_use_duedates,
      entry_use_location: !!row.entry_use_location,
      entry_use_photos: !!row.entry_use_photos,
      is_private: !!row.is_private,
      is_localonly: !!row.is_localonly,
    }));
  }

  /**
   * Get a single category by ID
   */
  async getCategory(categoryId: string): Promise<any | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const row = await this.db.getFirstAsync<any>(
      `SELECT
        c.*,
        COALESCE(COUNT(e.entry_id), 0) as entry_count
      FROM categories c
      LEFT JOIN entries e ON c.category_id = e.category_id
        AND (e.deleted_at IS NULL OR e.deleted_at = '')
      WHERE c.category_id = ?
      GROUP BY c.category_id`,
      [categoryId]
    );

    if (!row) return null;

    // Convert SQLite integer booleans (0/1) to proper booleans
    return {
      ...row,
      entry_use_rating: !!row.entry_use_rating,
      entry_use_priority: !!row.entry_use_priority,
      entry_use_status: !!row.entry_use_status,
      entry_use_duedates: !!row.entry_use_duedates,
      entry_use_location: !!row.entry_use_location,
      entry_use_photos: !!row.entry_use_photos,
      is_private: !!row.is_private,
      is_localonly: !!row.is_localonly,
    };
  }

  /**
   * Save a category
   */
  async saveCategory(category: any): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT OR REPLACE INTO categories (
        category_id, user_id, name, full_path, parent_category_id,
        depth, entry_count, color, icon, created_at, updated_at,
        synced, sync_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        category.category_id,
        category.user_id,
        category.name,
        category.full_path,
        category.parent_category_id || null,
        category.depth,
        category.entry_count || 0,
        category.color || null,
        category.icon || null,
        Date.parse(category.created_at),
        Date.parse(category.updated_at || category.created_at),
        0,
        'create'
      ]
    );
  }

  /**
   * Update a category
   */
  async updateCategory(categoryId: string, updates: any): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const now = Date.now();
    const updatedAt = updates.updated_at !== undefined
      ? (typeof updates.updated_at === 'string' ? Date.parse(updates.updated_at) : updates.updated_at)
      : now;

    const synced = updates.synced !== undefined ? updates.synced : 0;
    const syncAction = updates.sync_action !== undefined ? updates.sync_action : 'update';

    await this.db.runAsync(
      `UPDATE categories SET
        name = ?,
        full_path = ?,
        parent_category_id = ?,
        depth = ?,
        color = ?,
        icon = ?,
        entry_title_template = ?,
        entry_content_template = ?,
        entry_use_rating = ?,
        entry_use_priority = ?,
        entry_use_status = ?,
        entry_use_duedates = ?,
        entry_use_location = ?,
        entry_use_photos = ?,
        entry_content_type = ?,
        is_private = ?,
        is_localonly = ?,
        updated_at = ?,
        synced = ?,
        sync_action = ?
      WHERE category_id = ?`,
      [
        updates.name,
        updates.full_path,
        updates.parent_category_id !== undefined ? updates.parent_category_id : null,
        updates.depth !== undefined ? updates.depth : 0,
        updates.color || null,
        updates.icon || null,
        updates.entry_title_template !== undefined ? updates.entry_title_template : null,
        updates.entry_content_template !== undefined ? updates.entry_content_template : null,
        updates.entry_use_rating !== undefined ? (updates.entry_use_rating ? 1 : 0) : null,
        updates.entry_use_priority !== undefined ? (updates.entry_use_priority ? 1 : 0) : null,
        updates.entry_use_status !== undefined ? (updates.entry_use_status ? 1 : 0) : null,
        updates.entry_use_duedates !== undefined ? (updates.entry_use_duedates ? 1 : 0) : null,
        updates.entry_use_location !== undefined ? (updates.entry_use_location ? 1 : 0) : null,
        updates.entry_use_photos !== undefined ? (updates.entry_use_photos ? 1 : 0) : null,
        updates.entry_content_type !== undefined ? updates.entry_content_type : null,
        updates.is_private !== undefined ? (updates.is_private ? 1 : 0) : null,
        updates.is_localonly !== undefined ? (updates.is_localonly ? 1 : 0) : null,
        updatedAt,
        synced,
        syncAction,
        categoryId
      ]
    );
  }

  /**
   * Delete a category
   */
  async deleteCategory(categoryId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const category = await this.getCategory(categoryId);
    if (!category) return;

    const parentCategoryId = category.parent_category_id;

    // Move entries to parent
    await this.db.runAsync(
      `UPDATE entries
       SET category_id = ?, synced = 0
       WHERE category_id = ?`,
      [parentCategoryId, categoryId]
    );

    // Move child categories to parent
    await this.db.runAsync(
      `UPDATE categories
       SET parent_category_id = ?, synced = 0
       WHERE parent_category_id = ?`,
      [parentCategoryId, categoryId]
    );

    // Mark for deletion
    await this.db.runAsync(
      `UPDATE categories SET synced = 0, sync_action = 'delete' WHERE category_id = ?`,
      [categoryId]
    );
  }

  /**
   * Get unsynced categories
   */
  async getUnsyncedCategories(): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const rows = await this.db.getAllAsync<any>(
      'SELECT * FROM categories WHERE synced = 0'
    );

    return rows;
  }

  /**
   * Mark category as synced
   */
  async markCategorySynced(categoryId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const category = await this.getCategory(categoryId);

    if (category && category.sync_action === 'delete') {
      await this.db.runAsync('DELETE FROM categories WHERE category_id = ?', [categoryId]);
    } else {
      await this.db.runAsync(
        `UPDATE categories SET
          synced = 1,
          sync_action = NULL,
          sync_error = NULL
        WHERE category_id = ?`,
        [categoryId]
      );
    }
  }

  /**
   * Record category sync error
   */
  async recordCategorySyncError(categoryId: string, error: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `UPDATE categories SET
        sync_error = ?
      WHERE category_id = ?`,
      [error, categoryId]
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
      categories_pushed?: number;
      categories_errors?: number;
      photos_pushed?: number;
      photos_errors?: number;
      entries_pulled?: number;
    }
  ): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT INTO sync_logs (
        timestamp, log_level, operation, message,
        entries_pushed, entries_errors, categories_pushed, categories_errors, entries_pulled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Date.now(),
        logLevel,
        operation,
        message,
        details?.entries_pushed || 0,
        details?.entries_errors || 0,
        details?.categories_pushed || 0,
        details?.categories_errors || 0,
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
    categories_pushed: number;
    categories_errors: number;
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
  // PHOTO OPERATIONS
  // ========================================

  /**
   * Create a new photo record
   * @param photo - Photo data
   * @param fromSync - If true, photo is from cloud sync (already synced, no sync_action needed)
   */
  async createPhoto(photo: {
    photo_id: string;
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
      `INSERT INTO photos (
        photo_id, entry_id, user_id, file_path, local_path,
        mime_type, file_size, width, height, position,
        created_at, updated_at, uploaded, synced, sync_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        photo.photo_id,
        photo.entry_id,
        photo.user_id,
        photo.file_path,
        photo.local_path || null,
        photo.mime_type,
        photo.file_size || null,
        photo.width || null,
        photo.height || null,
        photo.position,
        photo.created_at || now,
        photo.updated_at || now,
        photo.uploaded ? 1 : 0,
        fromSync ? 1 : 0,           // If from sync, mark as synced
        fromSync ? null : 'create', // If from sync, no sync action needed
      ]
    );

    console.log(`📸 Photo created: ${photo.photo_id}${fromSync ? ' (from sync)' : ''}`);
  }

  /**
   * Get all photos for an entry
   */
  async getPhotosForEntry(entryId: string): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM photos WHERE entry_id = ? AND (sync_action IS NULL OR sync_action != ?)';
    const params: any[] = [entryId, 'delete'];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    query += ' ORDER BY position ASC';

    const photos = await this.db.getAllAsync<any>(query, params);
    return photos;
  }

  /**
   * Get a single photo by ID
   */
  async getPhoto(photoId: string): Promise<any | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM photos WHERE photo_id = ?';
    const params: any[] = [photoId];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    const photo = await this.db.getFirstAsync<any>(query, params);
    return photo || null;
  }

  /**
   * Update a photo
   */
  async updatePhoto(photoId: string, updates: Partial<{
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

    values.push(photoId);

    const sql = `UPDATE photos SET ${fields.join(', ')} WHERE photo_id = ?`;
    await this.db.runAsync(sql, values);

    console.log(`📸 Photo updated: ${photoId}`);
  }

  /**
   * Update entry_id for all photos
   */
  async updatePhotoEntryIds(oldEntryId: string, newEntryId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    console.log(`📸 updatePhotoEntryIds: ${oldEntryId} → ${newEntryId}`);

    const photos = await this.db.getAllAsync<any>(
      'SELECT photo_id, file_path, local_path FROM photos WHERE entry_id = ?',
      [oldEntryId]
    );

    console.log(`📸 Found ${photos.length} photos to update`);

    if (photos.length === 0) return;

    const FileSystem = await import('expo-file-system/legacy');

    for (const photo of photos) {
      console.log(`📸 Processing photo ${photo.photo_id}:`);
      console.log(`  Old path: ${photo.local_path}`);

      const newFilePath = photo.file_path.replace(oldEntryId, newEntryId);
      let newLocalPath = photo.local_path ? photo.local_path.replace(oldEntryId, newEntryId) : null;

      console.log(`  New path: ${newLocalPath}`);

      if (photo.local_path && newLocalPath) {
        try {
          const oldFileInfo = await FileSystem.getInfoAsync(photo.local_path);
          console.log(`  Old file exists: ${oldFileInfo.exists}`);

          if (oldFileInfo.exists) {
            const newDir = newLocalPath.substring(0, newLocalPath.lastIndexOf('/'));
            console.log(`  Creating new directory: ${newDir}`);

            await FileSystem.makeDirectoryAsync(newDir, { intermediates: true });

            console.log(`  Moving file...`);
            await FileSystem.moveAsync({
              from: photo.local_path,
              to: newLocalPath,
            });

            console.log(`✅ Moved photo file successfully`);

            const newFileInfo = await FileSystem.getInfoAsync(newLocalPath);
            console.log(`  New file exists: ${newFileInfo.exists}`);
          } else {
            console.log(`⚠️ Old file doesn't exist at ${photo.local_path}`);
          }
        } catch (error) {
          console.error(`❌ Failed to move photo file ${photo.photo_id}:`, error);
        }
      }

      await this.db.runAsync(
        'UPDATE photos SET entry_id = ?, file_path = ?, local_path = ?, synced = 0 WHERE photo_id = ?',
        [newEntryId, newFilePath, newLocalPath, photo.photo_id]
      );
      console.log(`✅ Updated database for photo ${photo.photo_id}`);
    }

    console.log(`📸 Finished updating ${photos.length} photos`);
  }

  /**
   * Delete a photo
   */
  async deletePhoto(photoId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      'UPDATE photos SET sync_action = ?, synced = 0 WHERE photo_id = ?',
      ['delete', photoId]
    );

    console.log(`📸 Photo marked for deletion: ${photoId}`);
  }

  /**
   * Permanently delete a photo
   */
  async permanentlyDeletePhoto(photoId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync('DELETE FROM photos WHERE photo_id = ?', [photoId]);
    console.log(`📸 Photo permanently deleted: ${photoId}`);
  }

  /**
   * Clean up orphaned photos
   */
  async cleanupOrphanedPhotos(): Promise<number> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    console.log('🧹 Searching for orphaned photos...');

    let query = 'SELECT * FROM photos WHERE sync_action IS NULL OR sync_action != ?';
    const params: any[] = ['delete'];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    const photos = await this.db.getAllAsync<any>(query, params);
    let orphanCount = 0;

    for (const photo of photos) {
      const entry = await this.getEntry(photo.entry_id);

      if (!entry || entry.deleted_at) {
        console.log(`🗑️ Found orphaned photo ${photo.photo_id} (entry ${photo.entry_id} ${!entry ? 'not found' : 'deleted'})`);
        await this.deletePhoto(photo.photo_id);
        orphanCount++;
      }
    }

    if (orphanCount > 0) {
      console.log(`🧹 Cleanup complete: Found and marked ${orphanCount} orphaned photos for deletion`);
    } else {
      console.log('✅ No orphaned photos found');
    }

    return orphanCount;
  }

  /**
   * Get all photos needing upload
   */
  async getPhotosNeedingUpload(): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM photos WHERE uploaded = 0';
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    query += ' ORDER BY created_at ASC';

    const photos = await this.db.getAllAsync<any>(query, params);
    return photos;
  }

  /**
   * Get all photos needing sync
   */
  async getPhotosNeedingSync(): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = `
      SELECT p.*
      FROM photos p
      LEFT JOIN entries e ON p.entry_id = e.entry_id
      WHERE p.synced = 0
        AND p.sync_action IS NOT NULL
        AND (e.synced = 1 OR p.sync_action = 'delete' OR e.entry_id IS NULL)
    `;
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' AND p.user_id = ?';
      params.push(this.currentUserId);
    }

    query += ' ORDER BY p.created_at ASC';

    const photos = await this.db.getAllAsync<any>(query, params);
    return photos;
  }

  /**
   * Get all photos for current user
   */
  async getAllPhotos(): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM photos';
    const params: any[] = [];

    if (this.currentUserId) {
      query += ' WHERE user_id = ?';
      params.push(this.currentUserId);
    }

    query += ' ORDER BY created_at DESC';

    const photos = await this.db.getAllAsync<any>(query, params);
    return photos;
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

    console.log('🔍 Debug query:', sql);
    const result = await this.db.getAllAsync<any>(sql);
    console.log('📊 Result:', JSON.stringify(result, null, 2));
    return result;
  }

  /**
   * Clear all data
   */
  async clearAllData(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      DELETE FROM photos;
      DELETE FROM entries;
      DELETE FROM categories;
      DELETE FROM locations;
      DELETE FROM sync_metadata;
      DELETE FROM sync_logs;
    `);

    console.log('🗑️ All local data cleared');
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
   * Set current user ID
   */
  setCurrentUser(userId: string): void {
    if (this.currentUserId !== userId) {
      console.log(`👤 Switched to user: ${userId}`);
      this.currentUserId = userId;
    }
  }

  /**
   * Clear current user
   */
  clearCurrentUser(): void {
    console.log('👤 Cleared current user');
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
