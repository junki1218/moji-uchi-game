// 先生が問題に付けた写真を iPad の中（IndexedDB）に保存する。キーは問題の id。
// localStorage は容量が小さい（約5MB）ので、画像はこちらに置く。

const DB = 'moji-uchi-game';
const STORE = 'photos';
const MAX_SIDE = 512;

let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// 画面に出すための URL をためておく（毎回 Blob から作り直さない）
const urls = new Map<string, string>();
let ids: Set<string> | null = null;

/** 起動時に一度呼ぶ。写真のある問題の一覧を覚える */
export async function loadPhotoIndex(): Promise<void> {
  try {
    const keys = (await tx('readonly', (s) => s.getAllKeys())) as string[];
    ids = new Set(keys);
  } catch {
    ids = new Set(); // IndexedDB が使えない環境でも問題は動かす
  }
}

export function hasPhoto(id: string): boolean {
  return ids?.has(id) ?? false;
}

export async function photoUrl(id: string): Promise<string | null> {
  if (!hasPhoto(id)) return null;
  const cached = urls.get(id);
  if (cached) return cached;
  const blob = (await tx('readonly', (s) => s.get(id))) as Blob | undefined;
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}

export async function savePhoto(id: string, blob: Blob): Promise<void> {
  await tx('readwrite', (s) => s.put(blob, id));
  ids?.add(id);
  const old = urls.get(id);
  if (old) URL.revokeObjectURL(old);
  urls.delete(id);
}

export async function removePhoto(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
  ids?.delete(id);
  const old = urls.get(id);
  if (old) URL.revokeObjectURL(old);
  urls.delete(id);
}

/** iPad の写真・カメラ画像を正方形に切り抜いて縮小する（容量節約と、絵の枠に合わせるため） */
export async function shrinkImage(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height);
  const n = Math.min(MAX_SIDE, s);
  const canvas = document.createElement('canvas');
  canvas.width = n;
  canvas.height = n;
  canvas.getContext('2d')!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, n, n);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を変換できません'))), 'image/jpeg', 0.85),
  );
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(url: string): Promise<Blob> {
  return (await fetch(url)).blob();
}

export async function photoBlob(id: string): Promise<Blob | null> {
  if (!hasPhoto(id)) return null;
  return ((await tx('readonly', (s) => s.get(id))) as Blob | undefined) ?? null;
}
