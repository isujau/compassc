import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  randomUUID,
} from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

const KEY_NAME = 'compasscam.aes256.key.v1';
const VAULT_DIRECTORY = 'compasscam-private-vault';
const PREVIEW_DIRECTORY = 'compasscam-decrypted-previews';
const EXTENSION = '.ccv';

type VaultItem = {
  id: string;
  filename: string;
  capturedAt: number;
};

function vaultDirectory(): Directory {
  return new Directory(Paths.document, VAULT_DIRECTORY);
}

function previewDirectory(): Directory {
  return new Directory(Paths.cache, PREVIEW_DIRECTORY);
}

function ensureDirectory(directory: Directory): void {
  if (!directory.exists) {
    directory.create({ intermediates: true, idempotent: true });
  }
}

function parseFilename(filename: string): VaultItem | null {
  if (!filename.endsWith(EXTENSION)) return null;
  const stem = filename.slice(0, -EXTENSION.length);
  const separator = stem.indexOf('_');
  if (separator < 1) return null;
  const capturedAt = Number(stem.slice(0, separator));
  const id = stem.slice(separator + 1);
  if (!Number.isFinite(capturedAt) || !id) return null;
  return { id, filename, capturedAt };
}

function listVaultFiles(): File[] {
  const directory = vaultDirectory();
  if (!directory.exists) return [];
  return directory.list().filter(
    (entry): entry is File => entry instanceof File && entry.uri.endsWith(EXTENSION),
  );
}

export async function getOrCreateVaultKey(): Promise<AESEncryptionKey> {
  const encodedKey = await SecureStore.getItemAsync(KEY_NAME);
  if (encodedKey) {
    return AESEncryptionKey.import(encodedKey, 'base64');
  }

  if (listVaultFiles().length > 0) {
    throw new Error(
      'The vault key is missing while encrypted photos remain. Do not reset or overwrite the vault; without the original key those photos cannot be recovered.',
    );
  }

  const key = await AESEncryptionKey.generate(256);
  await SecureStore.setItemAsync(KEY_NAME, await key.encoded('base64'));
  return key;
}

export async function saveCapturedPhoto(sourceUri: string): Promise<VaultItem> {
  const source = new File(sourceUri);
  let destination: File | undefined;
  let destinationCreated = false;
  try {
    const key = await getOrCreateVaultKey();
    const plaintext = await source.bytes();
    const sealed = await aesEncryptAsync(plaintext, key);
    const encryptedBytes = await sealed.combined();

    const capturedAt = Date.now();
    const id = randomUUID();
    const filename = `${capturedAt}_${id}${EXTENSION}`;
    const directory = vaultDirectory();
    ensureDirectory(directory);
    destination = new File(directory, filename);
    destination.create({ intermediates: true });
    destinationCreated = true;
    destination.write(encryptedBytes);
    return { id, filename, capturedAt };
  } catch (error) {
    if (destinationCreated && destination?.exists) {
      try {
        destination.delete();
      } catch {
        // Best-effort cleanup; preserve the original encryption/write error.
      }
    }
    throw error;
  } finally {
    try {
      if (source.exists) source.delete();
    } catch {
      // Best-effort cleanup of the camera-provided plaintext cache file.
    }
  }
}

export function listVaultPhotos(): VaultItem[] {
  return listVaultFiles()
    .map((file) => parseFilename(file.uri.split('/').pop() ?? ''))
    .filter((item): item is VaultItem => item !== null)
    .sort((a, b) => b.capturedAt - a.capturedAt);
}

export async function createDecryptedPreview(item: VaultItem): Promise<string> {
  const key = await getOrCreateVaultKey();
  const encryptedFile = new File(vaultDirectory(), item.filename);
  if (!encryptedFile.exists) throw new Error('This photo is no longer in the vault.');

  const encryptedBytes = await encryptedFile.bytes();
  const sealed = AESSealedData.fromCombined(encryptedBytes);
  const plaintext = await aesDecryptAsync(sealed, key);

  const directory = previewDirectory();
  ensureDirectory(directory);
  const previewFile = new File(directory, `${item.id}.jpg`);
  previewFile.create({ intermediates: true, overwrite: true });
  previewFile.write(plaintext);
  return previewFile.uri;
}

export function deleteVaultPhoto(item: VaultItem): void {
  const file = new File(vaultDirectory(), item.filename);
  if (file.exists) file.delete();
  const preview = new File(previewDirectory(), `${item.id}.jpg`);
  if (preview.exists) preview.delete();
}

export function clearDecryptedPreviews(): void {
  const directory = previewDirectory();
  if (directory.exists) directory.delete();
}

export type { VaultItem };
