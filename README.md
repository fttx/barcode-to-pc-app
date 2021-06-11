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

- Put the Firebase config files in the root folder (GoogleService-Info.plist and google-services.json)

- Install the npm dependencies and add your platform

    ```bash
    npm install
    ionic cordova platform add android@8.1.0
    ionic cordova platform add ios
    ionic cordova resources # rename icon.ios.png to icon.png to generate the iOS icons
    ```


## Run

```bash
ionic cordova run ios --device
ionic cordova run android
```

## Publish updates

- Increase the version number of the package.json
- Increase the versionCode and version number in the config.xml
- Commit the changes, Add a tag & push
- Run the following commands:

```bash
# iOS
# Select Any iOS device as Build Target
# Barcode to PC > Build Phases > Remove "[CP] Copy Pods Resources"
# Barcode to PC > Build Settings > Signing > Set Code Signign Identity to "iOS Developer"
ionic cordova build ios --prod --release
open "platforms/ios/Barcode to PC.xcworkspace"
# Product > Archive

# Android
# Increase version code in config.xml
ionic cordova build android --prod --release
APK_PATH="platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk"
JKS_PATH="barcode-to-pc-keystore.jks"
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore $JKS_PATH $APK_PATH keystore
zipalign -v 4 $APK_PATH out.apk
ionic info > last-ionic-info.txt
```
