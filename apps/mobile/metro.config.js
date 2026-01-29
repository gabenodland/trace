const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Get the default Expo Metro config
const config = getDefaultConfig(__dirname);

// Add monorepo support
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

// Watch all files in the workspace
config.watchFolders = [workspaceRoot];

// Let Metro know where to resolve modules from
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Force Metro to resolve these packages from workspace root to avoid duplicates
config.resolver.disableHierarchicalLookup = true;

// Ensure .ts and .tsx extensions are resolved (for packages that ship TypeScript source)
config.resolver.sourceExts = [...(config.resolver.sourceExts || []), 'ts', 'tsx'];

module.exports = config;
