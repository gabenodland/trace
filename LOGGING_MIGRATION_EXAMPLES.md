# Logging Service Migration Examples

This document shows how to replace console.log statements with the new logging service.

## Basic Usage Examples

### Before (Bad)
```typescript
console.log('User logged in');
console.log('Syncing entries...');
console.log('✅ Sync complete');
console.error('Failed to save:', error);
```

### After (Good)
```typescript
import { logger } from '../shared/utils/logger';

logger.info('User logged in');
logger.debug('Syncing entries');
logger.success('Sync complete');
logger.error('Failed to save', error);
```

---

## Real Examples from Codebase

### Example 1: syncQueue.ts

#### Before (lines 154-159)
```typescript
console.log('🔄 Sync queue initialized');
console.log('📝 Starting initial sync...');
try {
  await this.performSync();
  console.log('✅ Initial sync completed');
} catch (error) {
  console.error('❌ Initial sync failed:', error);
}
```

#### After
```typescript
import { createScopedLogger } from '../shared/utils/logger';

const log = createScopedLogger('SyncQueue');

log.info('Sync queue initialized');
log.debug('Starting initial sync');
try {
  await this.performSync();
  log.success('Initial sync completed');
} catch (error) {
  log.error('Initial sync failed', error);
}
```

**Benefits:**
- All logs from SyncQueue are prefixed with `[SyncQueue]`
- Easy to filter logs by module
- Debug logs automatically hidden in production

---

### Example 2: localDB.ts

#### Before (lines 327-333)
```typescript
async saveEntry(entry: Entry): Promise<void> {
  console.log('💾 Saving entry to local database');
  const user = this.getUser();
  console.log('User ID:', user.id);

  // ... save logic

  console.log('✅ Entry saved successfully');
}
```

#### After
```typescript
import { createScopedLogger } from '../shared/utils/logger';

const log = createScopedLogger('LocalDB');

async saveEntry(entry: Entry): Promise<void> {
  const user = this.getUser();

  log.debug('Saving entry to local database', {
    entryId: entry.entry_id,
    userId: user.id
  });

  // ... save logic

  log.success('Entry saved successfully', { entryId: entry.entry_id });
}
```

**Benefits:**
- Structured context data (entryId, userId) instead of separate logs
- Debug logs don't clutter production console
- Context object can be sent to error tracking services

---

### Example 3: Photo Upload with Performance Timing

#### Before (lines 1289-1310 in syncQueue.ts)
```typescript
async uploadPhoto(photoId: string) {
  console.log('📸 Starting photo upload:', photoId);
  const startTime = Date.now();

  try {
    // ... upload logic
    const duration = Date.now() - startTime;
    console.log(`✅ Photo uploaded in ${duration}ms`);
  } catch (error) {
    console.error('❌ Photo upload failed:', error);
  }
}
```

#### After
```typescript
import { createScopedLogger } from '../shared/utils/logger';

const log = createScopedLogger('PhotoSync');

async uploadPhoto(photoId: string) {
  log.time(`Photo upload ${photoId}`);
  log.debug('Starting photo upload', { photoId });

  try {
    // ... upload logic
    log.timeEnd(`Photo upload ${photoId}`);
    log.success('Photo uploaded', { photoId });
  } catch (error) {
    log.timeEnd(`Photo upload ${photoId}`);
    log.error('Photo upload failed', error, { photoId });
  }
}
```

**Benefits:**
- Automatic timing with `time()` and `timeEnd()`
- Consistent context (photoId) in all logs
- Performance metrics visible in development, hidden in production

---

### Example 4: Complex Operation with Grouped Logs

#### Before (DatabaseInfoScreen.tsx lines 200-230)
```typescript
const handleFullSync = async () => {
  console.log('🔄 Starting full sync...');
  console.log('Step 1: Pulling entries');
  // ... pull entries
  console.log('✅ Entries pulled');

  console.log('Step 2: Pulling categories');
  // ... pull categories
  console.log('✅ Categories pulled');

  console.log('Step 3: Pulling photos');
  // ... pull photos
  console.log('✅ Photos pulled');

  console.log('✅ Full sync complete');
};
```

#### After
```typescript
import { logger } from '../shared/utils/logger';

const handleFullSync = async () => {
  logger.group('Full Sync');
  logger.info('Starting full sync');

  try {
    logger.debug('Pulling entries');
    // ... pull entries
    logger.success('Entries pulled');

    logger.debug('Pulling categories');
    // ... pull categories
    logger.success('Categories pulled');

    logger.debug('Pulling photos');
    // ... pull photos
    logger.success('Photos pulled');

    logger.success('Full sync complete');
  } catch (error) {
    logger.error('Full sync failed', error);
  } finally {
    logger.groupEnd();
  }
};
```

**Benefits:**
- Related logs grouped together in console
- Easy to collapse/expand in browser dev tools
- Clear start and end of operation

---

## Environment-Specific Behavior

### Development Mode (`__DEV__ = true`)
```typescript
logger.debug('This appears');  // ✓ Shows in console
logger.info('This appears');   // ✓ Shows in console
logger.warn('This appears');   // ✓ Shows in console
logger.error('This appears');  // ✓ Shows in console
```

### Production Mode (`__DEV__ = false`)
```typescript
logger.debug('Hidden');        // ✗ Removed at build time
logger.info('Hidden');         // ✗ Hidden
logger.warn('This appears');   // ✓ Shows (warnings important)
logger.error('This appears');  // ✓ Shows (errors critical)
```

---

## Advanced: Adding Remote Error Tracking

Update `logger.ts` to send errors to Sentry (or similar):

```typescript
// In logger.ts error() method:
error(message: string, error?: Error | unknown, context?: LogContext) {
  if (this.currentLevel <= LogLevel.ERROR) {
    const prefix = this.enableEmojis ? '❌' : '[ERROR]';
    console.error(`${prefix} ${message}`, error || '', context || '');

    // Send to Sentry in production
    if (!__DEV__ && error instanceof Error) {
      Sentry.captureException(error, {
        extra: {
          message,
          ...context,
        },
      });
    }
  }
}
```

---

## Migration Strategy

### Step 1: Install the logger
Already done - file created at `src/shared/utils/logger.ts`

### Step 2: Import in existing files
```typescript
// At top of file
import { logger } from '../shared/utils/logger';
// OR for scoped logging:
import { createScopedLogger } from '../shared/utils/logger';
const log = createScopedLogger('ModuleName');
```

### Step 3: Replace console statements
Use find & replace patterns:

| Find | Replace |
|------|---------|
| `console.log('✅` | `logger.success('` |
| `console.log('❌` | `logger.error('` |
| `console.log('🔍` | `logger.debug('` |
| `console.log(` | `logger.info(` |
| `console.error(` | `logger.error(` |
| `console.warn(` | `logger.warn(` |

### Step 4: Add context objects
Instead of:
```typescript
logger.info('User ID: ' + userId);
```

Do:
```typescript
logger.info('User action', { userId });
```

---

## Testing the Logger

Try in any component:
```typescript
import { logger } from '../shared/utils/logger';

// Test all log levels
logger.debug('Debug message');
logger.info('Info message');
logger.warn('Warning message');
logger.error('Error message', new Error('Test error'));
logger.success('Success message');

// Test with context
logger.info('User event', { userId: '123', action: 'login' });

// Test timing
logger.time('Operation');
// ... do work
logger.timeEnd('Operation');

// Test grouping
logger.group('Batch operation');
logger.info('Step 1');
logger.info('Step 2');
logger.groupEnd();
```

---

## FAQ

### Q: Will old console.logs break the app?
**A:** No, console.log still works. You can migrate gradually.

### Q: Can I disable all logging?
**A:** Yes: `logger.setLevel(LogLevel.NONE);`

### Q: Can I see debug logs in production for testing?
**A:** Yes, temporarily: `logger.setLevel(LogLevel.DEBUG);`

### Q: Does this affect performance?
**A:** No, debug logs are completely removed in production builds by the bundler.

### Q: Can I customize the emoji/formatting?
**A:** Yes, modify the Logger class in `logger.ts`

### Q: How do I log to a file?
**A:** Extend the Logger class to write to filesystem using `react-native-fs` or similar

---

## Next Steps

1. ✅ Logger created
2. 📝 Migrate high-traffic files first (syncQueue, localDB)
3. 🧹 Remove old console.logs gradually
4. 📊 Add Sentry/remote logging for production errors
5. 📈 Add performance tracking for slow operations
