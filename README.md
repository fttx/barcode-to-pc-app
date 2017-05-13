M# Barcode to pc app

## Download
Android: https://play.google.com/store/apps/details?id=com.barcodetopc

iOS: https://itunes.apple.com/app/id1180168368

## Setup
```
git clone https://github.com/fttx/barcode-to-pc-app/
cd barcode-to-pc-app
npm install
ionic platform add android@latest
ionic platform add ios
ionic resources
```

## Build
```
ionic run ios --device
ionic run android
```

## Release
```
# iOS
ionic build ios --release

# Android Pre-Lollipop (more info: https://github.com/crosswalk-project/cordova-plugin-crosswalk-webview#install)
# Increase version code in config.xml
ionic plugin add cordova-plugin-crosswalk-webview
ionic build android --release
# Sign and zip align: http://ionicframework.com/docs/v1/guide/publishing.html

# Android
# Increase version code in config.xml (again)
ionic plugin rm cordova-plugin-crosswalk-webview
ionic build android --release -- --minSdkVersion=21
# Sign and zip align: http://ionicframework.com/docs/v1/guide/publishing.html
```
