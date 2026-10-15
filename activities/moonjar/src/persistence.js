export class ConflictError extends Error { constructor() { super('다른 탭에서 저장한 내용이 있어요. 지금 내용을 새 작업으로 보관하거나 다른 탭의 내용을 확인해 주세요.'); this.name = 'ConflictError'; } }
export function openRepository(indexedDB = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!indexedDB) { reject(new Error('브라우저 저장소를 사용할 수 없어요.')); return; }
    let abandoned = false;
    const req = indexedDB.open('dailycoaching-moonjar-v1', 1);
    req.onupgradeneeded = () => { for (const name of ['projects', 'thumbnails', 'meta']) req.result.createObjectStore(name); };
    req.onerror = () => reject(req.error);
    req.onblocked = () => { abandoned = true; reject(new Error('다른 탭이 저장소 갱신을 막고 있어요.')); };
    req.onsuccess = () => {
      const db = req.result;
      if(abandoned){db.close();return;}
      db.onversionchange = () => db.close();
      resolve({
        get(id) { return read(db, 'get', id); },
        list() { return read(db, 'getAll'); },
        save(doc, expected) {
          const snapshot = structuredClone(doc);
          return new Promise((res, rej) => {
            const tx = db.transaction('projects', 'readwrite'), store = tx.objectStore('projects');
            let conflict = false;
            tx.oncomplete = () => res(snapshot.revision);
            tx.onerror = () => rej(tx.error || new Error('저장하지 못했어요.'));
            tx.onabort = () => rej(conflict ? new ConflictError() : tx.error || new Error('저장하지 못했어요.'));
            const get = store.get(snapshot.projectId);
            get.onsuccess = () => {
              const current = get.result;
              if ((current?.revision ?? null) !== expected) { conflict = true; tx.abort(); return; }
              store.put(snapshot, snapshot.projectId);
            };
          });
        },
        delete(id, expected) {
          return new Promise((res, rej) => {
            const tx = db.transaction(['projects', 'thumbnails', 'meta'], 'readwrite');
            let conflict = false;
            tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(conflict ? new ConflictError() : tx.error);
            const store = tx.objectStore('projects'), get = store.get(id);
            get.onsuccess = () => {
              if ((get.result?.revision ?? null) !== expected) { conflict = true; tx.abort(); return; }
              for (const name of ['projects', 'thumbnails', 'meta']) tx.objectStore(name).delete(id);
            };
          });
        },
        close() { db.close(); }
      });
    };
  });
}
function read(db, method, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('projects', 'readonly'), req = tx.objectStore('projects')[method](...(id === undefined ? [] : [id]));
    tx.oncomplete = () => resolve(req.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}

// One serial writer. Only a completed repository transaction may announce success.
export class SaveQueue {
  constructor(repository, expected, onStatus = () => {}, delay = 500) {
    this.repository = repository; this.expected = expected; this.onStatus = onStatus; this.delay = delay;
    this.pending = null; this.running = null; this.timer = null; this.failed = false; this.stopped = false;
  }
  schedule(doc) {
    if (this.stopped || this.failed) return;
    this.pending = structuredClone(doc); this.onStatus('dirty'); clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delay);
  }
  async flush() {
    clearTimeout(this.timer);
    if (this.running) { await this.running; if (this.pending && !this.failed) return this.flush(); return; }
    if (!this.pending || this.failed || this.stopped) return;
    const doc = this.pending; this.pending = null; this.onStatus('saving');
    this.running = (async () => {
      try {
        this.expected = await this.repository.save(doc, this.expected);
        this.onStatus(this.pending ? 'dirty' : 'saved');
      } catch (error) { this.failed = true; this.onStatus(error instanceof ConflictError ? 'conflict' : 'error', error); }
    })();
    await this.running; this.running = null;
    if (this.pending && !this.failed) return this.flush();
  }
  retry(doc) { this.failed = false; this.schedule(doc); return this.flush(); }
  async stop() { await this.flush(); this.stopped = true; clearTimeout(this.timer); this.pending = null; }
}
