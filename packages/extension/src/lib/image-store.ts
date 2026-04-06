/**
 * IndexedDB-backed image store for persisting chat images across browser restarts.
 * Images are stored as blobs (no base64 overhead) and referenced by ID from messages.
 */

const DB_NAME = "gyozai_images";
const DB_VERSION = 1;
const STORE_NAME = "images";

export interface StoredImage {
  id: string;
  conversationId: string;
  data: Blob;
  mimeType: string;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("conversationId", "conversationId", {
          unique: false,
        });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save one or more images tied to a conversation. */
export async function saveImages(
  conversationId: string,
  images: Array<{ id: string; blob: Blob; mimeType: string }>,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const now = Date.now();

  for (const img of images) {
    const record: StoredImage = {
      id: img.id,
      conversationId,
      data: img.blob,
      mimeType: img.mimeType,
      createdAt: now,
    };
    store.put(record);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Retrieve images by their IDs, returning data URLs for rendering. */
export async function getImages(
  imageIds: string[],
): Promise<Array<{ id: string; dataUrl: string }>> {
  if (imageIds.length === 0) return [];

  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  const results: Array<{ id: string; dataUrl: string }> = [];

  const gets = imageIds.map(
    (id) =>
      new Promise<void>((resolve) => {
        const req = store.get(id);
        req.onsuccess = () => {
          const record = req.result as StoredImage | undefined;
          if (record) {
            const reader = new FileReader();
            reader.onloadend = () => {
              results.push({ id, dataUrl: reader.result as string });
              resolve();
            };
            reader.onerror = () => resolve(); // skip missing
            reader.readAsDataURL(record.data);
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      }),
  );

  await Promise.all(gets);
  db.close();
  return results;
}

/** Delete all images belonging to a conversation (garbage collection). */
export async function deleteImagesByConversation(
  conversationId: string,
): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("conversationId");
  const req = index.openCursor(IDBKeyRange.only(conversationId));

  return new Promise((resolve, reject) => {
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
