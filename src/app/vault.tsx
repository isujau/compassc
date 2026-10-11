import * as LocalAuthentication from 'expo-local-authentication';
import * as Sharing from 'expo-sharing';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  clearDecryptedPreviews,
  createDecryptedPreview,
  deleteVaultPhoto,
  getOrCreateVaultKey,
  listVaultPhotos,
  type VaultItem,
} from '@/lib/vault';

const C = {
  background: '#101820',
  panel: '#17242B',
  ivory: '#F5F1E9',
  muted: '#A5B2B5',
  amber: '#F0B85A',
  sage: '#A9D6B2',
  line: 'rgba(245,241,233,0.13)',
  red: '#F08B7D',
};

type Preview = VaultItem & { uri: string };

export default function VaultScreen() {
  const [unlocked, setUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [photos, setPhotos] = useState<VaultItem[]>([]);
  const [selected, setSelected] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const exportInProgress = useRef(false);
  const clearAfterExport = useRef(false);

  useEffect(() => {
    clearDecryptedPreviews();
    return () => clearDecryptedPreviews();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        if (exportInProgress.current) clearAfterExport.current = true;
        else clearDecryptedPreviews();
        setSelected(null);
        setPhotos([]);
        setUnlocked(false);
        setError('Vault locked when the app left the foreground.');
      }
    });
    return () => subscription.remove();
  }, []);

  const unlock = async () => {
    if (unlocking) return;
    setUnlocking(true);
    setError('');
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock your private photo vault',
        promptDescription: 'Use your device biometrics or screen-lock credential.',
        cancelLabel: 'Cancel',
      });
      if (!result.success) {
        setError(result.error === 'not_enrolled'
          ? 'Set up device screen-lock authentication in Android Settings to open the vault.'
          : 'Vault remains locked.');
        return;
      }
      await getOrCreateVaultKey();
      setPhotos(listVaultPhotos());
      setUnlocked(true);
    } catch (unlockError) {
      setError(unlockError instanceof Error ? unlockError.message : 'Could not unlock the vault.');
    } finally {
      setUnlocking(false);
    }
  };

  const openPhoto = async (item: VaultItem) => {
    setLoadingPreview(true);
    setError('');
    try {
      const uri = await createDecryptedPreview(item);
      setSelected({ ...item, uri });
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Could not decrypt this photo.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const lockVault = () => {
    clearDecryptedPreviews();
    setSelected(null);
    setPhotos([]);
    setUnlocked(false);
    router.back();
  };

  const closePreview = () => {
    if (exportInProgress.current) clearAfterExport.current = true;
    else clearDecryptedPreviews();
    setSelected(null);
  };

  const sharePhoto = async () => {
    if (!selected) return;
    exportInProgress.current = true;
    try {
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'This device does not provide a share target.');
        return;
      }
      await Sharing.shareAsync(selected.uri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Export a copy of this private photo',
        UTI: 'public.jpeg',
      });
    } catch {
      Alert.alert('Could not export photo', 'The encrypted original remains in the vault.');
    } finally {
      exportInProgress.current = false;
      if (clearAfterExport.current) {
        clearDecryptedPreviews();
        clearAfterExport.current = false;
      }
    }
  };

  const confirmDelete = () => {
    if (!selected) return;
    const target = selected;
    Alert.alert('Delete this photo?', 'This permanently removes its encrypted vault file.', [
      { text: 'Keep photo', style: 'cancel' },
      {
        text: 'Delete permanently',
        style: 'destructive',
        onPress: () => {
          deleteVaultPhoto(target);
          setPhotos((current) => current.filter((photo) => photo.id !== target.id));
          setSelected(null);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={lockVault} accessibilityRole="button" accessibilityLabel="Lock vault and return to camera">
          <Text style={styles.backArrow}>‹</Text>
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.wordmark}>PRIVATE VAULT</Text>
          <Text style={styles.subhead}>ON-DEVICE · ENCRYPTED</Text>
        </View>
        {unlocked ? (
          <Pressable style={styles.lockButton} onPress={lockVault} accessibilityRole="button">
            <Text style={styles.lockButtonText}>LOCK</Text>
          </Pressable>
        ) : <View style={styles.headerRightSpacer} />}
      </View>

      {!unlocked ? (
        <View style={styles.lockedContent}>
          <View style={styles.lockMark}>
            <Text style={styles.lockGlyph}>⌑</Text>
            <View style={styles.lockCenter} />
          </View>
          <Text style={styles.title}>Photos stay yours.</Text>
          <Text style={styles.body}>
            Unlock with your Android system authentication. Photos are decrypted only after you pass the device prompt.
          </Text>
          <Pressable style={styles.unlockButton} onPress={() => void unlock()} disabled={unlocking}>
            {unlocking ? <ActivityIndicator color={C.background} /> : <Text style={styles.unlockButtonText}>UNLOCK VAULT</Text>}
          </Pressable>
          <View style={styles.privacyCard}>
            <Text style={styles.privacyTitle}>NO RESET · NO REMOTE RECOVERY</Text>
            <Text style={styles.privacyBody}>
              Keep your device lock available. Clearing app data, uninstalling, or losing the encryption key can permanently remove access. Export a copy deliberately while unlocked if you need one.
            </Text>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      ) : (
        <>
          <View style={styles.archiveIntro}>
            <Text style={styles.title}>Your archive</Text>
            <Text style={styles.bodySmall}>{photos.length} encrypted {photos.length === 1 ? 'photo' : 'photos'} · saved only in this app</Text>
          </View>
          {loadingPreview ? (
            <View style={styles.loadingBanner}>
              <ActivityIndicator color={C.amber} />
              <Text style={styles.loadingText}>Decrypting to a temporary private preview…</Text>
            </View>
          ) : null}
          <ScrollView contentContainerStyle={styles.list}>
            {photos.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyGlyph}>◎</Text>
                <Text style={styles.emptyTitle}>Nothing here yet</Text>
                <Text style={styles.bodySmall}>Captured photos will appear here as encrypted files.</Text>
              </View>
            ) : photos.map((photo, index) => (
              <Pressable key={photo.id} style={styles.photoRow} onPress={() => void openPhoto(photo)}>
                <View style={styles.photoMark}><Text style={styles.photoMarkText}>▧</Text></View>
                <View style={styles.photoCopy}>
                  <Text style={styles.photoTitle}>PRIVATE PHOTO {String(photos.length - index).padStart(2, '0')}</Text>
                  <Text style={styles.photoDate}>{new Date(photo.capturedAt).toLocaleString()}</Text>
                  <Text style={styles.encryptedLabel}>AES-256-GCM ENCRYPTED</Text>
                </View>
                <Text style={styles.rowArrow}>›</Text>
              </Pressable>
            ))}
          </ScrollView>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </>
      )}

      <View style={styles.footer}>
        <View style={styles.secureDot} />
        <Text style={styles.footerText}>LOCAL STORAGE · NO CLOUD SYNC</Text>
      </View>

      <Modal visible={Boolean(selected)} animationType="fade" onRequestClose={closePreview}>
        <View style={styles.modal}>
          <SafeAreaView style={styles.modalSafe}>
            <View style={styles.modalHeader}>
              <Pressable style={styles.modalControl} onPress={closePreview}>
                <Text style={styles.modalControlText}>CLOSE</Text>
              </Pressable>
              <Text style={styles.modalDate}>{selected ? new Date(selected.capturedAt).toLocaleString() : ''}</Text>
              <Pressable style={styles.modalControl} onPress={() => void sharePhoto()}>
                <Text style={styles.modalControlText}>EXPORT</Text>
              </Pressable>
            </View>
            {selected ? <Image source={{ uri: selected.uri }} style={styles.photoPreview} resizeMode="contain" /> : null}
            <View style={styles.modalFooter}>
              <Text style={styles.modalNotice}>Sharing creates a copy outside the encrypted vault.</Text>
              <Pressable style={styles.deleteButton} onPress={confirmDelete}>
                <Text style={styles.deleteButtonText}>DELETE ENCRYPTED ORIGINAL</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.background, paddingHorizontal: 18 },
  header: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line },
  backButton: { width: 46, height: 46, justifyContent: 'center' },
  backArrow: { color: C.ivory, fontSize: 36, lineHeight: 40 },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  wordmark: { color: C.ivory, fontSize: 14, fontWeight: '900', letterSpacing: 2 },
  subhead: { color: C.sage, fontSize: 8, fontWeight: '800', letterSpacing: 1.8, marginTop: 4 },
  lockButton: { minWidth: 54, height: 40, alignItems: 'center', justifyContent: 'center' },
  lockButtonText: { color: C.amber, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  headerRightSpacer: { width: 46 },
  lockedContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  lockMark: { width: 84, height: 84, borderRadius: 42, borderColor: C.amber, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginBottom: 21 },
  lockGlyph: { color: C.sage, fontSize: 52, lineHeight: 60 },
  lockCenter: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: C.amber, top: 39 },
  title: { color: C.ivory, fontSize: 25, fontWeight: '700', textAlign: 'center' },
  body: { color: C.muted, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 10, maxWidth: 330 },
  unlockButton: { minHeight: 52, minWidth: 190, alignItems: 'center', justifyContent: 'center', backgroundColor: C.amber, borderRadius: 15, marginTop: 22, paddingHorizontal: 22 },
  unlockButtonText: { color: C.background, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  privacyCard: { width: '100%', marginTop: 28, padding: 16, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 17 },
  privacyTitle: { color: C.amber, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  privacyBody: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 8 },
  errorText: { color: C.red, fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 12, paddingHorizontal: 12 },
  archiveIntro: { paddingTop: 23, paddingBottom: 17 },
  bodySmall: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
  loadingBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, padding: 12, borderRadius: 12, backgroundColor: C.panel },
  loadingText: { color: C.muted, fontSize: 11, flex: 1 },
  list: { gap: 10, paddingBottom: 18 },
  photoRow: { minHeight: 90, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: 17, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
  photoMark: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#24373B', borderWidth: 1, borderColor: 'rgba(169,214,178,0.35)' },
  photoMarkText: { color: C.sage, fontSize: 22 },
  photoCopy: { flex: 1 },
  photoTitle: { color: C.ivory, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  photoDate: { color: C.muted, fontSize: 11, marginTop: 5 },
  encryptedLabel: { color: C.sage, fontSize: 8, fontWeight: '800', letterSpacing: 1, marginTop: 6 },
  rowArrow: { color: C.amber, fontSize: 28, paddingLeft: 5 },
  emptyCard: { minHeight: 220, alignItems: 'center', justifyContent: 'center', padding: 22, borderRadius: 18, backgroundColor: C.panel, borderColor: C.line, borderWidth: 1 },
  emptyGlyph: { color: C.sage, fontSize: 44, marginBottom: 8 },
  emptyTitle: { color: C.ivory, fontSize: 17, fontWeight: '700' },
  footer: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderTopWidth: 1, borderTopColor: C.line },
  secureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.sage },
  footerText: { color: C.muted, fontSize: 8, letterSpacing: 1.4, fontWeight: '800' },
  modal: { flex: 1, backgroundColor: '#080D11' },
  modalSafe: { flex: 1 },
  modalHeader: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15 },
  modalControl: { minHeight: 44, minWidth: 56, justifyContent: 'center' },
  modalControlText: { color: C.amber, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  modalDate: { color: C.ivory, fontSize: 11, textAlign: 'center', flex: 1 },
  photoPreview: { flex: 1, width: '100%' },
  modalFooter: { minHeight: 93, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18, gap: 10 },
  modalNotice: { color: C.muted, fontSize: 10, textAlign: 'center' },
  deleteButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(240,139,125,0.4)', borderRadius: 12 },
  deleteButtonText: { color: C.red, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
});
