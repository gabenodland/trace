/**
 * Auto-increment build number for release builds
 *
 * This script reads build-number.json, increments the build number,
 * and writes it back. Run before release builds.
 *
 * Usage: node scripts/incrementBuildNumber.js
 */

const fs = require('fs');
const path = require('path');

const BUILD_NUMBER_FILE = path.join(__dirname, '..', 'build-number.json');

function incrementBuildNumber() {
  // Read current build number
  let buildData = { buildNumber: 0 };

  if (fs.existsSync(BUILD_NUMBER_FILE)) {
    try {
      const content = fs.readFileSync(BUILD_NUMBER_FILE, 'utf8');
      buildData = JSON.parse(content);
    } catch (err) {
      console.error('Error reading build-number.json:', err.message);
      console.log('Starting from build 1');
    }
  }

  // Increment
  const oldBuildNumber = buildData.buildNumber || 0;
  const newBuildNumber = oldBuildNumber + 1;

  // Write back
  const newData = { buildNumber: newBuildNumber };
  fs.writeFileSync(BUILD_NUMBER_FILE, JSON.stringify(newData, null, 2) + '\n');

  console.log(`Build number incremented: ${oldBuildNumber} → ${newBuildNumber}`);
  return newBuildNumber;
}

// Run if called directly
if (require.main === module) {
  incrementBuildNumber();
}

module.exports = { incrementBuildNumber };
