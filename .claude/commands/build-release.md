# Build Release APK

Build a release APK for Android.

## Instructions

### 1. Run tests first

```bash
npm run test:run
npm run type-check:mobile
```

If tests fail, stop and report the failures. Do NOT proceed with a broken build.

### 2. Build release

```bash
cd apps/mobile && npm run build:release
```

This runs: `incrementBuildNumber.js` → `prebuild` → `gradlew assembleRelease`

### 3. Verify output

Check that the APK was created:

```bash
ls -la apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

### 4. Report

Tell the user:
- Build number (from `apps/mobile/build-number.json`)
- Version (from `apps/mobile/app.config.js`)
- APK location
- APK file size
