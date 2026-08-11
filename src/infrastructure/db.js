// ============================================================
// INFRASTRUCTURE: IndexedDB
// ============================================================

const DB_NAME = 'BeltaneeDB_v5';
const DB_VERSION = 8;

const STORES = {
    PRODUCTS: 'products',
    SALES: 'sales',
    STOCK: 'stock',
    SUPPLY: 'supply',
    WAREHOUSE: 'warehouse',
    ADVERTISING: 'advertising',
    FINANCE: 'finance',
    SETTINGS: 'settings',
    IMPORTS: 'imports'
};

function ensureIndex(store, name, keyPath, options = { unique: false }) {
    if (!store.indexNames.contains(name)) {
        store.createIndex(name, keyPath, options);
    }
}

function ensureStore(db, storeName) {
    if (db.objectStoreNames.contains(storeName)) {
        return null;
    }
    return db.createObjectStore(storeName, { keyPath: 'id' });
}

function configureStoreIndexes(db, transaction) {
    const configure = (storeName, callback) => {
        if (!db.objectStoreNames.contains(storeName)) return;
        const store = transaction.objectStore(storeName);
        callback(store);
    };

    configure(STORES.PRODUCTS, store => {
        ensureIndex(store, 'article', 'article');
        ensureIndex(store, 'articleKey', 'articleKey', { unique: true });
        ensureIndex(store, 'status', 'status');
    });

    configure(STORES.SALES, store => {
        ensureIndex(store, 'productId', 'productId');
        ensureIndex(store, 'date', 'date');
    });

    configure(STORES.STOCK, store => {
        ensureIndex(store, 'productId', 'productId');
        ensureIndex(store, 'date', 'date');
    });

    configure(STORES.SUPPLY, store => {
        ensureIndex(store, 'productId', 'productId');
        ensureIndex(store, 'status', 'status');
    });

    configure(STORES.ADVERTISING, store => {
        ensureIndex(store, 'campaignId', 'campaignId', { unique: true });
        ensureIndex(store, 'productId', 'productId');
    });
}

function openDB() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            reject(new Error('Браузер не поддерживает IndexedDB'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = event => {
            const db = event.target.result;
            const transaction = event.target.transaction;

            Object.values(STORES).forEach(storeName => ensureStore(db, storeName));
            configureStoreIndexes(db, transaction);
        };

        request.onsuccess = event => resolve(event.target.result);
        request.onerror = event => reject(event.target.error || new Error('Не удалось открыть базу данных'));
        request.onblocked = () => reject(new Error('База данных заблокирована. Закройте другие вкладки BELTANEE и повторите попытку.'));
    });
}

function dbSave(storeName, data) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const request = store.put(data);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error);
    }));
}

function dbGetAll(storeName) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const request = tx.objectStore(storeName).getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    }));
}

function dbGetByIndex(storeName, indexName, value) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        let index;
        try {
            index = tx.objectStore(storeName).index(indexName);
        } catch (error) {
            reject(new Error(`Индекс ${indexName} отсутствует в ${storeName}`));
            return;
        }

        const request = index.getAll(value);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    }));
}

function dbGetById(storeName, id) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const request = tx.objectStore(storeName).get(id);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    }));
}

function dbDelete(storeName, id) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const request = tx.objectStore(storeName).delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    }));
}

function dbClear(storeName) {
    return openDB().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const request = tx.objectStore(storeName).clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
    }));
}

export const Database = {
    openDB,
    save: dbSave,
    getAll: dbGetAll,
    getByIndex: dbGetByIndex,
    getById: dbGetById,
    delete: dbDelete,
    clear: dbClear,
    STORES
};

export default Database;
