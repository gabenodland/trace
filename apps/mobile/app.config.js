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
      bundleIdentifier: 'com.trace.app',
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
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      package: 'com.trace.app',
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION'],
      softwareKeyboardLayoutMode: 'resize',
      config: {
        googleMaps: {
          apiKey: 'AIzaSyDm9vuCSwQqZu4dbBsQ0sqk0CdSaxvozEE',
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
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
