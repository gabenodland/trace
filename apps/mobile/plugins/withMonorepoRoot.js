const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * This plugin fixes the 'root' setting in build.gradle for monorepo setups.
 *
 * Problem: Metro bundler detects npm workspaces and uses the workspace root
 * (trace/) for module resolution. But Expo's default build.gradle sets 'root'
 * to the app directory (apps/mobile), making the entry file relative as 'index.ts'.
 * Metro then can't find 'index.ts' at the workspace root.
 *
 * Solution: Point 'root' to the workspace root so the entry file becomes
 * 'apps/mobile/index.ts' which Metro can resolve correctly.
 */
function withMonorepoRoot(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const buildGradlePath = path.join(
        config.modRequest.platformProjectRoot,
        "app/build.gradle"
      );

      if (!fs.existsSync(buildGradlePath)) {
        console.warn("withMonorepoRoot: build.gradle not found at", buildGradlePath);
        return config;
      }

      let buildGradle = fs.readFileSync(buildGradlePath, "utf8");

      // Replace root setting for monorepo support
      // Handles both formats:
      // 1. Old: root = file(projectRoot)
      // 2. New: // root = file("../../") (commented)
      const oldRoot1 = "root = file(projectRoot)";
      const oldRoot2 = '// root = file("../../")';
      const newRoot = 'root = file("../../../../")  // Monorepo: point to workspace root for Metro resolution';

      if (buildGradle.includes(oldRoot1)) {
        buildGradle = buildGradle.replace(oldRoot1, newRoot);
        fs.writeFileSync(buildGradlePath, buildGradle);
        console.log("withMonorepoRoot: Updated build.gradle root for monorepo support (old format)");
      } else if (buildGradle.includes(oldRoot2)) {
        buildGradle = buildGradle.replace(oldRoot2, newRoot);
        fs.writeFileSync(buildGradlePath, buildGradle);
        console.log("withMonorepoRoot: Updated build.gradle root for monorepo support (new format)");
      } else if (!buildGradle.includes('file("../../../../")')) {
        console.warn("withMonorepoRoot: Could not find root setting to replace");
      }

      return config;
    },
  ]);
}

module.exports = withMonorepoRoot;
