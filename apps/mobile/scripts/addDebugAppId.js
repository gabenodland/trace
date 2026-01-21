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

async function main() {
  addApplicationIdSuffix();
  await addDebugIcon();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
