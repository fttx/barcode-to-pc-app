#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

const activitiesNames = [
  'com.google.zxing.client.android.CaptureActivity',
  'com.google.zxing.client.android.encode.EncodeActivity',
];

const providersNames = [
  'org.apache.cordova.camera.FileProvider',
  'nl.xservices.plugins.FileProvider',
];


// This hook is to add the android:exported="true" attribute to the activities, providers and services, as per the Android 12 requirements
module.exports = function(context) {
  const platformRoot = path.join(context.opts.projectRoot, 'platforms', 'android', 'app');
  const manifestPath = path.join(platformRoot, 'src', 'main', 'AndroidManifest.xml');

  // Wait until the AndroidManifest.xml file is created
  if (fs.existsSync(manifestPath)) {
    // Read the AndroidManifest.xml file
    const manifestXml = fs.readFileSync(manifestPath, 'utf8');

    // Parse the manifest XML into a JSON object
    xml2js.parseString(manifestXml, (err, manifest) => {
      if (err) {
        console.error(`Failed to parse AndroidManifest.xml: ${err}`);
      } else {
        try {
          // Find the target activity and set android:exported="true"
          activitiesNames.forEach((activityName) => {
            const activity = manifest.manifest.application[0].activity.find((activity) => activity.$['android:name'] == activityName);
            if (activity)  {
              activity.$['android:exported'] = 'true';
              manifest.manifest.application[0].activity = manifest.manifest.application[0].activity.filter((activity) => activity.$['android:name'] != activityName || (activity.$['android:name'] == activityName && activity.$['android:exported'] == 'true'));
              console.log(`[after_platform_add] Added android:exported="true" to ${activity.$['android:name']}`);
            } else {
              console.warn(`Target activity ${activityName} not found in AndroidManifest.xml`);
            }
          });

          providersNames.forEach((providerName) => {
            const provider = manifest.manifest.application[0].provider.find((provider) => provider.$['android:name'] == providerName);
            if (provider)  {
              provider.$['android:exported'] = 'true';
              manifest.manifest.application[0].provider = manifest.manifest.application[0].provider.filter((provider) => provider.$['android:name'] != providerName || (provider.$['android:name'] == providerName && provider.$['android:exported'] == 'true'));
              console.log(`[after_platform_add] Added android:exported="true" to ${provider.$['android:name']}`);
            } else {
              console.warn(`Target activity ${providerName} not found in AndroidManifest.xml`);
            }
          });

          // Write the modified manifest back to the file
          const builder = new xml2js.Builder();
          const modifiedManifestXml = builder.buildObject(manifest);
          fs.writeFileSync(manifestPath, modifiedManifestXml, 'utf8');
        } catch (err) {
          console.error(`Failed to modify AndroidManifest.xml: ${err}`);
        }
      }
    });
  }
};
