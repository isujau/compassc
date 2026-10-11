# CompassCam — implementation plan

## Product scope

Build a plain-local Android-first Expo/React Native app for transparent photography and private, on-device photo storage. The camera preview is shown only while the camera screen is in the foreground. A persistent, high-contrast **CAMERA ACTIVE** label stays visible whenever the preview is mounted. There is no fake chat, hidden capture, black/off screen, or capture while the app is backgrounded. The app does not override Android Home or Power controls.

## Architecture

- **Runtime:** Expo SDK 57, React Native, TypeScript, Expo Router; plain local project with no Manus-managed services or cloud sync.
- **Camera:** `expo-camera` with a user-triggered Android permission request and a foreground `CameraView`. The preview is unmounted on navigation/background.
- **Shutter:** visible on-screen shutter plus Android volume-up/down event handling through `react-native-volume-manager`, enabled only on the visible camera screen. Native haptic feedback uses Expo Haptics' heavy impact.
- **Private archive:** JPEG bytes are encrypted with AES-256-GCM and written only to the app's private documents directory. The encryption key is stored through Android Keystore-backed `expo-secure-store`. No Media Library or broad storage permission is requested. Android app backup is disabled to avoid silently syncing private photos through OS backup.
- **Access:** the gallery requests Android system authentication (biometrics/device screen-lock fallback) before loading encrypted photos. There is no app-managed pattern to reset. The app auto-locks and clears decrypted preview-cache files when backgrounded or closed. The user can intentionally share/export an image from an already-unlocked preview; there is no automatic export.
- **Recovery:** no remote recovery is available. The UI and README warn that clearing app data, uninstalling, or losing the device/key can make the vault unrecoverable; export is deliberate and owner-initiated while unlocked.

## Project structure

- `src/app/_layout.tsx` — Expo Router root stack and status bar.
- `src/app/index.tsx` — permission onboarding, visible camera preview, shutter, and camera-active/volume-control status.
- `src/app/vault.tsx` — system-authenticated archive, photo preview, delete, and deliberate share action.
- `src/lib/vault.ts` — AES-GCM key management, encrypted photo file I/O, decrypted preview-cache lifecycle, and archive listing.
- `app.json` — Android package identity, camera/auth/storage plugin settings, and launcher assets.
- `README.md` — local build/use instructions and limitations.
- `TODO.md` — outcome criteria carried from the approved product scope.

## Design system

- **Design movement:** quiet, tactile utility with Swiss editorial hierarchy and the instrument-panel clarity of a modern camera.
- **Core principles:** camera state is unmistakable; controls are reachable one-handed; privacy choices are legible rather than hidden; secure actions are deliberate and reversible where possible.
- **Color philosophy:** graphite and deep teal frame the live image; warm ivory supports reading; a bright amber marker communicates the active camera state; restrained sage denotes saved/secured states.
- **Layout paradigm:** full-bleed camera preview with a compact header/status rail and a low, thumb-reachable control shelf; the vault uses calm, vertical archive rows rather than a dashboard grid.
- **Signature elements:** a small amber live-status beacon; a round physical-feeling shutter with concentric lens rings; encrypted-file cards marked with a simple lock glyph.
- **Interaction philosophy:** explicit permission before preview, one tap to capture, immediate haptic confirmation, and system authentication before any image is decrypted.
- **Animation:** short 120–180 ms fades for tab/preview changes; no pulsing or attention-grabbing loops that could obscure the active state; a brief shutter-ring compression on capture.
- **Typography:** platform system sans; compact uppercase labels with moderate tracking for instrument statuses, large readable sentence-case titles, and high-contrast body copy. Keep all controls at least 48 dp tall.
- **Brand essence:** a straightforward camera for people who want their photos to remain on their own device; **clear, calm, private**.
- **Brand voice:** concise and candid. Example lines: “Camera active — preview is visible.” “Photos stay encrypted on this device.”
- **Wordmark & logo:** CompassCam wordmark paired with a simple compass needle nested in a lens ring; no imitation of chat, system power, or other apps.
- **Signature brand color:** amber `#F0B85A`, reserved for the live marker and shutter focus ring.
