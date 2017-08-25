# Barcode to pc app

## Download
Server: https://barcodetopc.com/#download-server

Android: https://play.google.com/store/apps/details?id=com.barcodetopc

iOS: https://itunes.apple.com/app/id1180168368


## Setup
```
git clone https://github.com/fttx/barcode-to-pc-app/
cd barcode-to-pc-app
npm install
ionic cordova platform add android
ionic cordova platform add ios
ionic cordova resources
```

## Run
```
ionic cordova run ios --device
ionic cordova run android
```

## Release
```
# iOS
ionic cordova build ios --prod --release

# Android Pre-Lollipop (more info: https://github.com/crosswalk-project/cordova-plugin-crosswalk-webview#install)
# Increase version code in config.xml
ionic cordova plugin add cordova-plugin-crosswalk-webview
ionic cordova build android --prod --release
APK_PATH="platforms/android/build/outputs/apk/android-release-unsigned.apk"
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore barcode-to-pc-keystore.jks $APK_PATH keystore
zipalign -v 4 $APK_PATH out.apk

# Android
# Increase version code in config.xml (again)
ionic cordova plugin rm cordova-plugin-crosswalk-webview
ionic cordova build android --prod --release -- -- --minSdkVersion=21
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore barcode-to-pc-keystore.jks $APK_PATH keystore
zipalign -v 4 $APK_PATH out.apk
```
