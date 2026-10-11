import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VolumeManager } from 'react-native-volume-manager';
import { saveCapturedPhoto } from '@/lib/vault';

const C = {
  background: '#101820',
  panel: '#17242B',
  ivory: '#F5F1E9',
  muted: '#A5B2B5',
  amber: '#F0B85A',
  sage: '#A9D6B2',
  line: 'rgba(245,241,233,0.13)',
};

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraView>(null);
  const [appIsActive, setAppIsActive] = useState(AppState.currentState === 'active');
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const captureLock = useRef(false);
  const captureAction = useRef<() => void>(() => undefined);

  const previewMounted = Boolean(permission?.granted && cameraEnabled && isFocused && appIsActive);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      setAppIsActive(active);
      if (!active) setCameraReady(false);
    });
    return () => subscription.remove();
  }, []);

  const capture = useCallback(async () => {
    if (!previewMounted || !cameraReady || !cameraRef.current || captureLock.current) return;
    captureLock.current = true;
    setBusy(true);
    setMessage('Saving encrypted photo…');
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.92 });
      if (!photo?.uri) throw new Error('The camera did not return a photo.');
      await saveCapturedPhoto(photo.uri);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setMessage('Saved to your encrypted vault');
      setTimeout(() => setMessage(''), 2400);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Please try again.';
      setMessage('Photo not saved');
      Alert.alert('Could not save photo', detail);
    } finally {
      captureLock.current = false;
      setBusy(false);
    }
  }, [cameraReady, previewMounted]);

  useEffect(() => {
    captureAction.current = () => {
      void capture();
    };
  }, [capture]);

  useEffect(() => {
    if (!previewMounted || Platform.OS !== 'android') return;
    let disposed = false;
    let removeListener: (() => void) | undefined;
    let lastShutterAt = 0;

    const enableVolumeShutter = async () => {
      try {
        // The module intercepts both hardware volume keys while the visible camera is active.
        await VolumeManager.showNativeVolumeUI({ enabled: false });
        if (disposed) {
          await VolumeManager.showNativeVolumeUI({ enabled: true });
          return;
        }
        const subscription = VolumeManager.addVolumeListener(() => {
          const now = Date.now();
          if (now - lastShutterAt < 650) return;
          lastShutterAt = now;
          captureAction.current();
        });
        removeListener = () => subscription.remove();
      } catch {
        setMessage('Volume shutter unavailable — use the on-screen shutter');
        setTimeout(() => setMessage(''), 3000);
      }
    };

    void enableVolumeShutter();
    return () => {
      disposed = true;
      removeListener?.();
      void VolumeManager.showNativeVolumeUI({ enabled: true }).catch(() => undefined);
    };
  }, [previewMounted]);

  const enableCamera = async () => {
    if (permission?.granted) {
      setCameraEnabled(true);
      return;
    }
    const result = await requestPermission();
    if (result.granted) {
      setCameraEnabled(true);
    } else if (!result.canAskAgain) {
      Alert.alert(
        'Camera permission is off',
        'Allow camera access in Android Settings to use the visible camera preview.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ],
      );
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.wordmark}>COMPASSCAM</Text>
          <Text style={styles.kicker}>PRIVATE CAMERA</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open encrypted photo vault"
          style={styles.vaultButton}
          disabled={busy}
          onPress={() => {
            setCameraReady(false);
            router.push('/vault');
          }}
        >
          <Text style={styles.vaultIcon}>▤</Text>
          <Text style={styles.vaultButtonText}>VAULT</Text>
        </Pressable>
      </View>

      <View style={styles.previewFrame}>
        {previewMounted ? (
          <>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              onCameraReady={() => setCameraReady(true)}
            />
            <View style={styles.activeBadge} accessibilityLiveRegion="polite">
              <View style={styles.activeDot} />
              <Text style={styles.activeText}>CAMERA ACTIVE</Text>
              <Text style={styles.activeDivider}>·</Text>
              <Text style={styles.activeSubtext}>PREVIEW VISIBLE</Text>
            </View>
            <View style={styles.previewBottomNote}>
              <Text style={styles.previewNoteText}>Live view is on-screen while you capture.</Text>
            </View>
          </>
        ) : (
          <View style={styles.permissionPanel}>
            <View style={styles.lensMark}>
              <View style={styles.lensInner} />
            </View>
            <Text style={styles.panelTitle}>
              {permission?.granted ? 'Camera paused' : 'Your camera, clearly visible'}
            </Text>
            <Text style={styles.panelBody}>
              {permission?.granted
                ? 'The preview appears only while this screen is in the foreground.'
                : 'CompassCam shows a live viewfinder only after you choose to enable the camera.'}
            </Text>
            <Pressable style={styles.enableButton} onPress={() => void enableCamera()}>
              <Text style={styles.enableButtonText}>
                {permission?.granted ? 'OPEN CAMERA' : 'ENABLE CAMERA'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.controls}>
        <View style={styles.controlsHeading}>
          <Text style={styles.controlsTitle}>CAPTURE</Text>
          <Text style={styles.controlsHint}>Photos stay encrypted on this device</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Capture and encrypt photo"
          disabled={!previewMounted || !cameraReady || busy}
          onPress={() => void capture()}
          style={({ pressed }) => [
            styles.shutterButton,
            pressed && styles.shutterPressed,
            (!previewMounted || !cameraReady || busy) && styles.shutterDisabled,
          ]}
        >
          {busy ? <ActivityIndicator color={C.background} /> : <View style={styles.shutterCore} />}
        </Pressable>
        <Text style={styles.volumeHint}>
          {Platform.OS === 'android'
            ? 'VOLUME UP OR DOWN · SHUTTER WHEN CAMERA IS OPEN'
            : 'Use the on-screen shutter'}
        </Text>
        <View style={styles.statusRow}>
          <View style={styles.secureDot} />
          <Text style={styles.statusText} numberOfLines={2}>
            {message || (busy ? 'Encrypting locally…' : 'No cloud sync · No public gallery copy')}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerBrand}>COMPASSCAM</Text>
        <Text style={styles.footerCopy}>CLEAR · LOCAL · PRIVATE</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background, paddingHorizontal: 18 },
  header: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: { color: C.ivory, fontSize: 17, fontWeight: '800', letterSpacing: 2.2 },
  kicker: { color: C.muted, fontSize: 9, fontWeight: '700', letterSpacing: 2.5, marginTop: 4 },
  vaultButton: {
    minHeight: 46,
    minWidth: 94,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.panel,
  },
  vaultIcon: { color: C.amber, fontSize: 19 },
  vaultButtonText: { color: C.ivory, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  previewFrame: {
    flex: 1,
    minHeight: 280,
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#0A1116',
    borderWidth: 1,
    borderColor: C.line,
  },
  activeBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    minHeight: 39,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(10,17,22,0.82)',
    borderColor: 'rgba(240,184,90,0.55)',
    borderWidth: 1,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.amber },
  activeText: { color: C.amber, fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  activeDivider: { color: 'rgba(245,241,233,0.55)', fontSize: 13 },
  activeSubtext: { color: C.ivory, fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  previewBottomNote: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: 'rgba(10,17,22,0.65)',
  },
  previewNoteText: { color: C.ivory, fontSize: 12, textAlign: 'center' },
  permissionPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
    backgroundColor: C.panel,
  },
  lensMark: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 35,
    borderWidth: 2,
    borderColor: C.amber,
    marginBottom: 20,
  },
  lensInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#23363B',
    borderWidth: 2,
    borderColor: C.sage,
  },
  panelTitle: { color: C.ivory, fontSize: 21, fontWeight: '700', textAlign: 'center' },
  panelBody: { color: C.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 9, maxWidth: 310 },
  enableButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    marginTop: 23,
    borderRadius: 15,
    backgroundColor: C.amber,
  },
  enableButtonText: { color: C.background, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  controls: { alignItems: 'center', paddingTop: 16, paddingBottom: 12 },
  controlsHeading: { width: '100%', alignItems: 'center', marginBottom: 12 },
  controlsTitle: { color: C.ivory, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  controlsHint: { color: C.muted, fontSize: 11, marginTop: 4 },
  shutterButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: C.amber,
    backgroundColor: C.ivory,
  },
  shutterPressed: { transform: [{ scale: 0.95 }] },
  shutterDisabled: { opacity: 0.44 },
  shutterCore: { width: 57, height: 57, borderRadius: 29, backgroundColor: C.ivory, borderWidth: 2, borderColor: C.background },
  volumeHint: { color: C.amber, fontSize: 9, textAlign: 'center', fontWeight: '800', letterSpacing: 1, marginTop: 12 },
  statusRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 5 },
  secureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.sage },
  statusText: { color: C.muted, fontSize: 11, textAlign: 'center', flexShrink: 1 },
  footer: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: C.line },
  footerBrand: { color: C.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  footerCopy: { color: C.muted, fontSize: 8, letterSpacing: 1.4 },
});
