// iPad の中のデータベース（IndexedDB）。localStorage は容量が小さい（約5MB）ので、画像はこちらに置く。
// photos … 先生が問題に付けた写真（キー＝問題 id）
// writings … 手書きの記録（キー＝保存した時刻のミリ秒）

const DB = 'moji-uchi-game';
const VERSION = 2;
export type StoreName = 'photos' | 'writings';

let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      for (const name of ['photos', 'writings'] as StoreName[]) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

export async function tx<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
