# Barcode to PC App - AI Agent Instructions

## Project Overview
Ionic 3 + Cordova mobile app (Android & iOS) that turns smartphones into barcode scanners, sending scans to a desktop server via WebSocket (Barcode to PC Server). The app discovers servers via Zeroconf/mDNS and processes barcodes through configurable "Output Templates" (OutputProfiles).

## Architecture

### Core Data Flow
1. **Scan Acquisition**: `ScanProvider` orchestrates barcode scanning via custom plugin `@fttx/barcode-scanner`, NFC, or manual keyboard input
2. **Output Processing**: Scans are transformed by `OutputProfileModel` (configurable templates with OutputBlocks)
3. **WebSocket Sync**: `ServerProvider` maintains persistent WebSocket connection to desktop server, syncing `ScanSessionModel` data
4. **Local Storage**: `ScanSessionsStorage` (Ionic Storage with SQLite) stores scan sessions offline-first

### Key Components
- **Pages**: `src/pages/*` - Ionic pages (scan-session, scan-sessions, settings, select-server, welcome)
- **Providers**: `src/providers/*` - Angular services (server, scan, settings, scan-sessions-storage, utils)
- **Models**: `src/models/*` - Request/response models for WebSocket protocol, scan data structures

### WebSocket Protocol
- Client sends: `requestModel` subclasses (requestModelHelo, requestModelPutScanSessions, etc.)
- Server responds: `responseModel` subclasses (responseModelUpdateSettings, responseModelKick, etc.)
- Connection: Auto-reconnect with 7s interval, heartbeat/pong mechanism
- See `src/models/request.model.ts` and `src/models/response.model.ts` for full protocol

### Output Template System
**Critical Concept**: Output templates (`OutputProfileModel`) define how scans are processed and sent to the server.
- Built from `OutputBlockModel[]` (e.g., barcode, text, key, variable, date_time, function, http, csv_lookup)
- Can include interactive components: NUMBER, TEXT, select_option, image (these require UI dialogs)
- See `OutputProfileModel.ContainsBlockingComponents()` for components that pause scanning
- Static utility: `ScanModel.ToString(scan, separator)` converts OutputBlocks to display string

## Development Workflows

### Build & Run
```bash
# CRITICAL: Use Node 14.17 (see nvm use 14.17 in README)
nvm use 14.17

# iOS (requires Xcode)
ionic cordova run ios --device

# Android
ionic cordova run android

# Development server (web preview)
npm start
```

### Quick Plugin Testing
When modifying `fttx-phonegap-plugin-barcodescanner`:
```bash
trash plugins/fttx-phonegap-plugin-barcodescanner
cp -r ../phonegap-plugin-barcodescanner plugins/fttx-phonegap-plugin-barcodescanner
trash platforms/android
ionic cordova build android
```

### Publishing (Android)
Automated via `hooks/android/after_build.js`:
- Auto-zipaligns and signs AAB with keystore (env: `JKS_PATH`, `JKS_PASS`)
- Generates versioned `.aab` and `.apks` files (e.g., `barcode-to-pc-app-v4.9.0.aab`)
- Version sync: Update `package.json` version AND `config.xml` (android-versionCode + version)

### iOS Publishing Quirks
See README - Manual steps required:
1. Remove `[CP] Copy Pods Resources` from Build Phases
2. Set Code Signing Identity to "iOS Developer"
3. Use Xcode > Product > Archive

## Code Conventions

### Provider Architecture
- All providers are `@Injectable()` Angular services
- Avoid circular deps: `ScanProvider` and `ServerProvider` communicate via global `Events` (Ionic Events API)
- Global access pattern: `window['server'] = { connected: bool }` for connection state

### Analytics
Firebase Analytics via Cordova plugin (`window.cordova.plugins.firebase.analytics`):
- Track screens: `setCurrentScreen("PageName")`
- Track events: `logEvent('event_name', {})`
- Privacy: Check `localStorage` for consent (see `about.ts` for GOOGLE_ANALYTICS_* keys)

### State Management
- No Redux/NgRx - uses Ionic Events (`this.events.publish/subscribe`)
- Settings: `Settings` provider wraps Ionic Storage
- Scan sessions: Local-first with eventual consistency via WebSocket sync

### Server Discovery
Zeroconf/mDNS via `@ionic-native/zeroconf`:
- Watches `_http._tcp.` on `local.` domain
- Filters by port `57891` or service name prefix `barcode-to-pc-server-`
- Fallback: Manual IP entry if Zeroconf fails

### TypeScript Patterns
- Models use static methods (e.g., `ScanModel.ToString()`) since JSON parsing loses instance methods
- Request/Response models inherit from abstract `requestModel`/`responseModel` with `fromObject()` factory pattern
- Avoid `Object.assign(new Model(), json)` for performance

### Cordova Hooks
Located in `hooks/android/`:
- `after_build.js`: Signs AAB, generates APKs (requires `.env` with JKS_PATH/JKS_PASS)
- `after_prepare_add_android_exported.js`: Adds `android:exported` to AndroidManifest receivers
- `after_prepare_remove_duplicated_write_external.js`: Deduplicates permissions

### Android Intent Filters
Heavy use of broadcast receivers for hardware barcode scanners (see `config.xml`):
- DataWedge: `com.symbol.datawedge.api.*`
- Generic: `scan.rcv.message`, `nlscan.action.SCANNER_RESULT`, etc.
- Custom: `com.barcodetopc.scan`, `com.barcodetopc.sync`

## Configuration Files

### Firebase
- **Android**: `google-services.json` (root, copied to `platforms/android/app/`)
- **iOS**: `GoogleService-Info.plist` (root, copied to iOS resources)

### Key Settings
- `config.ts`: URLs, constants (SERVER_PORT=57891, Zeroconf names, webhook URLs)
- `ionic.config.json`: Project type `ionic-angular`
- Node version: **14.17** (critical - newer versions break ionic-app-scripts)

## Testing Notes
- No formal test suite - manual testing on real devices
- Use Firebase Analytics to track issues in production
- Debug WebSocket via `Config.DEBUG = true` (logs extensively)

## Common Pitfalls
1. **Node version**: Must use 14.17, newer breaks builds
2. **Platform-specific code**: Check `this.platform.is('ios')` before iOS-only APIs
3. **Circular deps**: Never import `ScanProvider` in `ServerProvider` or vice versa
4. **WebSocket state**: Always check `webSocket.readyState === WebSocket.OPEN` before sending
5. **OutputProfile blocking**: Components with dialogs (NUMBER, TEXT, image) break continuous scan mode
6. **Android targetSdkVersion**: Set to 35 (config.xml), compileSdkVersion to 33 for compatibility

**Critical Translation Rules:**

1. **Always translate to ALL languages** when adding or modifying UI text. Never translate just one language.

2. **Supported languages:**

   - `ar.json` - Arabic
   - `de.json` - German
   - `en.json` - English
   - `es.json` - Spanish
   - `it.json` - Italian
   - `pt.json` - Portuguese
   - `tr.json` - Turkish
   - `tw.json` - Traditional Chinese
   - `ru.json` - Russian
