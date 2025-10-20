// dentro de app.config.js
require('dotenv').config();

export default {
  "expo": {
    "name": "CoinUP",
    "slug": "CoinUP",
    "version": "1.1",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "ios": {
      "supportsTablet": true
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.schastai.CoinUP"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "1d370ef0-074a-4306-bac0-eb970784fa8c"
      },
      "FIREBASE_API_KEY": process.env.FIREBASE_API_KEY
    }
  }
};