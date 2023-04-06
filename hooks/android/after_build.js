#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const { exec } = require('child_process');
const dotenv = require('dotenv');

// Load the environment variables from .env file
dotenv.config();

// Path to the APK file to sign
const APK_PATH = 'platforms/android/app/build/outputs/apk/release/app-release-unsigned.apk';

// Wait until the APK file is created
if (fs.existsSync(APK_PATH)) {
  // Read the package.json file to get the version number
  const packageJsonPath = path.join(__dirname, '../..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;

  // Build the output APK file name using the version number
  const outputApkPath = path.join(__dirname, '../..', `barcode-to-pc-app-v${version}.apk`);
  if (fs.existsSync(outputApkPath)) {
    fs.unlinkSync(outputApkPath);
  }

  // Zipalign the APK file
  exec(`zipalign -v 4 ${APK_PATH} ${outputApkPath}`, (err, stdout, stderr) => {
    if (err) {
      console.error(`Failed to zipalign the APK file: ${err}`);
    } else {
      console.log(`APK file successfully zipaligned: ${stdout}`);

      // Sign the APK file
      const keystorePath = process.env.JKS_PATH;
      const keystorePass = process.env.JKS_PASS;
      exec(`apksigner sign --ks ${keystorePath} --ks-pass file:${keystorePass} --v1-signing-enabled true --v2-signing-enabled true ${outputApkPath}`, (err, stdout, stderr) => {
        if (err) {
          console.error(`Failed to sign the APK file: ${err}`);
        } else {
          console.log(`APK file successfully signed: ${outputApkPath}`);

          // Save the Ionic info to a file
          const ionicInfoPath = path.join(__dirname, '../..', 'last-ionic-info.txt');
          exec(`ionic info > ${ionicInfoPath}`, (err, stdout, stderr) => {
            if (err) {
              console.error(`Failed to save the Ionic info to a file: ${err}`);
            } else {
              console.log(`Ionic info saved to ${ionicInfoPath}`);
            }
          });
        }
      });
    }
  });
} else {
  console.warn(`APK file ${APK_PATH} not found`);
}
