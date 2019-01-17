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

- Clone the repository
    ```bash
    git clone https://github.com/fttx/barcode-to-pc-app/
    cd barcode-to-pc-app
    ```

- Install ionic and cordova
    - See: <https://ionicframework.com/docs/intro/installation/>
    - And also [last-ionic-info.txt](last-ionic-info.txt)

- Install the npm dependencies and add your platform

    ```bash
    npm install
    ionic cordova platform add android
    ionic cordova platform add ios
    ionic cordova resources
    ```

## Run

```bash
ionic cordova run ios --device
ionic cordova run android
```

## Release

```bash
# iOS
ionic cordova build ios --prod --release

# Android
# Increase version code in config.xml
ionic cordova build android --prod --release
APK_PATH=""
JKS_PATH="barcode-to-pc-keystore.jks"
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore $JKS_PATH $APK_PATH keystore
zipalign -v 4 $APK_PATH out.apk
```
