require('dotenv').config();

export default {
  "expo": {
    "name": "Carteira", // Verifique se o nome do seu app está correto
    "slug": "Carteira", // Verifique se o slug do seu app está correto
    "version": "1.0.0",
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
      "package": "com.schastai.Carteira"
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "extra": {
      "eas": {
        "projectId": "1d370ef0-074a-4306-bac0-eb970784fa8c"
      },
      // Aqui a mágica acontece!
      "FIREBASE_API_KEY": process.env.FIREBASE_API_KEY
    }
  }
};