import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.getmypro.customer',
  appName: 'GetMyPro',
  webDir: '../dist',
  server: {
    androidScheme: 'https',
    allowNavigation: ['*.cashfree.com', 'cashfree.com']
  },
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: false,
      providers: ['phone'],
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1A5FB8',
      showSpinner: false
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1A5FB8'
    }
  }
};

export default config;
