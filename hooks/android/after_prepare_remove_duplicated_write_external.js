#!/usr/bin/env node

// Fixes this issue: https://cordova.apache.org/news/2023/07/11/file-plugin-8.0.0.html
// Some old plugin may still add WRITE_EXTERNAL_STORAGE to the manifest.
// And we don't want that since the file plugin is already doing it for a specific SKD version.
//
// Also removes READ_MEDIA_IMAGES and READ_MEDIA_VIDEO permissions that cordova-plugin-camera
// automatically adds on Android 13+ (SDK 33+). Our app only uses the camera (not photo library),
// so these permissions are not needed and violate Google Play's Photo and Video Permissions policy.

const fs = require('fs');
const path = require('path');

let mainifest_path = path.resolve('platforms/android/app/src/main/AndroidManifest.xml');

let manifest = fs.readFileSync(mainifest_path, {
  encoding: 'utf-8'
});

// Strips ALL occurrences of <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
// If you have several conflicts (of different maxSDKVersion, or in different formats) then the regex
// may need to be adjusted, or repeated for each format.
manifest = manifest.replace('<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>', '');

// Remove READ_MEDIA_IMAGES and READ_MEDIA_VIDEO permissions added by cordova-plugin-camera
// We only use the camera (PictureSourceType.CAMERA), not the photo library, so these are not needed
manifest = manifest.replace(/<uses-permission android:name="android\.permission\.READ_MEDIA_IMAGES"[^>]*\/>/g, '');
manifest = manifest.replace(/<uses-permission android:name="android\.permission\.READ_MEDIA_VIDEO"[^>]*\/>/g, '');
// Also remove READ_EXTERNAL_STORAGE if it's added (legacy permission)
manifest = manifest.replace(/<uses-permission android:name="android\.permission\.READ_EXTERNAL_STORAGE"[^>]*\/>/g, '');

fs.writeFileSync(mainifest_path, manifest);
