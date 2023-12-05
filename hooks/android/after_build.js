#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const { exec, execSync } = require('child_process');
const dotenv = require('dotenv');
const { platform } = require('os');

// Load the environment variables from .env file
dotenv.config();

// Path to the AAB file to sign
const AAB_PATH = 'platforms/android/app/build/outputs/bundle/release/app-release.aab';

// Wait until the AAB file is created
if (fs.existsSync(AAB_PATH)) {
  // Read the package.json file to get the version number
  const packageJsonPath = path.join(__dirname, '../..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;

  // Build the output AAB file name using the version number
  const outputAabPath = path.join(__dirname, '../..', `barcode-to-pc-app-v${version}.aab`);
  if (fs.existsSync(outputAabPath)) {
    fs.unlinkSync(outputAabPath);
  }

  // Zipalign the AAB file
  exec(`zipalign -v 4 ${AAB_PATH} ${outputAabPath}`, (err, stdout, stderr) => {
    if (err) {
      console.error(`Failed to zipalign the AAB file: ${err}`);
    } else {
      console.log(`[after_build] AAB file successfully zipaligned: ${stdout}`);

      // Sign the AAB file
      const keystorePath = process.env.JKS_PATH;
      const keystorePass = process.env.JKS_PASS;
      const keyStorePassValue = fs.readFileSync(keystorePass, 'utf8').replace('\n', '');

      exec(`jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore ${keystorePath} -storepass ${keyStorePassValue} -signedjar ${outputAabPath} ${AAB_PATH} keystore`, (err, stdout, stderr) => {
        if (err) {
          console.error(`Failed to sign the AAB file: ${err}, stderr: ${stderr}, stdout: ${stdout}`);
        } else {
          console.log(`[after_build] AAB file successfully signed: ${outputAabPath}`);

          // build APK file from AAB file
          const apkPath = path.join(__dirname, '../..', `barcode-to-pc-app-v${version}.apks`);
          if (fs.existsSync(apkPath)) {
            fs.unlinkSync(apkPath);
          }
          // execSync(`bundletool build-apks --bundle=${outputAabPath} --output=${apkPath} --local-testing`);
          execSync(`bundletool build-apks --mode universal --bundle=${outputAabPath} --output=${apkPath} --local-testing`);
          // execSync(`unzip ${apkPath}`);

          console.log(`[after_build] Curtesy APK files generated (test only). To install run bundletool install-apks --apks=${apkPath}`);

          // Save the Ionic info to a file
          const ionicInfoPath = path.join(__dirname, '../..', 'last-ionic-info.txt');
          exec(`ionic info > ${ionicInfoPath}`, (err, stdout, stderr) => {
            if (err) {
              console.error(`Failed to save the Ionic info to a file: ${err}`);
            } else {
              console.log(`[after_build] Ionic info saved to ${ionicInfoPath}`);
            }
          });
        }
      });
    }
  });
} else {
  console.warn(`AAB file ${AAB_PATH} not found`);
}
