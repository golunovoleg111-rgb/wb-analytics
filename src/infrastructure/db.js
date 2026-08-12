// ============================================================
// BELTANEE — IndexedDB / canonical local storage
// ============================================================

const DB_NAME = 'BeltaneeDB_v6_1';
const DB_VERSION = 5;
const BULK_CHUNK_SIZE = 1000;

const STORES = {
    PRODUCTS: 'products', SALES: 'sales', STOCK: 'stock', STOCK_HISTORY: 'stockHistory',
    SUPPLY: 'supply', WAREHOUSE: 'warehouse', ADVERTISING: 'advertising', FINANCE: 'finance',
    SETTINGS: 'settings', IMPORTS: 'imports', PRICES: 'prices', PROFILE: 'profile'
};

function createStore(db, name) {
    if (db.objectStoreNames.contains(name)) return null;
    return db.createObjectStore(name, { keyPath: 'id' });
}
function ensureIndex(store, name, keyPath, options = {}) {
    if (!store.indexNames.contains(name)) store.createIndex(name, keyPath, options);
}
function configureIndexes(db, transaction) {
    const configure = (name, fn) => { if (db.objectStoreNames.contains(name)) fn(transaction.objectStore(name)); };
    configure(STORES.PRODUCTS, store => {
        ensureIndex(store, 'article', 'article'); ensureIndex(store, 'articleKey', 'articleKey');
        ensureIndex(store, 'baseModel', 'baseModel'); ensureIndex(store, 'productGroupKey', 'productGroupKey'); ensureIndex(store, 'status', 'status');
    });
    configure(STORES.SALES, store => {
        ensureIndex(store, 'productId', 'productId'); ensureIndex(store, 'articleKey', 'articleKey');
        ensureIndex(store, 'productGroupKey', 'productGroupKey'); ensureIndex(store, 'article', 'article');
        ensureIndex(store, 'date', 'date'); ensureIndex(store, 'importBatchId', 'importBatchId');
    });
    configure(STORES.STOCK, store => {
        ensureIndex(store, 'productId', 'productId'); ensureIndex(store, 'articleKey', 'articleKey');
        ensureIndex(store, 'productGroupKey', 'productGroupKey'); ensureIndex(store, 'warehouseName', 'warehouseName');
        ensureIndex(store, 'date', 'date'); ensureIndex(store, 'source', 'source');
    });
    configure(STORES.STOCK_HISTORY, store => {
        ensureIndex(store, 'productId', 'productId'); ensureIndex(store, 'articleKey', 'articleKey');
        ensureIndex(store, 'productGroupKey', 'productGroupKey'); ensureIndex(store, 'warehouseName', 'warehouseName'); ensureIndex(store, 'date', 'date');
    });
    configure(STORES.SUPPLY, store => { ensureIndex(store, 'productId', 'productId'); ensureIndex(store, 'status', 'status'); });
    configure(STORES.ADVERTISING, store => { ensureIndex(store, 'campaignId', 'campaignId'); ensureIndex(store, 'productId', 'productId'); ensureIndex(store, 'date', 'date'); });
    configure(STORES.IMPORTS, store => { ensureIndex(store, 'type', 'type'); ensureIndex(store, 'createdAt', 'createdAt'); });
}

function openDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('Браузер не поддерживает IndexedDB'));
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            const transaction = event.target.transaction;
            Object.values(STORES).forEach(name => createStore(db, name));
            configureIndexes(db, transaction);
            if (event.oldVersion < 5) {
                [STORES.SALES, STORES.STOCK, STORES.STOCK_HISTORY, STORES.FINANCE].forEach(name => {
                    if (db.objectStoreNames.contains(name)) transaction.objectStore(name).clear();
                });
            }
        };
        request.onsuccess = event => { const db = event.target.result; db.onversionchange = () => db.close(); resolve(db); };
        request.onerror = event => reject(event.target.error || new Error('Не удалось открыть базу данных'));
        request.onblocked = () => reject(new Error('База данных занята другой вкладкой. Закройте другие вкладки BELTANEE.'));
    });
}

function withTransaction(storeName, mode, callback) {
    return openDB().then(db => new Promise((resolve, reject) => {
        let result; let settled = false;
        const finish = (fn, value) => { if (!settled) { settled = true; db.close(); fn(value); } };
        let tx;
        try { tx = db.transaction(storeName, mode); result = callback(tx.objectStore(storeName), tx); }
        catch (error) { finish(reject, error); return; }
        tx.oncomplete = () => finish(resolve, result);
        tx.onerror = () => finish(reject, tx.error || new Error('Ошибка транзакции IndexedDB'));
        tx.onabort = () => finish(reject, tx.error || new Error('Транзакция IndexedDB отменена'));
    }));
}

function yieldToBrowser() {
    return new Promise(resolve => {
        if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 50 });
        else setTimeout(resolve, 0);
    });
}

function save(storeName, data) { return withTransaction(storeName, 'readwrite', store => store.put(data)); }

async function bulkWrite(storeName, records, options = {}, clearFirst = false) {
    const items = Array.isArray(records) ? records : [];
    const chunkSize = Math.max(100, Number(options.chunkSize) || BULK_CHUNK_SIZE);
    const db = await openDB();
    let saved = 0;
    try {
        if (clearFirst) {
            await new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                tx.objectStore(storeName).clear();
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error || new Error('Не удалось очистить IndexedDB'));
                tx.onabort = () => reject(tx.error || new Error('Очистка IndexedDB отменена'));
            });
        }
        for (let offset = 0; offset < items.length; offset += chunkSize) {
            const chunk = items.slice(offset, offset + chunkSize);
            await new Promise((resolve, reject) => {
                const tx = db.transaction(storeName, 'readwrite');
                const store = tx.objectStore(storeName);
                chunk.forEach(record => store.put(record));
                tx.oncomplete = resolve;
                tx.onerror = () => reject(tx.error || new Error('Ошибка массовой записи IndexedDB'));
                tx.onabort = () => reject(tx.error || new Error('Массовая запись IndexedDB отменена'));
            });
            saved += chunk.length;
            if (offset + chunk.length < items.length) await yieldToBrowser();
            if (typeof options.onProgress === 'function') options.onProgress(saved, items.length);
        }
        return saved;
    } finally {
        db.close();
    }
}

function saveMany(storeName, records, options = {}) { return bulkWrite(storeName, records, options, false); }
function replaceAll(storeName, records, options = {}) { return bulkWrite(storeName, records, options, true); }

function getAll(storeName) { return withTransaction(storeName, 'readonly', store => new Promise((resolve, reject) => { const request = store.getAll(); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error); })); }
function getById(storeName, id) { return withTransaction(storeName, 'readonly', store => new Promise((resolve, reject) => { const request = store.get(id); request.onsuccess = () => resolve(request.result || null); request.onerror = () => reject(request.error); })); }
function getByIndex(storeName, indexName, value) { return withTransaction(storeName, 'readonly', store => new Promise((resolve, reject) => { let index; try { index = store.index(indexName); } catch { reject(new Error(`Индекс ${indexName} отсутствует в ${storeName}`)); return; } const request = index.getAll(value); request.onsuccess = () => resolve(request.result || []); request.onerror = () => reject(request.error); })); }
function deleteById(storeName, id) { return withTransaction(storeName, 'readwrite', store => store.delete(id)); }
function clear(storeName) { return withTransaction(storeName, 'readwrite', store => store.clear()); }
function count(storeName) { return withTransaction(storeName, 'readonly', store => new Promise((resolve, reject) => { const request = store.count(); request.onsuccess = () => resolve(request.result || 0); request.onerror = () => reject(request.error); })); }

export const Database = { DB_NAME, DB_VERSION, BULK_CHUNK_SIZE, STORES, openDB, save, saveMany, replaceAll, getAll, getById, getByIndex, delete: deleteById, clear, count };
export default Database;
