# Barcode to pc app

## Useful links

### Downloads

* Server: <https://barcodetopc.com/#download-server>
* Android: <https://play.google.com/store/apps/details?id=com.barcodetopc>
* iOS: <https://itunes.apple.com/app/id1180168368>

### Repositories

* Server: <https://github.com/fttx/barcode-to-pc-server>
* App: <https://github.com/fttx/barcode-to-pc-app>

## Setup

```bash
git clone https://github.com/fttx/barcode-to-pc-app/
cd barcode-to-pc-app
npm install
./node_modules/.bin/ionic cordova platform add android
./node_modules/.bin/ionic cordova platform add ios
./node_modules/.bin/ionic cordova resources
```

## Run

```bash
./node_modules/.bin/ionic cordova run ios --device
./node_modules/.bin/ionic cordova run android
```

## Release

```bash
# iOS
./node_modules/.bin/ionic cordova build ios --prod --release

# Android Pre-Lollipop (more info: https://github.com/crosswalk-project/cordova-plugin-crosswalk-webview#install)
# Increase version code in config.xml
./node_modules/.bin/ionic cordova plugin add cordova-plugin-crosswalk-webview
./node_modules/.bin/ionic cordova build android --prod --release
APK_PATH="platforms/android/build/outputs/apk/release/android-release-unsigned.apk"
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore barcode-to-pc-keystore.jks $APK_PATH keystore
zipalign -v 4 $APK_PATH out.apk

# Android
# Increase version code in config.xml (again)
./node_modules/.bin/ionic cordova plugin rm cordova-plugin-crosswalk-webview
./node_modules/.bin/ionic cordova build android --prod --release -- -- --minSdkVersion=21
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore barcode-to-pc-keystore.jks $APK_PATH keystore
zipalign -v 4 $APK_PATH out.apk
```
