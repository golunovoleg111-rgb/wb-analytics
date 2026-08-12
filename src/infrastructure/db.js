// ============================================================
// BELTANEE — IndexedDB / production data layer
// Один connection на сессию, короткие транзакции, bulk I/O.
// ============================================================

const DB_NAME = 'BeltaneeDB_v6_1';
const DB_VERSION = 6;
const BULK_CHUNK_SIZE = 1000;

const STORES = {
    PRODUCTS: 'products', SALES: 'sales', STOCK: 'stock', STOCK_HISTORY: 'stockHistory',
    SUPPLY: 'supply', WAREHOUSE: 'warehouse', ADVERTISING: 'advertising', FINANCE: 'finance',
    SETTINGS: 'settings', IMPORTS: 'imports', PRICES: 'prices', PROFILE: 'profile'
};

let connection = null;
let opening = null;

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
        ensureIndex(store, 'article', 'article');
        ensureIndex(store, 'articleKey', 'articleKey');
        ensureIndex(store, 'baseModel', 'baseModel');
        ensureIndex(store, 'productGroupKey', 'productGroupKey');
        ensureIndex(store, 'status', 'status');
    });
    configure(STORES.SALES, store => {
        ensureIndex(store, 'productId', 'productId');
        ensureIndex(store, 'articleKey', 'articleKey');
        ensureIndex(store, 'productGroupKey', 'productGroupKey');
        ensureIndex(store, 'article', 'article');
        ensureIndex(store, 'date', 'date');
        ensureIndex(store, 'importBatchId', 'importBatchId');
    });
    configure(STORES.STOCK, store => {
        ensureIndex(store, 'productId', 'productId');
        ensureIndex(store, 'articleKey', 'articleKey');
        ensureIndex(store, 'productGroupKey', 'productGroupKey');
        ensureIndex(store, 'warehouseName', 'warehouseName');
        ensureIndex(store, 'date', 'date');
        ensureIndex(store, 'source', 'source');
        ensureIndex(store, 'importBatchId', 'importBatchId');
    });
    configure(STORES.STOCK_HISTORY, store => {
        ensureIndex(store, 'productId', 'productId');
        ensureIndex(store, 'articleKey', 'articleKey');
        ensureIndex(store, 'productGroupKey', 'productGroupKey');
        ensureIndex(store, 'warehouseName', 'warehouseName');
        ensureIndex(store, 'date', 'date');
        ensureIndex(store, 'importBatchId', 'importBatchId');
    });
    configure(STORES.SUPPLY, store => { ensureIndex(store, 'productId', 'productId'); ensureIndex(store, 'status', 'status'); });
    configure(STORES.ADVERTISING, store => { ensureIndex(store, 'campaignId', 'campaignId'); ensureIndex(store, 'productId', 'productId'); ensureIndex(store, 'date', 'date'); });
    configure(STORES.FINANCE, store => { ensureIndex(store, 'date', 'date'); ensureIndex(store, 'articleKey', 'articleKey'); });
    configure(STORES.IMPORTS, store => { ensureIndex(store, 'type', 'type'); ensureIndex(store, 'createdAt', 'createdAt'); });
    configure(STORES.PRICES, store => { ensureIndex(store, 'articleKey', 'articleKey'); ensureIndex(store, 'date', 'date'); });
}

function createConnection() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) return reject(new Error('Браузер не поддерживает IndexedDB'));
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = event => {
            const db = event.target.result;
            const transaction = event.target.transaction;
            Object.values(STORES).forEach(name => createStore(db, name));
            configureIndexes(db, transaction);
        };
        request.onsuccess = event => {
            const db = event.target.result;
            connection = db;
            db.onversionchange = () => { db.close(); if (connection === db) connection = null; };
            db.onclose = () => { if (connection === db) connection = null; };
            resolve(db);
        };
        request.onerror = event => reject(event.target.error || new Error('Не удалось открыть базу данных'));
        request.onblocked = () => reject(new Error('База данных занята другой вкладкой. Закройте другие вкладки BELTANEE.'));
    });
}

async function openDB() {
    if (connection) return connection;
    if (!opening) {
        opening = createConnection().finally(() => { opening = null; });
    }
    return opening;
}

function withTransaction(storeNames, mode, callback) {
    return openDB().then(db => new Promise((resolve, reject) => {
        let result;
        let tx;
        try {
            tx = db.transaction(storeNames, mode);
            const stores = Array.isArray(storeNames)
                ? Object.fromEntries(storeNames.map(name => [name, tx.objectStore(name)]))
                : tx.objectStore(storeNames);
            result = callback(stores, tx);
        } catch (error) {
            reject(error);
            return;
        }
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || new Error('Ошибка транзакции IndexedDB'));
        tx.onabort = () => reject(tx.error || new Error('Транзакция IndexedDB отменена'));
    }));
}

function yieldToBrowser() {
    return new Promise(resolve => {
        if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: 50 });
        else setTimeout(resolve, 0);
    });
}

function save(storeName, data) {
    return withTransaction(storeName, 'readwrite', store => store.put(data));
}

async function bulkWrite(storeName, records, options = {}, clearFirst = false) {
    const items = Array.isArray(records) ? records : [];
    const chunkSize = Math.max(100, Number(options.chunkSize) || BULK_CHUNK_SIZE);
    const db = await openDB();
    let saved = 0;

    if (clearFirst) {
        await withTransaction(storeName, 'readwrite', store => store.clear());
    }

    for (let offset = 0; offset < items.length; offset += chunkSize) {
        const chunk = items.slice(offset, offset + chunkSize);
        await withTransaction(storeName, 'readwrite', store => {
            for (const record of chunk) store.put(record);
        });
        saved += chunk.length;
        if (typeof options.onProgress === 'function') options.onProgress(saved, items.length);
        if (offset + chunk.length < items.length) await yieldToBrowser();
    }
    return saved;
}

function saveMany(storeName, records, options = {}) { return bulkWrite(storeName, records, options, false); }
function replaceAll(storeName, records, options = {}) { return bulkWrite(storeName, records, options, true); }

function getAll(storeName) {
    return withTransaction(storeName, 'readonly', store => new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    }));
}

function getById(storeName, id) {
    return withTransaction(storeName, 'readonly', store => new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    }));
}

function getByIndex(storeName, indexName, value) {
    return withTransaction(storeName, 'readonly', store => new Promise((resolve, reject) => {
        let index;
        try { index = store.index(indexName); }
        catch { reject(new Error(`Индекс ${indexName} отсутствует в ${storeName}`)); return; }
        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    }));
}

function deleteById(storeName, id) { return withTransaction(storeName, 'readwrite', store => store.delete(id)); }
function clear(storeName) { return withTransaction(storeName, 'readwrite', store => store.clear()); }
function count(storeName) { return withTransaction(storeName, 'readonly', store => new Promise((resolve, reject) => { const request = store.count(); request.onsuccess = () => resolve(request.result || 0); request.onerror = () => reject(request.error); })); }

async function countMany(storeNames) {
    return withTransaction(storeNames, 'readonly', stores => Promise.all(storeNames.map(name => new Promise((resolve, reject) => { const request = stores[name].count(); request.onsuccess = () => resolve([name, request.result || 0]); request.onerror = () => reject(request.error); })))).then(entries => Object.fromEntries(entries));
}

export const Database = { DB_NAME, DB_VERSION, BULK_CHUNK_SIZE, STORES, openDB, save, saveMany, replaceAll, getAll, getById, getByIndex, delete: deleteById, clear, count, countMany };
export default Database;
