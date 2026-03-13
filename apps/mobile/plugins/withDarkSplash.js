/**
 * Expo config plugin: Dark mode splash screen
 *
 * Creates values-night/colors.xml so the native splash screen uses a dark
 * background when the device is in dark mode.
 * Android resolves values-night automatically — no JS needed.
 *
 * Note: The splash icon circle (windowSplashScreenIconBackgroundColor) is
 * patched in scripts/addDebugAppId.js since expo-splash-screen overwrites
 * styles.xml after all config plugins run.
 */
const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const LIGHT_SPLASH_BG = "#ffffff";
const DARK_SPLASH_BG = "#1F2937"; // Dark theme background.secondary

const LIGHT_COLORS_XML = `<resources>
  <color name="splashscreen_background">${LIGHT_SPLASH_BG}</color>
  <color name="iconBackground">${LIGHT_SPLASH_BG}</color>
  <color name="colorPrimary">#023c69</color>
  <color name="colorPrimaryDark">${LIGHT_SPLASH_BG}</color>
</resources>
`;

// Dark mode — splash background changes, iconBackground stays white for home screen icon
const NIGHT_COLORS_XML = `<resources>
  <color name="splashscreen_background">${DARK_SPLASH_BG}</color>
  <color name="iconBackground">${LIGHT_SPLASH_BG}</color>
  <color name="colorPrimary">#023c69</color>
  <color name="colorPrimaryDark">${DARK_SPLASH_BG}</color>
</resources>
`;

function withDarkSplash(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const resDir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res"
      );
      const valuesDir = path.join(resDir, "values");
      const nightDir = path.join(resDir, "values-night");

      if (!fs.existsSync(nightDir)) {
        fs.mkdirSync(nightDir, { recursive: true });
      }

      fs.writeFileSync(
        path.join(valuesDir, "colors.xml"),
        LIGHT_COLORS_XML,
        "utf-8"
      );
      fs.writeFileSync(
        path.join(nightDir, "colors.xml"),
        NIGHT_COLORS_XML,
        "utf-8"
      );

      return config;
    },
  ]);
}

module.exports = withDarkSplash;
