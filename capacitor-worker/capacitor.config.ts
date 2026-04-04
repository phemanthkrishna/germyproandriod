import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.getmypro.worker',
  appName: 'GetMyPro Pro',
  webDir: '../dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['phone'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1A5FB8',
      showSpinner: false
    },
    Geolocation: {
      permissions: ['location']
    }
  }
};

export default config;
