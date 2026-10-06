// Sounds you import into dev.1 Studio. They're kept in the browser's
// IndexedDB rather than with the stage, because sound files are big and the
// stage's own save only has room for a few megabytes.

export interface MySound {
  id: string;
  name: string;
  file: Blob;
}

const DATABASE = "dev1-studio";
const STORE = "sounds";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const request = work(database.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

export function loadMySounds(): Promise<MySound[]> {
  return run("readonly", (store) => store.getAll() as IDBRequest<MySound[]>).catch(() => []);
}

export function keepMySound(sound: MySound): Promise<void> {
  return run("readwrite", (store) => store.put(sound)).then(() => undefined);
}

export function forgetMySound(id: string): Promise<void> {
  return run("readwrite", (store) => store.delete(id)).then(() => undefined);
}

// Each sound gets one link to its file; every play makes a fresh player, so
// the same sound can overlap itself.
const links = new Map<string, string>();

export function playMySound(sound: MySound): void {
  let link = links.get(sound.id);
  if (!link) {
    link = URL.createObjectURL(sound.file);
    links.set(sound.id, link);
  }
  void new Audio(link).play().catch(() => {});
}
