import { Filesystem, Directory } from '@capacitor/filesystem';
import { LIBRARY, type LibraryTrack } from '@/assets/library';
import { readAlbumArt } from './albumArt';
import { isPro } from './license';

export type DeviceTrack = LibraryTrack & { file?: File; handle?: FileSystemFileHandle; kind?: 'audio' | 'video'; native?: boolean; artworkUrl?: string | null; bpm?: number; firstBeat?: number; stored?: boolean };

/** Imported tracks live here forever until the user deletes them. */
const LIBRARY_DIR = 'duigsstudio/library';
/** Free accounts keep this many imported tracks; PRO is unlimited. */
export const FREE_IMPORT_LIMIT = 5;

async function ensureLibraryDir() {
  try { await Filesystem.mkdir({ path: LIBRARY_DIR, directory: Directory.Documents, recursive: true }); } catch { /* exists */ }
}
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(blob);
  });
}
function base64ToFile(base64: string, name: string, type: string): File {
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return new File([out], name, { type });
}
function safeFileName(name: string) { return name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120) || 'track'; }
type DirectoryPicker = () => Promise<FileSystemDirectoryHandle>;
const CACHE_KEY = 'mixrdjspro-library-directory';
let tracks: DeviceTrack[] = [...LIBRARY];
let queue: DeviceTrack[] = [];
let playlists: Record<string, DeviceTrack[]> = {};
const listeners = new Set<() => void>();
let current = { tracks, queue, playlists };
const publish = () => { current = { tracks, queue, playlists }; listeners.forEach(fn => fn()); };
export const deviceLibrary = {
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
  snapshot() { return current; },
  async addFiles(files: File[]) {
    const accepted = files.filter(f => f.type.startsWith('audio/') || f.type.startsWith('video/') || /\.(mp3|aac|m4a|wav|flac|ogg|mp4|webm|mov)$/i.test(f.name));
    if (!accepted.length) return;
    const imported = tracks.filter(t => t.file || t.stored).length;
    if (!isPro() && imported + accepted.length > FREE_IMPORT_LIMIT) {
      throw new Error(`Free version keeps ${FREE_IMPORT_LIMIT} imported tracks. Go PRO for unlimited imports.`);
    }
    await ensureLibraryDir();
    const next: DeviceTrack[] = [];
    for (const f of accepted) {
      const filename = safeFileName(f.name);
      try {
        await Filesystem.writeFile({ path: `${LIBRARY_DIR}/${filename}`, directory: Directory.Documents, data: await blobToBase64(f), recursive: true });
      } catch { throw new Error(`Could not keep ${f.name} on this device.`); }
      next.push({ title: f.name.replace(/\.[^.]+$/, ''), filename, url: '', file: f, kind: f.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(f.name) ? 'video' as const : 'audio' as const, artworkUrl: null, stored: true });
    }
    tracks = [...next, ...tracks.filter(t => !next.some(n => n.filename === t.filename && (t.file || t.stored)))]; publish();
    queueArtwork(next);
  },
  /** Delete an imported track from the device folder and the list. */
  async removeTrack(track: DeviceTrack) {
    if (track.stored) {
      try { await Filesystem.deleteFile({ path: `${LIBRARY_DIR}/${track.filename}`, directory: Directory.Documents }); } catch { /* already gone */ }
    }
    tracks = tracks.filter(t => t !== track); publish();
  },
  /** Reload tracks kept in the device folder (survives app restarts). */
  async restoreStored() {
    await ensureLibraryDir();
    let listing;
    try { listing = await Filesystem.readdir({ path: LIBRARY_DIR, directory: Directory.Documents }); } catch { return; }
    const found: DeviceTrack[] = [];
    for (const entry of listing.files) {
      if (entry.type !== 'file' || !/\.(mp3|aac|m4a|wav|flac|ogg|mp4|webm|mov)$/i.test(entry.name)) continue;
      if (tracks.some(t => t.stored && t.filename === entry.name)) continue;
      try {
        const data = (await Filesystem.readFile({ path: `${LIBRARY_DIR}/${entry.name}`, directory: Directory.Documents })).data as string;
        const mime = /\.(mp4|webm|mov)$/i.test(entry.name) ? 'video/mp4' : 'audio/mpeg';
        found.push({ title: entry.name.replace(/\.[^.]+$/, ''), filename: entry.name, url: '', file: base64ToFile(data, entry.name, mime), kind: /\.(mp4|webm|mov)$/i.test(entry.name) ? 'video' : 'audio', artworkUrl: null, stored: true });
      } catch { /* skip unreadable file */ }
    }
    if (found.length) { tracks = [...found, ...tracks]; publish(); queueArtwork(found); }
  },
  /** Android app: ask permission once, then list every song/video on the phone. */
  async scanNative() {
    const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; convertFileSrc?: (u: string) => string; Plugins?: { NativeMedia?: { scan(): Promise<{ items: { uri: string; title: string; filename: string; artworkUri?: string; kind: 'audio' | 'video' }[] }> } } } }).Capacitor;
    const media = cap?.isNativePlatform?.() ? cap.Plugins?.NativeMedia : undefined;
    if (!media) return false;
    const { items } = await media.scan();
    const found: DeviceTrack[] = items.map(i => ({ title: i.title, filename: i.filename || i.uri, url: cap?.convertFileSrc ? cap.convertFileSrc(i.uri) : i.uri, artworkUrl: i.artworkUri && cap?.convertFileSrc ? cap.convertFileSrc(i.artworkUri) : i.artworkUri, kind: i.kind, native: true }));
    tracks = [...found, ...tracks.filter(t => !t.native)]; publish();
    return true;
  },
  async openDirectory() {
    if (await this.scanNative()) return true;
    const picker = (window as Window & { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker;
    if (!picker) return false;
    const handle = await picker();
    await saveHandle(handle);
    await this.scan(handle);
    return true;
  },
  async restore() {
    await this.restoreStored().catch(() => {});
    if (await this.scanNative().catch(() => false)) return;
    const handle = await readHandle();
    if (!handle) return;
    const query = (handle as FileSystemDirectoryHandle & { queryPermission?: (o: { mode: 'read' }) => Promise<PermissionState> }).queryPermission;
    const permission = query ? await query.call(handle, { mode: 'read' }) : 'prompt';
    if (permission === 'granted') await this.scan(handle);
  },
  async scan(handle: FileSystemDirectoryHandle) {
    const found: DeviceTrack[] = [];
    async function visit(dir: FileSystemDirectoryHandle) {
      for await (const item of dir.values()) {
        if (item.kind === 'directory') { await visit(item); continue; }
        if (!/\.(mp3|aac|m4a|wav|flac|ogg|mp4|webm|mov)$/i.test(item.name)) continue;
        found.push({ title: item.name.replace(/\.[^.]+$/, ''), filename: item.name, url: '', handle: item, kind: /\.(mp4|webm|mov)$/i.test(item.name) ? 'video' : 'audio', artworkUrl: null });
        // Show the list early while large folders are still being walked.
        if (found.length % 200 === 0) { tracks = [...found, ...tracks.filter(t => !t.handle)]; publish(); await idle(); }
      }
    }
    await visit(handle);
    tracks = [...found, ...tracks.filter(t => !t.handle)]; publish();
    queueArtwork(found);
  },
  setAnalysis(track: DeviceTrack, bpm: number, firstBeat: number) { track.bpm = bpm; track.firstBeat = firstBeat; publish(); },
  addQueue(track: DeviceTrack) { queue = [...queue, track]; publish(); },
  removeQueue(track: DeviceTrack) { const index = queue.indexOf(track); if (index >= 0) { queue = queue.filter((_, i) => i !== index); publish(); } },
  addAllQueue(items: DeviceTrack[]) { queue = [...queue, ...items]; publish(); },
  addPlaylist(name: string, items: DeviceTrack[]) { playlists = { ...playlists, [name]: [...(playlists[name] ?? []), ...items] }; publish(); },
};

// Album art is read a couple of files at a time in idle moments so big
// libraries never freeze the UI. Tracks without art simply stay blank.
const idle = () => new Promise<void>(r => {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(() => r(), { timeout: 200 }); else setTimeout(r, 16);
});
let artQueue: DeviceTrack[] = [];
let artRunning = false;
function queueArtwork(items: DeviceTrack[]) {
  artQueue.push(...items.filter(t => t.kind !== 'video' && !t.artworkUrl));
  if (artRunning) return;
  artRunning = true;
  void (async () => {
    let changed = 0;
    while (artQueue.length) {
      const batch = artQueue.splice(0, 2);
      await Promise.all(batch.map(async t => {
        try {
          const file = t.file ?? (t.handle ? await t.handle.getFile() : undefined);
          if (file && file.size < 60 * 1024 * 1024) t.artworkUrl = await readAlbumArt(file);
          if (t.artworkUrl) changed++;
        } catch { /* leave blank */ }
      }));
      if (changed >= 12 || !artQueue.length) { if (changed) publish(); changed = 0; }
      await idle();
    }
    artRunning = false;
  })();
}

// Store only a directory handle, not the user's actual media files.
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_KEY, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('access');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveHandle(handle: FileSystemDirectoryHandle) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('access', 'readwrite');
    tx.objectStore('access').put(handle, 'directory');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
  database.close();
}
async function readHandle(): Promise<FileSystemDirectoryHandle | null> {
  const database = await db();
  const handle = await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
    const request = database.transaction('access').objectStore('access').get('directory');
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
  database.close(); return handle;
}
