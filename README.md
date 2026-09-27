# Seafarers Toolkit

A personal management app for seafarers — documents, contracts, sea time, career progress, and leave tracking.

Built with React Native + Expo (SDK 57), TypeScript, Expo Router, TanStack Query, Zustand, and SQLite (offline-first).

## Features

- **Dashboard** — rank, contract countdown, sea time progress, document alerts at a glance
- **Documents** — store certificates (PDF/JPG/PNG), expiry tracking with notifications
- **Contracts & Vessels** — join/sign-off dates, auto-calculated contract end, countdown
- **Sea Time** — auto-calculated from contracts + manual historical records, broken down by rank
- **Career** — next rank requirements, progress bar, estimated promotion date
- **Leave** — onboard/leave ratio, expected return date after sign-off
- **Calendar** — onboard/leave/expiry visualization
- **i18n** — English & Persian (RTL) with Jalali calendar support

## Getting started

```bash
npm install
npm start
```

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start Expo dev server |
| `npm run android` | Run on Android |
| `npm run ios` | Run on iOS (macOS required) |
| `npm test` | Run unit tests (Jest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## Building locally (no EAS / Expo cloud)

Release builds are plain local Gradle builds against your own Android SDK. The JS bundle is embedded automatically by the Expo/React Native Gradle plugin — no Metro server needed.

### Prerequisites

- Node.js 18+ and JDK 17
- Android SDK with platform 36, build-tools 36.0.0, NDK 27.1.12297006 (Gradle prints the exact versions it wants on first run)
- `ANDROID_HOME` set, or an `android/local.properties` file containing `sdk.dir=<path to your Android SDK>`

### One-time setup

1. Install dependencies and generate the native `android/` folder (it is **not** committed to this repo):

   ```bash
   npm install
   npx expo prebuild -p android
   ```

2. Generate your release keystore from `android/app`:

   ```bash
   keytool -genkeypair -v -keystore release.keystore -alias seafarerstoolkit -keyalg RSA -keysize 2048 -validity 10000
   ```

   Back it up — you can't update a published app without it.

3. Create `android/app/release-keystore.properties` (already git-ignored, never commit it):

   ```properties
   storeFile=release.keystore
   storePassword=<your store password>
   keyAlias=seafarerstoolkit
   keyPassword=<your key password>
   ```

4. `expo prebuild` generates a template `build.gradle` that signs releases with the debug key. Re-apply the release signing and the ARM architecture filter inside the `android { }` block of `android/app/build.gradle`:

   ```gradle
   signingConfigs {
       debug {
           storeFile file('debug.keystore')
           storePassword 'android'
           keyAlias 'androiddebugkey'
           keyPassword 'android'
       }
       release {
           def keystorePropsFile = file('release-keystore.properties')
           if (keystorePropsFile.exists()) {
               def keystoreProps = new Properties()
               keystoreProps.load(new FileInputStream(keystorePropsFile))
               storeFile file(keystoreProps['storeFile'])
               storePassword keystoreProps['storePassword']
               keyAlias keystoreProps['keyAlias']
               keyPassword keystoreProps['keyPassword']
           }
       }
   }
   buildTypes {
       release {
           signingConfig signingConfigs.release
           minifyEnabled enableMinifyInReleaseBuilds
           proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"
       }
   }

    // Friendly output name: SeafarersToolkit-v<version>-release.apk
    applicationVariants.all { variant ->
        variant.outputs.all { output ->
            outputFileName = "SeafarersToolkit-v${variant.versionName}-release.apk"
        }
    }
   ```

### Building

From the `android/` folder:

```bash
./gradlew :app:assembleRelease   # APK -> app/build/outputs/apk/release/
./gradlew :app:bundleRelease     # AAB for Play Store -> app/build/outputs/bundle/release/
```

`assembleRelease` produces one APK containing both ARM architectures
(`arm64-v8a` + `armeabi-v7a`, restricted via `ndk.abiFilters` in
`defaultConfig`), named `SeafarersToolkit-v<version>-release.apk`.

Verify the signature (should be your key, not `androiddebugkey`):

```bash
$ANDROID_HOME/build-tools/36.0.0/apksigner verify --print-certs app/build/outputs/apk/release/*.apk
```

### Notes

- **Secrets stay local:** `release.keystore`, `release-keystore.properties`, and `android/local.properties` are git-ignored. Never commit them.
- **Versioning:** set `version` and `android.versionCode` in `app.json`. With a freshly prebuilt `android/` folder Gradle picks them up automatically; if you keep a hand-maintained `android/` folder, mirror the same values in `android/app/build.gradle` (`versionCode` / `versionName`).
- **Do not re-run `expo prebuild` on an existing hand-maintained `android/` folder** — it overwrites the signing/ABI config above. See `store/release-checklist.md` for the full list of hand edits.

## Project structure

```
src/
├── app/          # Expo Router screens (tabs + modals)
├── components/   # Reusable UI components
├── constants/    # Theme tokens
├── database/     # SQLite schema + repositories
├── domain/       # Pure business logic (sea time, contracts, career, leave)
├── hooks/        # TanStack Query hooks
├── i18n/         # en/fa translations
├── services/     # File storage, notifications
├── store/        # Zustand settings store
├── types/        # Domain types
└── utils/        # Date utilities (timezone-safe, Jalali), validation
```
