// Read build number from build-number.json
const fs = require('fs');
const path = require('path');

let buildNumber = 1;
try {
  const buildNumberPath = path.join(__dirname, 'build-number.json');
  if (fs.existsSync(buildNumberPath)) {
    const data = JSON.parse(fs.readFileSync(buildNumberPath, 'utf8'));
    buildNumber = data.buildNumber || 1;
  }
} catch (err) {
  console.warn('Could not read build-number.json, using default:', err.message);
}

module.exports = {
  expo: {
    name: 'Trace',
    slug: 'trace',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    scheme: 'trace',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.mindjig.trace',
      buildNumber: String(buildNumber),
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Trace uses your location to add context to your captured entries.',
        NSCameraUsageDescription:
          'Trace uses the camera to capture photos for your entries.',
        NSPhotoLibraryUsageDescription:
          'Trace accesses your photo library to attach photos to entries.',
        NSPhotoLibraryAddUsageDescription:
          'Trace saves photos to your library.',
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY_IOS,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.mindjig.trace',
      versionCode: buildNumber,
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
      softwareKeyboardLayoutMode: 'resize',
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY_ANDROID,
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    // Expose environment variables to the app via Constants.expoConfig.extra
    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      mapboxAccessToken: process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN,
      foursquareApiKey: process.env.EXPO_PUBLIC_FOURSQUARE_API_KEY,
    },
    plugins: [
      'expo-web-browser',
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Allow Trace to use your location to add context to your captured entries.',
        },
      ],
      'expo-sqlite',
      [
        'expo-image-picker',
        {
          cameraPermission: 'Trace uses the camera to capture photos for your entries.',
          photosPermission: 'Trace accesses your photo library to attach photos to entries.',
        },
      ],
      [
        'expo-media-library',
        {
          photosPermission: 'Trace accesses your photos to attach them to entries.',
          savePhotosPermission: 'Trace saves photos to your library.',
        },
      ],
      './plugins/withNetworkSecurityConfig',
      // './plugins/withReleaseSigning',  // Disabled - using debug signing for now
      './plugins/withMonorepoRoot',
    ],
  },
};
