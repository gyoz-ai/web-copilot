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
  /** Original filename for file attachments (PDF, TXT). */
  filename?: string;
  /** Attachment kind — 'image' for images, 'file' for PDF/TXT. Defaults to 'image' for backwards compat. */
  kind?: "image" | "file";
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
  images: Array<{
    id: string;
    blob: Blob;
    mimeType: string;
    filename?: string;
    kind?: "image" | "file";
  }>,
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
      filename: img.filename,
      kind: img.kind ?? "image",
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

/** Retrieve images/files by their IDs, returning data URLs for rendering. */
export async function getImages(imageIds: string[]): Promise<
  Array<{
    id: string;
    dataUrl: string;
    filename?: string;
    kind?: "image" | "file";
  }>
> {
  if (imageIds.length === 0) return [];

  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);

  const results: Array<{
    id: string;
    dataUrl: string;
    filename?: string;
    kind?: "image" | "file";
  }> = [];

  // First: read all records from IDB within the transaction
  const records = await Promise.all(
    imageIds.map(
      (id) =>
        new Promise<{ id: string; record: StoredImage | undefined }>(
          (resolve) => {
            const req = store.get(id);
            req.onsuccess = () =>
              resolve({ id, record: req.result as StoredImage | undefined });
            req.onerror = () => resolve({ id, record: undefined });
          },
        ),
    ),
  );

  // Close DB before async FileReader work — records already hold blob refs
  db.close();

  // Then: convert blobs to data URLs outside the transaction
  await Promise.all(
    records.map(
      ({ id, record }) =>
        new Promise<void>((resolve) => {
          if (!record) {
            resolve();
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            results.push({
              id,
              dataUrl: reader.result as string,
              filename: record.filename,
              kind: record.kind ?? "image",
            });
            resolve();
          };
          reader.onerror = () => resolve();
          reader.readAsDataURL(record.data);
        }),
    ),
  );

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
