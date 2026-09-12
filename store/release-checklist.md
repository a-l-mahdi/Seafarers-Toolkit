# Play Store release checklist — Seafarers Toolkit (local Gradle build)

You build the release **locally** with your own Android SDK + Gradle (no EAS/Expo cloud).
Because you maintain `android/` by hand (e.g. the Aliyun Maven mirrors), all values below
were set **directly in the native project** as well as in `app.json` (kept in sync).

## What was configured

| Item | Value | Where |
|---|---|---|
| Package name (namespace + applicationId) | `com.marine.seafarerstoolkit` | `android/app/build.gradle` (+ `app.json`) |
| Kotlin source package | `com.marine.seafarerstoolkit` | `android/app/src/main/java/com/marine/seafarerstoolkit/` |
| versionName | `1.0.0` | `android/app/build.gradle` (+ `app.json`) |
| versionCode | `1` | `android/app/build.gradle` (+ `app.json`) |
| target / compile SDK | **35** (meets Play's targetSdk 35 rule) | `expo-root-project` default via `rootProject.ext` |
| min SDK | 24 (Android 7.0) | same |
| Camera permission | added | `AndroidManifest.xml` (+ `app.json`) |
| RECORD_AUDIO / SYSTEM_ALERT_WINDOW | removed from release | `AndroidManifest.xml` |
| Release signing | keystore via `release-keystore.properties` | `android/app/build.gradle` |

**Release manifest permissions now:** `INTERNET`, `CAMERA`, `VIBRATE`, `USE_BIOMETRIC`,
`USE_FINGERPRINT`, `POST_NOTIFICATIONS` + `RECEIVE_BOOT_COMPLETED` (merged from
expo-notifications), and `READ/WRITE_EXTERNAL_STORAGE` (maxSdkVersion 32 only).

## Step 1 — Generate your upload keystore (once)
From the `android/app` folder:
```
keytool -genkeypair -v -keystore release.keystore \
  -alias seafarerstoolkit -keyalg RSA -keysize 2048 -validity 10000
```
Answer the prompts and choose strong passwords. **Back up `release.keystore` somewhere
safe** — losing it means you can never update the app on Play (unless you use Play App
Signing, see Step 4).

## Step 2 — Point Gradle at the keystore
Copy the example and fill in real values:
```
cp android/app/release-keystore.properties.example android/app/release-keystore.properties
```
Set `storePassword`, `keyAlias`, `keyPassword` to what you chose. This file and the
`.keystore` are git-ignored — never commit them.

## Step 3 — Build the signed release bundle (AAB)
From the `android` folder:
```
./gradlew :app:bundleRelease          # AAB for Play  ->  app/build/outputs/bundle/release/app-release.aab
# or, for a testable APK:
./gradlew :app:assembleRelease        # APK          ->  app/build/outputs/apk/release/app-release.apk
```
The JS bundle is embedded automatically by the React/Expo Gradle plugin. Verify it is
signed with your key (not the debug key):
```
keytool -printcert -jarfile app/build/outputs/bundle/release/app-release.aab
```

## Step 4 — Play Console: create app & sign
- Create the app in Play Console, upload the AAB.
- When prompted, **enrol in Play App Signing** (recommended): Google holds the real
  *app signing* key and your `release.keystore` becomes the *upload* key. If you ever
  lose the upload key, Google support can reset it.

## Bumping versions for the next release
Every Play upload needs a higher `versionCode`. Before each release, edit
`android/app/build.gradle` (and mirror in `app.json` to stay consistent):
- `versionCode` → 2, 3, 4 …
- `versionName` → e.g. "1.0.1" when you want a new user-facing version.

## Caveat: don't run `expo prebuild`
`android/` is hand-maintained. Running `npx expo prebuild` would overwrite
`build.gradle`/manifest and wipe the hand edits below. If you ever must regenerate,
re-apply all of these (some are also encoded in `app.json` so a prebuild reproduces them):

- **`android/build.gradle`**: Aliyun Maven mirrors (dl.google.com is blocked); and the
  `subprojects { ... forceCompileSdk }` block that forces community modules
  (react-native-image-picker hard-codes compileSdk 35) to compile against the app's
  installed SDK (36).
- **`android/app/build.gradle`**: release `signingConfig` reading `release-keystore.properties`.
- **`android/app/src/main/AndroidManifest.xml`**: `RECORD_AUDIO` removed and
  `<uses-permission android:name="android.permission.CAMERA" tools:node="remove"/>`
  (app.json `blockedPermissions` reproduces both on prebuild).

### Camera without the CAMERA permission
Camera capture uses `react-native-image-picker` (`launchCamera`, `saveToPhotos:false`),
which shoots through the system camera app via an `ACTION_IMAGE_CAPTURE` intent and needs
**no** CAMERA permission. `expo-image-picker` is kept only for gallery picking; its manifest
declares CAMERA, which is why the `tools:node="remove"` override above is required.
Trade-off: no in-app crop (expo's `allowsEditing`); capture is full-size to the app cache.

## Play Console content still required (you do these in the console)
- [ ] Privacy policy URL — host `store/privacy-policy.html` (contact/publisher already filled in).
- [ ] Data safety form — see `store/play-data-safety.md`.
- [ ] Store listing: descriptions, icon, feature graphic, ≥2 phone screenshots.
- [ ] Content rating questionnaire.
- [ ] Target audience & content, app category (Productivity/Business), contact details.
- [ ] Countries / regions for distribution.
