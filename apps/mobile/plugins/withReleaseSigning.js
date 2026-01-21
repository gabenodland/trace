const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Adds release signing configuration to Android build
 * Also fixes monorepo bundler path issue
 */
function withReleaseSigning(config, props = {}) {
  const {
    storeFile = "trace-release.keystore",
    keyAlias = "trace",
    storePassword = "trace123",
    keyPassword = "trace123",
  } = props;

  config = withDangerousMod(config, [
    "android",
    async (config) => {
      const platformRoot = config.modRequest.platformProjectRoot;

      // 1. Add signing properties to gradle.properties
      const gradlePropsPath = path.join(platformRoot, "gradle.properties");
      let gradleProps = fs.readFileSync(gradlePropsPath, "utf8");

      if (!gradleProps.includes("MYAPP_UPLOAD_STORE_FILE")) {
        gradleProps += `
# Release signing config
MYAPP_UPLOAD_STORE_FILE=${storeFile}
MYAPP_UPLOAD_KEY_ALIAS=${keyAlias}
MYAPP_UPLOAD_STORE_PASSWORD=${storePassword}
MYAPP_UPLOAD_KEY_PASSWORD=${keyPassword}
`;
        fs.writeFileSync(gradlePropsPath, gradleProps);
      }

      // 2. Modify app/build.gradle to add release signing
      const buildGradlePath = path.join(platformRoot, "app", "build.gradle");
      let buildGradle = fs.readFileSync(buildGradlePath, "utf8");

      // Add release signing config
      buildGradle = buildGradle.replace(
        /signingConfigs \{[\s\S]*?debug \{[\s\S]*?keyPassword 'android'\s*\}\s*\}/,
        `signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD
            }
        }
    }`
      );

      // Update release buildType to use release signingConfig
      buildGradle = buildGradle.replace(
        /release \{[\s\S]*?\/\/ Caution![\s\S]*?signingConfig signingConfigs\.debug/,
        `release {
            signingConfig signingConfigs.release`
      );

      fs.writeFileSync(buildGradlePath, buildGradle);

      return config;
    },
  ]);

  return config;
}

module.exports = withReleaseSigning;
