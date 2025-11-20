/**
 * Local SQLite database for mobile app
 * Provides offline-first storage with background sync to Supabase
 */

import * as SQLite from 'expo-sqlite';
import { Entry, CreateEntryInput } from '@trace/core';

class LocalDatabase {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private hasDeletedAtColumn: boolean = false;
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

      // Create tables
      await this.createTables();

      // Run migrations for existing databases
      await this.runMigrations();

      console.log('✅ SQLite tables created and migrated');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Run database migrations
   *
   * Migrations 1-7 have been consolidated into the createTables() schema.
   * This method now only sets the version for fresh installs.
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Check current schema version
      let currentVersion = 0;
      try {
        const result = await this.db.getAllAsync<{ value: string }>(
          'SELECT value FROM sync_metadata WHERE key = ?',
          ['schema_version']
        );
        currentVersion = result.length > 0 ? parseInt(result[0].value) : 0;
      } catch (error) {
        // sync_metadata table might not exist yet, start from version 0
        console.log('ℹ️ No schema version found, starting from 0');
      }

      console.log(`📊 Current schema version: ${currentVersion}`);

      if (currentVersion === 0) {
        // Fresh install - all tables created in createTables() with version 12 schema
        console.log('🆕 Fresh install - setting schema version to 12');

        await this.db.runAsync(
          'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
          ['schema_version', '12', Date.now()]
        );

        // Check if deleted_at column exists
        const tableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(entries)');
        this.hasDeletedAtColumn = tableInfo.some((col: any) => col.name === 'deleted_at');

        console.log('✅ Schema initialized at version 12');
      } else if (currentVersion < 7) {
        // Old database detected - recommend reinstall for clean migration
        console.warn('⚠️ Old schema detected (version ' + currentVersion + ')');
        console.warn('⚠️ For photo support, clear Expo Go app data and restart the app');
        console.warn('⚠️ Settings > Apps > Expo Go > Storage > Clear Data');

        // Check if deleted_at column exists
        const tableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(entries)');
        this.hasDeletedAtColumn = tableInfo.some((col: any) => col.name === 'deleted_at');
      } else if (currentVersion === 7) {
        // Migration 8: Simplify photos table schema
        console.log('🔄 Migrating schema from version 7 to 8: Simplifying photos table');

        // SQLite doesn't support DROP COLUMN directly, need to recreate table
        await this.db.execAsync(`
          -- Create new photos table with simplified schema
          CREATE TABLE IF NOT EXISTS photos_new (
            photo_id TEXT PRIMARY KEY,
            entry_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            file_path TEXT NOT NULL,
            local_path TEXT,
            mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
            position INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            uploaded INTEGER DEFAULT 0,
            synced INTEGER DEFAULT 0,
            sync_action TEXT,
            FOREIGN KEY (entry_id) REFERENCES entries(entry_id) ON DELETE CASCADE
          );

          -- Copy data from old table (only the columns we're keeping)
          INSERT INTO photos_new (photo_id, entry_id, user_id, file_path, local_path, mime_type, position, created_at, updated_at, uploaded, synced, sync_action)
          SELECT photo_id, entry_id, user_id, file_path, local_path, mime_type, position, created_at, updated_at, uploaded, synced, sync_action
          FROM photos;

          -- Drop old table
          DROP TABLE photos;

          -- Rename new table
          ALTER TABLE photos_new RENAME TO photos;

          -- Recreate indexes
          CREATE INDEX idx_photos_entry_id ON photos(entry_id);
          CREATE INDEX idx_photos_user_id ON photos(user_id);
          CREATE INDEX idx_photos_position ON photos(entry_id, position);
          CREATE INDEX idx_photos_uploaded ON photos(uploaded);
          CREATE INDEX idx_photos_synced ON photos(synced);
        `);

        await this.db.runAsync(
          'UPDATE sync_metadata SET value = ?, updated_at = ? WHERE key = ?',
          ['8', Date.now(), 'schema_version']
        );

        // Check if deleted_at column exists
        const tableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(entries)');
        this.hasDeletedAtColumn = tableInfo.some((col: any) => col.name === 'deleted_at');

        console.log('✅ Migrated to schema version 8');
      } else if (currentVersion === 8) {
        // Migration 9: Add optional metadata columns to photos
        console.log('🔄 Migrating schema from version 8 to 9: Adding optional photo metadata');

        await this.db.execAsync(`
          -- Add optional metadata columns
          ALTER TABLE photos ADD COLUMN file_size INTEGER;
          ALTER TABLE photos ADD COLUMN width INTEGER;
          ALTER TABLE photos ADD COLUMN height INTEGER;
        `);

        await this.db.runAsync(
          'UPDATE sync_metadata SET value = ?, updated_at = ? WHERE key = ?',
          ['9', Date.now(), 'schema_version']
        );

        // Check if deleted_at column exists
        const tableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(entries)');
        this.hasDeletedAtColumn = tableInfo.some((col: any) => col.name === 'deleted_at');

        console.log('✅ Migrated to schema version 9');
      } else if (currentVersion === 9) {
        // Migration 10: Rename location coordinates and add location hierarchy fields
        console.log('🔄 Migrating schema from version 9 to 10: Adding location hierarchy fields');

        // SQLite doesn't support RENAME COLUMN directly in old versions
        // We need to recreate the entries table with new schema
        await this.db.execAsync(`
          -- Create new entries table with updated location fields
          CREATE TABLE entries_new (
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
            location_latitude REAL,
            location_longitude REAL,
            location_accuracy REAL,
            location_name TEXT,
            location_name_source TEXT,
            location_address TEXT,
            location_neighborhood TEXT,
            location_postal_code TEXT,
            location_city TEXT,
            location_subdivision TEXT,
            location_region TEXT,
            location_country TEXT,
            status TEXT CHECK (status IN ('none', 'incomplete', 'in_progress', 'complete')) DEFAULT 'none',
            due_date INTEGER,
            completed_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            deleted_at INTEGER,
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
          );

          -- Copy data from old table, mapping old column names to new
          INSERT INTO entries_new (
            entry_id, user_id, title, content, tags, mentions,
            category_id, entry_date,
            entry_latitude, entry_longitude, location_accuracy, location_name,
            status, due_date, completed_at, created_at, updated_at, deleted_at,
            local_only, synced, sync_action, sync_error, sync_retry_count, sync_last_attempt,
            version, base_version, conflict_status, conflict_backup, last_edited_by, last_edited_device
          )
          SELECT
            entry_id, user_id, title, content, tags, mentions,
            category_id, entry_date,
            location_lat, location_lng, location_accuracy, location_name,
            status, due_date, completed_at, created_at, updated_at, deleted_at,
            local_only, synced, sync_action, sync_error, sync_retry_count, sync_last_attempt,
            version, base_version, conflict_status, conflict_backup, last_edited_by, last_edited_device
          FROM entries;

          -- Drop old table
          DROP TABLE entries;

          -- Rename new table
          ALTER TABLE entries_new RENAME TO entries;

          -- Recreate indexes
          CREATE INDEX idx_entries_user_id ON entries(user_id);
          CREATE INDEX idx_entries_created_at ON entries(created_at DESC);
          CREATE INDEX idx_entries_updated_at ON entries(updated_at DESC);
          CREATE INDEX idx_entries_deleted_at ON entries(deleted_at);
          CREATE INDEX idx_entries_entry_date ON entries(entry_date);
          CREATE INDEX idx_entries_category_id ON entries(category_id);
          CREATE INDEX idx_entries_status ON entries(status);
          CREATE INDEX idx_entries_synced ON entries(synced);
          CREATE INDEX idx_entries_local_only ON entries(local_only);
        `);

        await this.db.runAsync(
          'UPDATE sync_metadata SET value = ?, updated_at = ? WHERE key = ?',
          ['10', Date.now(), 'schema_version']
        );

        // Check if deleted_at column exists
        const tableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(entries)');
        this.hasDeletedAtColumn = tableInfo.some((col: any) => col.name === 'deleted_at');

        console.log('✅ Migrated to schema version 10');
      } else if (currentVersion === 10) {
        // Migration 11: Replace location_mapbox_json with location_address
        console.log('🔄 Migrating schema from version 10 to 11: Replacing location_mapbox_json with location_address');

        // Add location_address column
        await this.db.execAsync(`
          ALTER TABLE entries ADD COLUMN location_address TEXT;
        `);

        // Note: SQLite doesn't support DROP COLUMN in older versions
        // The old location_mapbox_json column will remain but won't be used
        // This is fine - it will just be NULL for all rows

        await this.db.runAsync(
          'UPDATE sync_metadata SET value = ?, updated_at = ? WHERE key = ?',
          ['11', Date.now(), 'schema_version']
        );

        // Check if deleted_at column exists
        const tableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(entries)');
        this.hasDeletedAtColumn = tableInfo.some((col: any) => col.name === 'deleted_at');

        console.log('✅ Migrated to schema version 11');
      } else if (currentVersion === 11) {
        // Migration 12: Update status CHECK constraint to include 'in_progress'
        console.log('🔄 Migrating schema from version 11 to 12: Adding in_progress status');

        // SQLite doesn't allow modifying CHECK constraints, so we need to recreate the table
        await this.db.execAsync(`
          -- Create new entries table with updated status CHECK constraint
          CREATE TABLE entries_new (
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
            location_latitude REAL,
            location_longitude REAL,
            location_accuracy REAL,
            location_name TEXT,
            location_name_source TEXT,
            location_address TEXT,
            location_neighborhood TEXT,
            location_postal_code TEXT,
            location_city TEXT,
            location_subdivision TEXT,
            location_region TEXT,
            location_country TEXT,
            status TEXT CHECK (status IN ('none', 'incomplete', 'in_progress', 'complete')) DEFAULT 'none',
            due_date INTEGER,
            completed_at INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            deleted_at INTEGER,
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
          );

          -- Copy data from old table
          INSERT INTO entries_new SELECT * FROM entries;

          -- Drop old table
          DROP TABLE entries;

          -- Rename new table
          ALTER TABLE entries_new RENAME TO entries;

          -- Recreate indexes
          CREATE INDEX idx_entries_user_id ON entries(user_id);
          CREATE INDEX idx_entries_created_at ON entries(created_at DESC);
          CREATE INDEX idx_entries_updated_at ON entries(updated_at DESC);
          CREATE INDEX idx_entries_deleted_at ON entries(deleted_at);
          CREATE INDEX idx_entries_entry_date ON entries(entry_date);
          CREATE INDEX idx_entries_category_id ON entries(category_id);
          CREATE INDEX idx_entries_status ON entries(status);
          CREATE INDEX idx_entries_synced ON entries(synced);
          CREATE INDEX idx_entries_local_only ON entries(local_only);
        `);

        await this.db.runAsync(
          'UPDATE sync_metadata SET value = ?, updated_at = ? WHERE key = ?',
          ['12', Date.now(), 'schema_version']
        );

        // Check if deleted_at column exists
        const tableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(entries)');
        this.hasDeletedAtColumn = tableInfo.some((col: any) => col.name === 'deleted_at');

        console.log('✅ Migrated to schema version 12');
      } else {
        // Already on latest version
        console.log('✅ Schema is up to date (version 12)');

        // Check if deleted_at column exists
        const tableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(entries)');
        this.hasDeletedAtColumn = tableInfo.some((col: any) => col.name === 'deleted_at');
      }
    } catch (error) {
      console.error('❌ Migration check failed:', error);
      // Check if column exists despite error
      try {
        const tableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(entries)');
        this.hasDeletedAtColumn = tableInfo.some((col: any) => col.name === 'deleted_at');
      } catch (e) {
        // Ignore
      }
      // Don't throw - allow app to continue even if migration fails
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      -- Entries table (mirrors Supabase schema + sync fields)
      CREATE TABLE IF NOT EXISTS entries (
        entry_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        tags TEXT,                    -- JSON array: '["tag1","tag2"]'
        mentions TEXT,                -- JSON array: '["person1","person2"]'
        category_id TEXT,
        entry_date INTEGER,           -- Unix timestamp for calendar grouping (Migration 4)

        -- GPS coordinates (where user was when creating entry) - Migration 10
        entry_latitude REAL,
        entry_longitude REAL,

        -- Tagged location coordinates (selected POI/place) - Migration 10
        location_latitude REAL,
        location_longitude REAL,
        location_accuracy REAL,

        -- Location name and hierarchy - Migration 10
        location_name TEXT,
        location_name_source TEXT,
        location_address TEXT,
        location_neighborhood TEXT,
        location_postal_code TEXT,
        location_city TEXT,
        location_subdivision TEXT,
        location_region TEXT,
        location_country TEXT,

        status TEXT CHECK (status IN ('none', 'incomplete', 'in_progress', 'complete')) DEFAULT 'none',
        due_date INTEGER,             -- Unix timestamp
        completed_at INTEGER,         -- Unix timestamp
        created_at INTEGER NOT NULL,  -- Unix timestamp
        updated_at INTEGER NOT NULL,  -- Unix timestamp
        deleted_at INTEGER,           -- Unix timestamp (soft delete - Migration 1)

        -- Sync tracking fields
        local_only INTEGER DEFAULT 0,     -- 0 = sync enabled, 1 = local only
        synced INTEGER DEFAULT 0,         -- 0 = needs sync, 1 = synced
        sync_action TEXT,                 -- 'create', 'update', 'delete', or NULL
        sync_error TEXT,                  -- Error message if sync failed
        sync_retry_count INTEGER DEFAULT 0,
        sync_last_attempt INTEGER,        -- Unix timestamp of last sync attempt

        -- Conflict resolution fields (Migration 6)
        version INTEGER DEFAULT 1,        -- Increments with each local edit
        base_version INTEGER DEFAULT 1,   -- Server version this edit is based on
        conflict_status TEXT,             -- null, 'conflicted', 'resolved'
        conflict_backup TEXT,             -- JSON backup of losing version
        last_edited_by TEXT,              -- User email who last edited
        last_edited_device TEXT           -- Device name that last edited
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_entries_deleted_at ON entries(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_entries_entry_date ON entries(entry_date);
      CREATE INDEX IF NOT EXISTS idx_entries_category_id ON entries(category_id);
      CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
      CREATE INDEX IF NOT EXISTS idx_entries_synced ON entries(synced);
      CREATE INDEX IF NOT EXISTS idx_entries_local_only ON entries(local_only);

      -- Categories table (with sync support)
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
        updated_at INTEGER NOT NULL,   -- Migration 3

        -- Sync tracking fields (Migration 2)
        synced INTEGER DEFAULT 0,         -- 0 = needs sync, 1 = synced
        sync_action TEXT,                 -- 'create', 'update', 'delete', or NULL
        sync_error TEXT,

        -- Conflict resolution fields (Migration 6)
        version INTEGER DEFAULT 1,        -- Increments with each local edit
        base_version INTEGER DEFAULT 1,   -- Server version this edit is based on
        conflict_status TEXT,             -- null, 'conflicted', 'resolved'
        conflict_backup TEXT,             -- JSON backup of losing version
        last_edited_by TEXT,              -- User email who last edited
        last_edited_device TEXT           -- Device name that last edited
      );

      CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
      CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_category_id);
      CREATE INDEX IF NOT EXISTS idx_categories_synced ON categories(synced);

      -- Photos table (Migration 7, simplified in Migration 8, updated in Migration 9)
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

      CREATE INDEX IF NOT EXISTS idx_photos_entry_id ON photos(entry_id);
      CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
      CREATE INDEX IF NOT EXISTS idx_photos_position ON photos(entry_id, position);
      CREATE INDEX IF NOT EXISTS idx_photos_uploaded ON photos(uploaded);
      CREATE INDEX IF NOT EXISTS idx_photos_synced ON photos(synced);

      -- Sync metadata table
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      -- Sync logs table (Migration 5)
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

      CREATE INDEX IF NOT EXISTS idx_sync_logs_timestamp ON sync_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_sync_logs_level ON sync_logs(log_level);
    `);
  }

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
        entry_latitude, entry_longitude,
        location_latitude, location_longitude, location_accuracy,
        location_name, location_name_source, location_address, location_neighborhood,
        location_postal_code, location_city, location_subdivision,
        location_region, location_country,
        status, due_date, completed_at, created_at, updated_at,
        local_only, synced, sync_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.entry_id,
        entry.user_id,
        entry.title || null,
        entry.content,
        JSON.stringify(entry.tags || []),
        JSON.stringify(entry.mentions || []),
        entry.category_id || null,
        entry.entry_date ? Date.parse(entry.entry_date) : (entry.created_at ? Date.parse(entry.created_at) : now),
        // GPS coordinates (where user was when creating entry)
        entry.entry_latitude || null,
        entry.entry_longitude || null,
        // Tagged location coordinates (selected POI/place)
        entry.location_latitude || null,
        entry.location_longitude || null,
        entry.location_accuracy || null,
        // Location name and hierarchy
        entry.location_name || null,
        entry.location_name_source || null,
        entry.location_address || null,
        entry.location_neighborhood || null,
        entry.location_postal_code || null,
        entry.location_city || null,
        entry.location_subdivision || null,
        entry.location_region || null,
        entry.location_country || null,
        entry.status || 'none',
        entry.due_date ? Date.parse(entry.due_date) : null,
        entry.completed_at ? Date.parse(entry.completed_at) : null,
        entry.created_at ? Date.parse(entry.created_at) : now,
        entry.updated_at ? Date.parse(entry.updated_at) : now, // Preserve server timestamp if provided
        entry.local_only !== undefined ? entry.local_only : 0,
        entry.synced !== undefined ? entry.synced : 0, // Preserve sync status if provided
        entry.sync_action !== undefined ? entry.sync_action : 'create' // Preserve sync action if provided
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

    // Filter by user_id if set (for multi-user support)
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
    tag?: string; // Filter by single tag
    mention?: string; // Filter by single mention
    includeDeleted?: boolean; // For sync operations
    includeChildren?: boolean; // Include entries in child categories
    childCategoryIds?: string[]; // List of child category IDs to include
  }): Promise<Entry[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM entries WHERE 1=1';
    const params: any[] = [];

    // CRITICAL: Filter by current user_id to support multiple users
    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    // Exclude soft-deleted entries unless explicitly requested
    // Only apply filter if deleted_at column exists (post-migration)
    if (!filter?.includeDeleted && this.hasDeletedAtColumn) {
      query += ' AND deleted_at IS NULL';
    }

    if (filter) {
      if (filter.category_id !== undefined) {
        if (filter.category_id === null) {
          query += ' AND category_id IS NULL';
        } else if (filter.includeChildren && filter.childCategoryIds && filter.childCategoryIds.length > 0) {
          // Include the category and all its children
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

      // Filter by tag (check if tag is in JSON array)
      if (filter.tag) {
        query += ' AND tags LIKE ?';
        params.push(`%"${filter.tag.toLowerCase()}"%`);
      }

      // Filter by mention (check if mention is in JSON array)
      if (filter.mention) {
        query += ' AND mentions LIKE ?';
        params.push(`%"${filter.mention.toLowerCase()}"%`);
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

    // Only update timestamp if not provided (user edit vs sync update)
    const now = Date.now();
    const updated = {
      ...existing,
      ...updates,
      // Preserve server timestamp if provided, otherwise use current time
      updated_at: updates.updated_at || new Date(now).toISOString()
    };

    await this.db.runAsync(
      `UPDATE entries SET
        title = ?, content = ?, tags = ?, mentions = ?,
        category_id = ?, entry_date = ?,
        entry_latitude = ?, entry_longitude = ?,
        location_latitude = ?, location_longitude = ?, location_accuracy = ?,
        location_name = ?, location_name_source = ?, location_address = ?, location_neighborhood = ?,
        location_postal_code = ?, location_city = ?, location_subdivision = ?,
        location_region = ?, location_country = ?,
        status = ?, due_date = ?, completed_at = ?,
        updated_at = ?, local_only = ?, synced = ?, sync_action = ?
      WHERE entry_id = ?`,
      [
        updated.title || null,
        updated.content,
        JSON.stringify(updated.tags || []),
        JSON.stringify(updated.mentions || []),
        updated.category_id || null,
        updated.entry_date ? Date.parse(updated.entry_date) : null,
        // GPS coordinates (where user was when creating entry)
        updated.entry_latitude || null,
        updated.entry_longitude || null,
        // Tagged location coordinates (selected POI/place)
        updated.location_latitude || null,
        updated.location_longitude || null,
        updated.location_accuracy || null,
        // Location name and hierarchy
        updated.location_name || null,
        updated.location_name_source || null,
        updated.location_address || null,
        updated.location_neighborhood || null,
        updated.location_postal_code || null,
        updated.location_city || null,
        updated.location_subdivision || null,
        updated.location_region || null,
        updated.location_country || null,
        updated.status || 'none',
        updated.due_date ? Date.parse(updated.due_date) : null,
        updated.completed_at ? Date.parse(updated.completed_at) : null,
        Date.parse(updated.updated_at), // Use the preserved timestamp
        updated.local_only !== undefined ? updated.local_only : 0,
        updated.synced !== undefined ? updated.synced : 0, // Preserve sync status if provided
        updated.sync_action !== undefined ? updated.sync_action : 'update', // Preserve sync action if provided
        entryId
      ]
    );

    return this.getEntry(entryId) as Promise<Entry>;
  }

  /**
   * Delete an entry (soft delete - sets deleted_at timestamp)
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
      // Local-only entries can be hard deleted immediately
      await this.db.runAsync('DELETE FROM entries WHERE entry_id = ?', [entryId]);
    } else {
      // Soft delete: set deleted_at and mark for sync
      // Note: We don't update updated_at - that should only change when content changes
      await this.db.runAsync(
        `UPDATE entries SET
          deleted_at = ?,
          synced = 0,
          sync_action = 'delete'
        WHERE entry_id = ?`,
        [now, entryId]
      );
    }
  }

  /**
   * Get unsynced entries (for sync queue)
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

    // Check if this was a delete action
    const entry = await this.getEntry(entryId);

    if (entry && entry.sync_action === 'delete') {
      // Delete was synced, now remove from local DB
      await this.db.runAsync('DELETE FROM entries WHERE entry_id = ?', [entryId]);
    } else {
      // Mark as synced
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
      // GPS coordinates (where user was when creating entry)
      entry_latitude: row.entry_latitude,
      entry_longitude: row.entry_longitude,
      // Tagged location coordinates (selected POI/place)
      location_latitude: row.location_latitude,
      location_longitude: row.location_longitude,
      location_accuracy: row.location_accuracy,
      // Location name and hierarchy
      location_name: row.location_name,
      location_name_source: row.location_name_source,
      location_address: row.location_address,
      location_neighborhood: row.location_neighborhood,
      location_postal_code: row.location_postal_code,
      location_city: row.location_city,
      location_subdivision: row.location_subdivision,
      location_region: row.location_region,
      location_country: row.location_country,
      status: row.status || 'none',
      due_date: row.due_date ? new Date(row.due_date).toISOString() : null,
      completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
      created_at: new Date(row.created_at).toISOString(),
      updated_at: new Date(row.updated_at).toISOString(),
      deleted_at: row.deleted_at ? new Date(row.deleted_at).toISOString() : null,
      attachments: null,
      // Sync fields (not in Entry type, but available)
      local_only: row.local_only,
      synced: row.synced,
      sync_action: row.sync_action,
      sync_error: row.sync_error,
    } as Entry;
  }

  /**
   * Get all categories
   */
  async getAllCategories(): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // Calculate entry_count dynamically by counting entries (excluding deleted)
    // Exclude categories marked for deletion
    // Filter by user_id to support multiple users
    let query = `
      SELECT
        c.*,
        COALESCE(COUNT(e.entry_id), 0) as entry_count
      FROM categories c
      LEFT JOIN entries e ON c.category_id = e.category_id
        AND (e.deleted_at IS NULL OR e.deleted_at = '')
    `;

    const params: any[] = [];

    // Add user_id filter if currentUserId is set
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
    return rows;
  }

  /**
   * Get a single category by ID
   */
  async getCategory(categoryId: string): Promise<any | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // Calculate entry_count dynamically by counting entries (excluding deleted)
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

    return row || null;
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
        0, // Not synced yet
        'create' // Pending create action
      ]
    );
  }

  /**
   * Update a category
   */
  async updateCategory(categoryId: string, updates: any): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // Only update timestamp if not provided (user edit vs sync update)
    const now = Date.now();
    const updatedAt = updates.updated_at !== undefined
      ? (typeof updates.updated_at === 'string' ? Date.parse(updates.updated_at) : updates.updated_at)
      : now;

    // If synced/sync_action provided (from pull sync), use those. Otherwise mark as needing sync.
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

    // Get the category to find its parent
    const category = await this.getCategory(categoryId);
    if (!category) return;

    const parentCategoryId = category.parent_category_id;

    // Move all entries in this category to the parent category (or uncategorized if no parent)
    await this.db.runAsync(
      `UPDATE entries
       SET category_id = ?, synced = 0
       WHERE category_id = ?`,
      [parentCategoryId, categoryId]
    );

    // Move all child categories to the parent category
    await this.db.runAsync(
      `UPDATE categories
       SET parent_category_id = ?, synced = 0
       WHERE parent_category_id = ?`,
      [parentCategoryId, categoryId]
    );

    // Mark category for deletion
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
      // Delete was synced, now remove from local DB
      await this.db.runAsync('DELETE FROM categories WHERE category_id = ?', [categoryId]);
    } else {
      // Mark as synced
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

  /**
   * Get all unique tags with entry counts
   * Returns array of {tag: string, count: number}
   */
  async getAllTags(): Promise<Array<{ tag: string; count: number }>> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // Get all non-deleted entries with tags
    const deleteFilter = this.hasDeletedAtColumn ? 'AND deleted_at IS NULL' : '';
    const rows = await this.db.getAllAsync<any>(
      `SELECT tags FROM entries
       WHERE tags IS NOT NULL
       AND tags != '[]'
       ${deleteFilter}`
    );

    // Aggregate tags and count occurrences
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

    // Convert to array and sort by count (desc) then by tag name (asc)
    return Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count; // Higher counts first
        }
        return a.tag.localeCompare(b.tag); // Alphabetical for same count
      });
  }

  /**
   * Get all unique mentions with entry counts
   * Returns array of {mention: string, count: number}
   */
  async getAllMentions(): Promise<Array<{ mention: string; count: number }>> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // Get all non-deleted entries with mentions
    const deleteFilter = this.hasDeletedAtColumn ? 'AND deleted_at IS NULL' : '';
    const rows = await this.db.getAllAsync<any>(
      `SELECT mentions FROM entries
       WHERE mentions IS NOT NULL
       AND mentions != '[]'
       ${deleteFilter}`
    );

    // Aggregate mentions and count occurrences
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

    // Convert to array and sort by count (desc) then by mention name (asc)
    return Array.from(mentionCounts.entries())
      .map(([mention, count]) => ({ mention, count }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count; // Higher counts first
        }
        return a.mention.localeCompare(b.mention); // Alphabetical for same count
      });
  }

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

    // Auto-cleanup old logs after adding
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

  /**
   * DEBUG: Run raw SQL query (development only)
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
   * Clear all data (for testing or logout)
   */
  async clearAllData(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      DELETE FROM photos;
      DELETE FROM entries;
      DELETE FROM categories;
      DELETE FROM sync_metadata;
      DELETE FROM sync_logs;
    `);

    console.log('🗑️ All local data cleared');
  }

  /**
   * Run custom SQL query (for debugging)
   */
  async runCustomQuery(sql: string, params?: any[]): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getAllAsync(sql, params || []);
    // Only log row count, not full data (can be massive)
    // console.log(`📊 Query returned ${result.length} rows`);
    return result;
  }

  /**
   * Set current user ID for query filtering
   * Call this after user signs in/switches accounts
   */
  setCurrentUser(userId: string): void {
    if (this.currentUserId !== userId) {
      console.log(`👤 Switched to user: ${userId}`);
      this.currentUserId = userId;
    }
  }

  /**
   * Clear current user (on sign out)
   */
  clearCurrentUser(): void {
    console.log('👤 Cleared current user');
    this.currentUserId = null;
  }

  // ========================================
  // PHOTO OPERATIONS
  // ========================================

  /**
   * Create a new photo record
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
  }): Promise<void> {
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
        now,
        now,
        photo.uploaded ? 1 : 0,
        0, // Not synced yet
        'create', // Mark for sync
      ]
    );

    console.log(`📸 Photo created: ${photo.photo_id}`);
  }

  /**
   * Get all photos for an entry (excludes photos marked for deletion)
   */
  async getPhotosForEntry(entryId: string): Promise<any[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM photos WHERE entry_id = ? AND (sync_action IS NULL OR sync_action != ?)';
    const params: any[] = [entryId, 'delete'];

    // Filter by current user if set
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
   * Update entry_id for all photos (used when entry is created with temp ID)
   * This fixes the issue where photos are saved before entry creation
   * Also renames local file paths to match new entry_id
   */
  async updatePhotoEntryIds(oldEntryId: string, newEntryId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    console.log(`📸 updatePhotoEntryIds: ${oldEntryId} → ${newEntryId}`);

    // Get all photos with the old entry_id
    const photos = await this.db.getAllAsync<any>(
      'SELECT photo_id, file_path, local_path FROM photos WHERE entry_id = ?',
      [oldEntryId]
    );

    console.log(`📸 Found ${photos.length} photos to update`);

    if (photos.length === 0) return;

    // Import FileSystem
    const FileSystem = await import('expo-file-system/legacy');

    // Update entry_id, file_path, and local_path for each photo
    for (const photo of photos) {
      console.log(`📸 Processing photo ${photo.photo_id}:`);
      console.log(`  Old path: ${photo.local_path}`);

      // Update file_path to use new entry_id (Supabase path)
      const newFilePath = photo.file_path.replace(oldEntryId, newEntryId);

      // Update local_path to use new entry_id (local file system path)
      let newLocalPath = photo.local_path ? photo.local_path.replace(oldEntryId, newEntryId) : null;

      console.log(`  New path: ${newLocalPath}`);

      // If photo has a local file, rename the directory
      if (photo.local_path && newLocalPath) {
        try {
          // Check if old file exists
          const oldFileInfo = await FileSystem.getInfoAsync(photo.local_path);
          console.log(`  Old file exists: ${oldFileInfo.exists}`);

          if (oldFileInfo.exists) {
            // Get new directory path
            const newDir = newLocalPath.substring(0, newLocalPath.lastIndexOf('/'));
            console.log(`  Creating new directory: ${newDir}`);

            // Create new directory
            await FileSystem.makeDirectoryAsync(newDir, { intermediates: true });

            // Move file from old path to new path
            console.log(`  Moving file...`);
            await FileSystem.moveAsync({
              from: photo.local_path,
              to: newLocalPath,
            });

            console.log(`✅ Moved photo file successfully`);

            // Verify file exists at new location
            const newFileInfo = await FileSystem.getInfoAsync(newLocalPath);
            console.log(`  New file exists: ${newFileInfo.exists}`);
          } else {
            console.log(`⚠️ Old file doesn't exist at ${photo.local_path}`);
          }
        } catch (error) {
          console.error(`❌ Failed to move photo file ${photo.photo_id}:`, error);
          // Continue with database update even if file move failed
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

    // Mark for deletion sync first
    await this.db.runAsync(
      'UPDATE photos SET sync_action = ?, synced = 0 WHERE photo_id = ?',
      ['delete', photoId]
    );

    console.log(`📸 Photo marked for deletion: ${photoId}`);
  }

  /**
   * Permanently delete a photo (after sync)
   */
  async permanentlyDeletePhoto(photoId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync('DELETE FROM photos WHERE photo_id = ?', [photoId]);
    console.log(`📸 Photo permanently deleted: ${photoId}`);
  }

  /**
   * Clean up orphaned photos (photos whose entries no longer exist)
   * Returns count of orphans found and marked for deletion
   *
   * PERFORMANCE NOTE: This is O(n) where n = total photos.
   * Use sparingly - recommended triggers:
   * - Manual user action (Database Info screen)
   * - Weekly background task
   * - After bulk entry deletions
   *
   * DO NOT run on every sync - it will slow down sync significantly with large photo counts.
   */
  async cleanupOrphanedPhotos(): Promise<number> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    console.log('🧹 Searching for orphaned photos...');

    // Get all photos (excluding already marked for deletion)
    let query = 'SELECT * FROM photos WHERE sync_action IS NULL OR sync_action != ?';
    const params: any[] = ['delete'];

    if (this.currentUserId) {
      query += ' AND user_id = ?';
      params.push(this.currentUserId);
    }

    const photos = await this.db.getAllAsync<any>(query, params);
    let orphanCount = 0;

    for (const photo of photos) {
      // Check if entry exists
      const entry = await this.getEntry(photo.entry_id);

      // If entry doesn't exist or is deleted, mark photo for deletion
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

    // Sync photos if:
    // 1. Parent entry has been synced (for create/update) OR
    // 2. Photo is marked for deletion (delete even if entry not synced or deleted)
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

  /**
   * Get current user ID
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }
}

// Export singleton instance
export const localDB = new LocalDatabase();
