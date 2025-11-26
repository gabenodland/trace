# Logging Strategy for Trace Mobile App

## What Actually Needs to Be Logged?

Out of **289 console.log statements**, probably only **20-30** are truly valuable.

---

## ✅ KEEP - Log These (Critical for Production)

### 1. **Errors & Failures**
Things that break user workflows or data integrity:

```typescript
// Database errors
logger.error('Failed to save entry', error, { entryId });

// Sync failures
logger.error('Sync failed', error, { operation: 'pullEntries' });

// Photo upload failures
logger.error('Photo upload failed', error, { photoId, fileSize });

// Network errors
logger.error('Network request failed', error, { endpoint });
```

**Why:** You need to know when things break in production.

---

### 2. **Critical User Actions**
High-value events for understanding user behavior:

```typescript
// User authentication
logger.info('User logged in', { userId });
logger.info('User logged out');

// Entry lifecycle (the core feature)
logger.info('Entry created', { entryId, hasPhotos, categoryId });
logger.info('Entry deleted', { entryId });

// Sync operations (critical for offline-first)
logger.info('Sync started', { trigger: 'realtime' | 'manual' | 'app-open' });
logger.info('Sync completed', {
  entriesPulled,
  entriesPushed,
  duration
});
```

**Why:** Understand how users actually use the app.

---

### 3. **Performance Issues**
Operations that might be slow:

```typescript
// Photo processing
logger.warn('Photo compression slow', {
  photoId,
  originalSize,
  duration
});

// Large syncs
logger.warn('Large sync detected', {
  entriesCount: 500,
  duration: 5000
});

// Database queries
logger.warn('Slow query', {
  table: 'entries',
  duration: 2000
});
```

**Why:** Find performance bottlenecks affecting user experience.

---

### 4. **Data Corruption / Unexpected State**
Things that should never happen:

```typescript
// Missing required data
logger.warn('Entry missing user_id', { entryId });

// Invalid state
logger.warn('Category not found', { categoryId });

// Sync conflicts
logger.warn('Sync conflict detected', {
  entryId,
  localVersion,
  remoteVersion
});
```

**Why:** Catch data issues before they cause bigger problems.

---

## ❌ REMOVE - Don't Log These

### 1. **Debug Noise**
Lines 154-159 in syncQueue.ts:
```typescript
console.log('🔄 Sync queue initialized');
console.log('📝 Starting initial sync...');
console.log('✅ Initial sync completed');
```

**Why remove:**
- Not useful in production
- Clutters logs
- Can stay in development only

**Replace with:**
```typescript
// Remove entirely, or use debug level:
logger.debug('Sync queue initialized');
// This won't appear in production
```

---

### 2. **Step-by-Step Progress**
Lines 1162-1425 in syncQueue.ts (photo sync):
```typescript
console.log('🔍 DEBUG: About to call pullPhotosFromSupabase...');
console.log('🔍 DEBUG: forceFullPull =', forceFullPull);
console.log('🔍 DEBUG: pullStartTime =', pullStartTime);
console.log('📸 Fetching photos from Supabase...');
console.log('📸 Found X photos from Supabase');
console.log('📸 Processing photo 1 of 10...');
// ... etc
```

**Why remove:**
- Too granular for production
- Creates 100+ log lines per sync
- Only useful when debugging specific issue

**Replace with:**
```typescript
// Single log with summary:
logger.info('Photos synced', {
  photosDownloaded: 10,
  photosFailed: 1,
  duration: 5000
});

// Or keep as debug (auto-removed in production):
logger.debug('Processing photo', { photoId, index: 1, total: 10 });
```

---

### 3. **Function Entry/Exit**
```typescript
console.log('Entering handleSave function');
// ... function logic
console.log('Exiting handleSave function');
```

**Why remove:**
- Not useful in production
- Better handled by debugger
- Can use performance timing instead

**Replace with:**
```typescript
// Only if performance matters:
logger.time('handleSave');
// ... function logic
logger.timeEnd('handleSave');
```

---

### 4. **Variable Inspection**
Lines 37-50 in localDB.ts:
```typescript
console.log('Database initialized at:', this.db!.databaseName);
console.log('User ID:', user.id);
console.log('Entry ID:', entryId);
console.log('Category count:', categories.length);
```

**Why remove:**
- Use debugger instead
- Not useful without context in production
- Creates noise

**Replace with:**
```typescript
// Only log when something is wrong:
if (!user.id) {
  logger.error('Missing user ID in database operation');
}

// Or include in structured context:
logger.info('Database query completed', {
  categoryCount: categories.length
});
```

---

### 5. **Success Messages Without Context**
```typescript
console.log('✅ Saved!');
console.log('Done');
console.log('OK');
```

**Why remove:**
- Doesn't tell you WHAT succeeded
- Not actionable
- Creates noise

**Replace with:**
```typescript
// Provide context:
logger.success('Entry saved', { entryId });

// Or remove entirely
```

---

## 📊 Recommended Logging Categories

### **Category 1: Production Errors (Always On)**
```typescript
logger.error()  // Send to Sentry
logger.warn()   // Send to Sentry (lower priority)
```

**Examples:**
- Database save fails
- Network request fails
- Photo upload fails
- Sync conflict
- Data validation error

**Output:** Console + Sentry/error tracking service

---

### **Category 2: User Analytics (Production)**
```typescript
logger.info()  // Log to analytics service
```

**Examples:**
- User logged in
- Entry created/edited/deleted
- Photo added
- Category changed
- Sync completed
- Feature used (map, calendar, etc.)

**Output:** Console + Analytics (Mixpanel, Amplitude, etc.)

---

### **Category 3: Performance Monitoring (Production)**
```typescript
logger.time() / logger.timeEnd()
logger.warn() for slow operations
```

**Examples:**
- Photo compression time
- Sync duration
- Database query time
- Large data operations

**Output:** Console + Performance monitoring (Sentry Performance)

---

### **Category 4: Debug Information (Development Only)**
```typescript
logger.debug()  // Removed in production builds
```

**Examples:**
- Function entry/exit
- State changes
- Step-by-step progress
- Variable inspection
- Network request details

**Output:** Console (development only)

---

## 🎯 Practical Examples from Your Codebase

### Example 1: syncQueue.ts - Lines 154-159

#### Current (Too Verbose):
```typescript
console.log('🔄 Initializing sync queue...');
console.log('📝 Starting initial sync...');
try {
  await this.performSync();
  console.log('✅ Initial sync completed');
} catch (error) {
  console.error('❌ Initial sync failed:', error);
}
```

#### Recommended (Actionable):
```typescript
try {
  logger.time('Initial sync');
  await this.performSync();
  logger.timeEnd('Initial sync');

  // Only log summary
  logger.info('Sync completed', {
    trigger: 'initialization',
    entriesSynced: this.entriesSyncedCount
  });
} catch (error) {
  // THIS is important for production
  logger.error('Initial sync failed', error, {
    trigger: 'initialization'
  });
}
```

**Result:** 4 logs → 1 log (production), with more useful information

---

### Example 2: Photo Upload - Lines 1289-1310

#### Current (Debug Noise):
```typescript
console.log('📸 Starting photo upload:', photoId);
console.log('📸 Compressing photo...');
console.log('📸 Compressed to:', compressedSize);
console.log('📸 Uploading to Supabase...');
console.log('📸 Upload progress:', progress);
console.log('✅ Photo uploaded successfully');
```

#### Recommended (Structured):
```typescript
logger.time(`Photo upload ${photoId}`);

try {
  // ... upload logic

  logger.timeEnd(`Photo upload ${photoId}`);

  logger.info('Photo uploaded', {
    photoId,
    originalSize,
    compressedSize,
    compressionRatio: (compressedSize / originalSize).toFixed(2)
  });
} catch (error) {
  logger.error('Photo upload failed', error, {
    photoId,
    originalSize
  });
}
```

**Result:** 6 logs → 1 log, with timing and compression metrics

---

### Example 3: Entry Save - CaptureForm.tsx

#### Current:
```typescript
console.log('Saving entry...');
console.log('Entry ID:', entryId);
console.log('Content length:', content.length);
console.log('Has photos:', photoCount > 0);
// ... save logic
console.log('✅ Entry saved');
```

#### Recommended:
```typescript
try {
  logger.time('Entry save');
  // ... save logic
  logger.timeEnd('Entry save');

  logger.info('Entry saved', {
    entryId,
    contentLength: content.length,
    photoCount,
    categoryId,
    hasLocation: !!locationId
  });
} catch (error) {
  logger.error('Failed to save entry', error, {
    contentLength: content.length,
    photoCount
  });
}
```

**Result:** 5 logs → 1 structured log with all context

---

## 🔧 Implementation Plan

### Phase 1: Add Critical Error Logging (1 hour)
Only add `logger.error()` for actual errors:
- Database failures
- Network failures
- Sync failures
- Photo upload failures

**Files:** localDB.ts, syncQueue.ts, mobilePhotoApi.ts

---

### Phase 2: Add User Analytics (2 hours)
Add `logger.info()` for key user actions:
- Entry created/edited/deleted
- User login/logout
- Sync completed
- Photo added

**Files:** CaptureForm.tsx, syncQueue.ts, AuthContext.tsx

---

### Phase 3: Remove Debug Noise (2 hours)
Replace verbose console.logs with single summary logs:
- Remove step-by-step progress
- Remove variable inspection
- Keep only debug logs for development

**Files:** syncQueue.ts (biggest offender), localDB.ts

---

### Phase 4: Add Remote Error Tracking (4 hours)
Set up Sentry (or similar) to collect production errors:
```typescript
// In logger.ts error() method:
if (!__DEV__) {
  Sentry.captureException(error, { extra: context });
}
```

**Setup:** Sentry account, SDK integration, source maps

---

## 📈 Expected Impact

### Before:
- 289 console.log statements
- Cluttered console
- No production error tracking
- No user analytics
- No performance monitoring

### After:
- ~30 strategic log statements
- Clean, readable logs
- Production errors tracked in Sentry
- User behavior tracked in analytics
- Performance issues identified

---

## 🎬 Ready to Start?

**Option A: Critical Errors First (Quick Win)**
- Add logger.error() for database, sync, network failures
- Takes 1 hour
- Immediate value for production monitoring

**Option B: Full Cleanup (Comprehensive)**
- Remove debug noise from syncQueue.ts
- Add structured logging throughout
- Takes 4-6 hours
- Clean codebase + production monitoring

**Which would you prefer?**
