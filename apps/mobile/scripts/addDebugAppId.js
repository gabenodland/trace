#!/usr/bin/env node
/**
 * Configures debug builds with:
 * 1. applicationIdSuffix ".dev" - allows running dev and release side-by-side
 * 2. Debug icon from assets/adaptive-icon-debug.png (if exists)
 *
 * Run after expo prebuild: node scripts/addDebugAppId.js
 */

const fs = require("fs");
const path = require("path");

const androidPath = path.join(__dirname, "../android");
const buildGradlePath = path.join(androidPath, "app/build.gradle");
const debugIconPath = path.join(__dirname, "../assets/adaptive-icon-debug.png");

// Android adaptive icon foreground sizes per density
const ICON_SIZES = {
  "mipmap-mdpi": 108,
  "mipmap-hdpi": 162,
  "mipmap-xhdpi": 216,
  "mipmap-xxhdpi": 324,
  "mipmap-xxxhdpi": 432,
};

async function addDebugIcon() {
  if (!fs.existsSync(debugIconPath)) {
    console.log("No debug icon found at assets/adaptive-icon-debug.png - skipping");
    return;
  }

  // Check if already done by looking for the debug res folder
  const debugResPath = path.join(androidPath, "app/src/debug/res");
  const markerFile = path.join(debugResPath, ".debug-icon-installed");

  if (fs.existsSync(markerFile)) {
    console.log("Debug icon already installed");
    return;
  }

  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    console.log("sharp not installed - skipping debug icon (run: npm install --save-dev sharp)");
    return;
  }

  console.log("Installing debug icon...");

  // Create debug res folders and resize icon for each density
  for (const [folder, size] of Object.entries(ICON_SIZES)) {
    const destDir = path.join(debugResPath, folder);
    fs.mkdirSync(destDir, { recursive: true });

    const destFile = path.join(destDir, "ic_launcher_foreground.png");

    await sharp(debugIconPath)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toFile(destFile);

    console.log(`  Created ${folder}/ic_launcher_foreground.png (${size}x${size})`);
  }

  // Write marker file
  fs.writeFileSync(markerFile, new Date().toISOString());
  console.log("Debug icon installed successfully");
}

function addApplicationIdSuffix() {
  if (!fs.existsSync(buildGradlePath)) {
    console.log("build.gradle not found - run expo prebuild first");
    process.exit(1);
  }

  let buildGradle = fs.readFileSync(buildGradlePath, "utf8");

  if (buildGradle.includes("applicationIdSuffix")) {
    console.log("applicationIdSuffix already present");
    return;
  }

  // Find the debug block inside buildTypes and add applicationIdSuffix
  const regex = /(buildTypes\s*\{[\s\S]*?debug\s*\{\s*\n\s*)(signingConfig signingConfigs\.debug)/;

  if (!regex.test(buildGradle)) {
    console.log("ERROR: Could not find debug block in buildTypes");
    process.exit(1);
  }

  buildGradle = buildGradle.replace(
    regex,
    `$1$2\n            // Different app ID allows running dev and release side-by-side\n            applicationIdSuffix ".dev"`
  );

  fs.writeFileSync(buildGradlePath, buildGradle);
  console.log("Added applicationIdSuffix '.dev' to debug build");
}

function patchSplashIconBackground() {
  const stylesPath = path.join(androidPath, "app/src/main/res/values/styles.xml");
  if (!fs.existsSync(stylesPath)) return;

  let styles = fs.readFileSync(stylesPath, "utf-8");
  if (!styles.includes("android:windowSplashScreenIconBackgroundColor")) {
    const ANCHOR = '<item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>';
    if (!styles.includes(ANCHOR)) {
      throw new Error(
        "patchSplashIconBackground: could not find anchor string in styles.xml. " +
        "expo-splash-screen may have changed its output format."
      );
    }
    styles = styles.replace(
      ANCHOR,
      ANCHOR + '\n    <item name="android:windowSplashScreenIconBackgroundColor">@color/splashscreen_background</item>' +
      '\n    <item name="android:windowSplashScreenBehavior">icon_preferred</item>'
    );
    fs.writeFileSync(stylesPath, styles, "utf-8");
    console.log("Patched splash icon background + icon_preferred in values/styles.xml");
  } else {
    console.log("Splash icon background already patched in values/styles.xml");
  }

  // Also create values-night/styles.xml override so the icon circle is dark in dark mode
  const nightDir = path.join(androidPath, "app/src/main/res/values-night");
  const nightStylesPath = path.join(nightDir, "styles.xml");

  if (!fs.existsSync(nightDir)) {
    fs.mkdirSync(nightDir, { recursive: true });
  }

  const NIGHT_STYLES_XML = `<resources xmlns:tools="http://schemas.android.com/tools">
  <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">
    <item name="windowSplashScreenBackground">@color/splashscreen_background</item>
    <item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>
    <item name="android:windowSplashScreenIconBackgroundColor">@color/splashscreen_background</item>
    <item name="postSplashScreenTheme">@style/AppTheme</item>
    <item name="android:windowSplashScreenBehavior">icon_preferred</item>
  </style>
</resources>
`;
  fs.writeFileSync(nightStylesPath, NIGHT_STYLES_XML, "utf-8");
  console.log("Created values-night/styles.xml with dark splash icon background");
}

// Splash drawable folders expo generates
const SPLASH_FOLDERS = [
  "drawable-mdpi",
  "drawable-hdpi",
  "drawable-xhdpi",
  "drawable-xxhdpi",
  "drawable-xxxhdpi",
];

/**
 * Strip white background from expo-generated splash logos so they render
 * correctly on dark splash backgrounds.
 *
 * HACK: This is a pixel-level chroma-key — it cannot distinguish "background
 * white" from "intentional white in the logo". The correct long-term fix is to
 * source a splash-icon.png that already has a transparent background. This
 * workaround exists because the current source PNG has a white bg and expo's
 * splash plugin does not support transparent icon backgrounds natively.
 *
 * If the logo ever contains white interior elements (text, highlights), they
 * will be incorrectly made transparent. Replace the source PNG at that point.
 */
async function makeSplashLogosTransparent() {
  let sharp;
  try {
    sharp = require("sharp");
  } catch {
    throw new Error(
      "sharp is required for splash transparency. Install it: npm install --save-dev sharp"
    );
  }

  console.log("Making splash logos transparent (removing white background)...");
  const resDir = path.join(androidPath, "app/src/main/res");
  const THRESHOLD = 250; // pixels with R,G,B all >= this become transparent

  for (const folder of SPLASH_FOLDERS) {
    const filePath = path.join(resDir, folder, "splashscreen_logo.png");
    if (!fs.existsSync(filePath)) continue;

    // Read existing expo-generated PNG, get raw pixels
    const image = sharp(filePath);

    // Ensure RGBA
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    // Count opaque white pixels to decide if processing is needed.
    // Skip if fewer than 10% are opaque white (already processed or transparent source).
    const totalPixels = info.width * info.height;
    let opaqueWhiteCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] >= THRESHOLD && data[i + 1] >= THRESHOLD && data[i + 2] >= THRESHOLD && data[i + 3] === 255) {
        opaqueWhiteCount++;
      }
    }
    if (opaqueWhiteCount < totalPixels * 0.1) {
      console.log(`  Skipped ${folder}/splashscreen_logo.png (only ${opaqueWhiteCount} opaque white pixels — already processed)`);
      continue;
    }

    // Replace white/near-white pixels with transparent
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] >= THRESHOLD && data[i + 1] >= THRESHOLD && data[i + 2] >= THRESHOLD) {
        data[i + 3] = 0; // set alpha to 0
      }
    }

    await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toFile(filePath + ".tmp");

    // Replace original
    fs.renameSync(filePath + ".tmp", filePath);

    console.log(`  Made ${folder}/splashscreen_logo.png transparent (${info.width}x${info.height})`);
  }
}

async function main() {
  addApplicationIdSuffix();
  await addDebugIcon();
  patchSplashIconBackground();
  await makeSplashLogosTransparent();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
