# CompassCam

A plain-local, Android-first privacy camera app. The camera preview is visible while active, and captured photos are encrypted in app-private storage.

## Privacy model

Camera access starts only after the user taps **Enable camera** and grants Android's permission prompt. A persistent **CAMERA ACTIVE · PREVIEW VISIBLE** status appears whenever the live preview is mounted. The preview and volume shutter stop when leaving the camera screen or backgrounding the app. Both the on-screen shutter and Android volume-up/down buttons capture; successful saves trigger a heavy haptic.

Photo bytes are encrypted with AES-256-GCM before the encrypted file is written to the app's private documents directory. The key is stored using Android Keystore-backed SecureStore. Android backup is disabled, and the app requests no shared-photo-library or microphone permission. The camera-provided temporary JPEG is removed on both success and failure (best effort). Decrypted preview files live in app-private cache and are cleared when a preview closes, the vault locks/backgrounds, or the vault opens again after a prior process exit. An abrupt process kill can delay cache cleanup until the next vault launch.

Opening the vault goes through Android system authentication using Expo LocalAuthentication; the default prompt permits the device credential (PIN/pattern) as well as biometrics, subject to Android/device settings. There is no app-level pattern reset or remote recovery. The key is Keystore-protected at rest, but it is **not** configured with SecureStore's `requireAuthentication` option: Expo's Android auth-bound SecureStore path requires biometric enrollment and could prevent use of the requested device-credential fallback. Authentication therefore gates the normal app flow; it does not protect against malicious code already executing inside the app process. Rooted/compromised devices and people who can unlock the device remain outside the protection model.

The app source implements no upload, cloud sync, or automatic gallery export. Sharing is an explicit action from an unlocked photo preview and creates a copy outside the vault. The generated Expo Android manifest currently includes `INTERNET` and `SYSTEM_ALERT_WINDOW` permissions; this app does not use them for photo transfer, but the build is not OS-enforced as offline. Review/remove those permissions in a strict-offline release build and validate the resulting development workflow.

Clearing app data, uninstalling, a device reset, or losing the key can permanently destroy access to photos. There is no app-level recovery path.

## Requirements and local build

Use Node.js/npm plus Android Studio's Android SDK and a physical Android device or configured emulator. `react-native-volume-manager` contains native code, so **Expo Go is not supported** for volume-button capture; use a custom native build:

```bash
npm install
npx expo prebuild --platform android
npx expo run:android
```

`npx expo run:android` builds and installs a development client using the local Android SDK. The generated Gradle release build currently uses Expo's default debug signing configuration; configure your own release keystore before distribution. This repository does not contain an APK, and no Android SDK/device was available in the sandbox for native compilation or physical-device testing.

## Checks

The following checks passed in the sandbox:

```bash
npm run lint
npm run typecheck
npx expo-doctor
npx expo install --check
npx expo prebuild --platform android --clean --no-install
npx expo export --platform android
```

Native camera, volume-key, haptic, and screen-lock behavior still needs testing on an Android device. See [TODO.md](./TODO.md) for the remaining device-validation item.

## Dependency security note

The current npm audit database reports 29 upstream advisories in the Expo/React Native/Metro dependency tree (18 high and 11 moderate). A non-forced `npm audit fix` could not resolve them; the suggested forced changes downgrade major SDK packages, so they were not applied. Re-run the audit and update to a compatible Expo SDK release before public distribution.
