# Implementation references

- Expo Camera permissions, preview and photo capture: https://docs.expo.dev/versions/latest/sdk/camera/
- Expo Crypto AES encryption: https://docs.expo.dev/versions/latest/sdk/crypto/
- Expo FileSystem private app storage: https://docs.expo.dev/versions/latest/sdk/filesystem/
- Expo SecureStore / Android Keystore-backed storage: https://docs.expo.dev/versions/latest/sdk/securestore/
- Expo LocalAuthentication, Android device-credential fallback and options: https://docs.expo.dev/versions/latest/sdk/local-authentication/
- Expo Haptics: https://docs.expo.dev/versions/latest/sdk/haptics/
- Android volume-key listener module: https://github.com/hirbod/react-native-volume-manager
- Android SDK command-line tools and SDK Manager: https://developer.android.com/studio and https://developer.android.com/tools/sdkmanager

`expo-secure-store`'s Android authentication-bound storage path is biometric-enrollment-dependent; the vault therefore uses Android LocalAuthentication as its user-flow gate and keeps the key encrypted at rest without a second biometrics-only prompt. For details, see the official SecureStore documentation and Android module source in the Expo repository: https://github.com/expo/expo/tree/main/packages/expo-secure-store/android

The Android SDK installation references are provided for users building locally. This sandbox had no Android SDK or attached device, so no APK or hardware validation was produced.
