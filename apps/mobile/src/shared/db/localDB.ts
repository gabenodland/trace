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
   * Create all database tables
   */
  /**
   * Run database migrations for schema changes
   */
  private async runMigrations(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    try {
      // Check current schema version (handle case where sync_metadata doesn't exist yet)
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

      // Migration 1: Add deleted_at column
      if (currentVersion < 1) {
        console.log('⬆️ Running migration 1: Add deleted_at column');

        // Check if column already exists by querying table info
        const tableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(entries)');
        const hasDeletedAt = tableInfo.some((col: any) => col.name === 'deleted_at');

        if (!hasDeletedAt) {
          // Add the column
          await this.db.execAsync('ALTER TABLE entries ADD COLUMN deleted_at INTEGER;');
          console.log('  ✓ Added deleted_at column');

          // Create index
          await this.db.execAsync('CREATE INDEX IF NOT EXISTS idx_entries_deleted_at ON entries(deleted_at);');
          console.log('  ✓ Created deleted_at index');

          this.hasDeletedAtColumn = true;
        } else {
          console.log('  ℹ️ deleted_at column already exists');
          this.hasDeletedAtColumn = true;
        }

        // Mark migration as complete
        await this.db.runAsync(
          'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
          ['schema_version', '1', Date.now()]
        );
        console.log('✅ Migration 1 complete');
      } else {
        // Migration already completed in a previous run
        // Check if column exists
        const tableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(entries)');
        this.hasDeletedAtColumn = tableInfo.some((col: any) => col.name === 'deleted_at');
      }

      // Migration 2: Add sync fields to categories table
      if (currentVersion < 2) {
        console.log('⬆️ Running migration 2: Add sync fields to categories');

        const catTableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(categories)');
        const hasSynced = catTableInfo.some((col: any) => col.name === 'synced');

        if (!hasSynced) {
          await this.db.execAsync('ALTER TABLE categories ADD COLUMN synced INTEGER DEFAULT 0;');
          await this.db.execAsync('ALTER TABLE categories ADD COLUMN sync_action TEXT;');
          await this.db.execAsync('ALTER TABLE categories ADD COLUMN sync_error TEXT;');
          console.log('  ✓ Added sync fields to categories');
        } else {
          console.log('  ℹ️ categories sync fields already exist');
        }

        // Create index for synced column (whether we just added it or it already existed)
        await this.db.execAsync('CREATE INDEX IF NOT EXISTS idx_categories_synced ON categories(synced);');
        console.log('  ✓ Created synced index');

        await this.db.runAsync(
          'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
          ['schema_version', '2', Date.now()]
        );
        console.log('✅ Migration 2 complete');
      }

      // Migration 3: Add updated_at column to categories
      if (currentVersion < 3) {
        console.log('⬆️ Running migration 3: Add updated_at to categories');

        const catTableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(categories)');
        const hasUpdatedAt = catTableInfo.some((col: any) => col.name === 'updated_at');

        if (!hasUpdatedAt) {
          // Add updated_at column with default value (same as created_at initially)
          await this.db.execAsync('ALTER TABLE categories ADD COLUMN updated_at INTEGER NOT NULL DEFAULT 0;');

          // Update existing rows to set updated_at = created_at
          await this.db.execAsync('UPDATE categories SET updated_at = created_at WHERE updated_at = 0;');

          console.log('  ✓ Added updated_at column to categories');
        } else {
          console.log('  ℹ️ categories updated_at column already exists');
        }

        await this.db.runAsync(
          'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
          ['schema_version', '3', Date.now()]
        );
        console.log('✅ Migration 3 complete');
      }

      // Migration 4: Add entry_date column to entries
      if (currentVersion < 4) {
        console.log('⬆️ Running migration 4: Add entry_date to entries');

        const entriesTableInfo = await this.db.getAllAsync<any>('PRAGMA table_info(entries)');
        const hasEntryDate = entriesTableInfo.some((col: any) => col.name === 'entry_date');

        if (!hasEntryDate) {
          // Add entry_date column
          await this.db.execAsync('ALTER TABLE entries ADD COLUMN entry_date INTEGER;');

          // Set entry_date = created_at for existing entries
          await this.db.execAsync('UPDATE entries SET entry_date = created_at WHERE entry_date IS NULL;');

          console.log('  ✓ Added entry_date column to entries');

          // Create index for entry_date
          await this.db.execAsync('CREATE INDEX IF NOT EXISTS idx_entries_entry_date ON entries(entry_date);');
          console.log('  ✓ Created entry_date index');
        } else {
          console.log('  ℹ️ entries entry_date column already exists');
        }

        await this.db.runAsync(
          'INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES (?, ?, ?)',
          ['schema_version', '4', Date.now()]
        );
        console.log('✅ Migration 4 complete');
      }

      console.log('✅ All migrations complete');
    } catch (error) {
      console.error('❌ Migration failed:', error);
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
        location_lat REAL,
        location_lng REAL,
        location_accuracy REAL,
        location_name TEXT,
        status TEXT CHECK (status IN ('none', 'incomplete', 'complete')) DEFAULT 'none',
        due_date INTEGER,             -- Unix timestamp
        completed_at INTEGER,         -- Unix timestamp
        created_at INTEGER NOT NULL,  -- Unix timestamp
        updated_at INTEGER NOT NULL,  -- Unix timestamp
        deleted_at INTEGER,           -- Unix timestamp (soft delete)

        -- Sync tracking fields
        local_only INTEGER DEFAULT 0,     -- 0 = sync enabled, 1 = local only
        synced INTEGER DEFAULT 0,         -- 0 = needs sync, 1 = synced
        sync_action TEXT,                 -- 'create', 'update', 'delete', or NULL
        sync_error TEXT,                  -- Error message if sync failed
        sync_retry_count INTEGER DEFAULT 0,
        sync_last_attempt INTEGER         -- Unix timestamp of last sync attempt
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_entries_user_id ON entries(user_id);
      CREATE INDEX IF NOT EXISTS idx_entries_created_at ON entries(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_entries_category_id ON entries(category_id);
      CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status);
      CREATE INDEX IF NOT EXISTS idx_entries_synced ON entries(synced);
      CREATE INDEX IF NOT EXISTS idx_entries_local_only ON entries(local_only);
      -- Note: idx_entries_deleted_at is created in migration 1

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

        -- Sync tracking fields
        synced INTEGER DEFAULT 0,         -- 0 = needs sync, 1 = synced
        sync_action TEXT,                 -- 'create', 'update', 'delete', or NULL
        sync_error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
      CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_category_id);
      -- Note: idx_categories_synced is created in migration 2

      -- Sync metadata table
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
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
        category_id, entry_date, location_lat, location_lng, location_accuracy, location_name,
        status, due_date, completed_at, created_at, updated_at,
        local_only, synced, sync_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.entry_id,
        entry.user_id,
        entry.title || null,
        entry.content,
        JSON.stringify(entry.tags || []),
        JSON.stringify(entry.mentions || []),
        entry.category_id || null,
        entry.entry_date ? Date.parse(entry.entry_date) : (entry.created_at ? Date.parse(entry.created_at) : now),
        entry.location_lat || null,
        entry.location_lng || null,
        entry.location_accuracy || null,
        entry.location_name || null,
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

    const row = await this.db.getFirstAsync<any>(
      'SELECT * FROM entries WHERE entry_id = ?',
      [entryId]
    );

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
  }): Promise<Entry[]> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    let query = 'SELECT * FROM entries WHERE 1=1';
    const params: any[] = [];

    // Exclude soft-deleted entries unless explicitly requested
    // Only apply filter if deleted_at column exists (post-migration)
    if (!filter?.includeDeleted && this.hasDeletedAtColumn) {
      query += ' AND deleted_at IS NULL';
    }

    if (filter) {
      if (filter.category_id !== undefined) {
        if (filter.category_id === null) {
          query += ' AND category_id IS NULL';
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
        category_id = ?, entry_date = ?, location_lat = ?, location_lng = ?, location_accuracy = ?,
        location_name = ?, status = ?, due_date = ?, completed_at = ?,
        updated_at = ?, local_only = ?, synced = ?, sync_action = ?
      WHERE entry_id = ?`,
      [
        updated.title || null,
        updated.content,
        JSON.stringify(updated.tags || []),
        JSON.stringify(updated.mentions || []),
        updated.category_id || null,
        updated.entry_date ? Date.parse(updated.entry_date) : null,
        updated.location_lat || null,
        updated.location_lng || null,
        updated.location_accuracy || null,
        updated.location_name || null,
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
      location_lat: row.location_lat,
      location_lng: row.location_lng,
      location_accuracy: row.location_accuracy,
      location_name: row.location_name,
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

    const rows = await this.db.getAllAsync<any>('SELECT * FROM categories ORDER BY full_path');
    return rows;
  }

  /**
   * Get a single category by ID
   */
  async getCategory(categoryId: string): Promise<any | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const row = await this.db.getFirstAsync<any>(
      'SELECT * FROM categories WHERE category_id = ?',
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
        color = ?,
        icon = ?,
        updated_at = ?,
        synced = ?,
        sync_action = ?
      WHERE category_id = ?`,
      [
        updates.name,
        updates.full_path,
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
   * Clear all data (for testing or logout)
   */
  async clearAllData(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      DELETE FROM entries;
      DELETE FROM categories;
      DELETE FROM sync_metadata;
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
    console.log('📊 Query result:', result);
    return result;
  }
}

// Export singleton instance
export const localDB = new LocalDatabase();
