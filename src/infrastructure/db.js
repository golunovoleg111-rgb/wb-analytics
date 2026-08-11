// ============================================================
// BELTANEE v6.1 — IndexedDB
// Один чистый слой хранения. Все ключи данных детерминированные,
// поэтому повторный импорт не создаёт дубликаты.
// ============================================================

const DB_NAME = 'BeltaneeDB_v6_1';
const DB_VERSION = 1;

const STORES = {
    PRODUCTS: 'products',
    SALES: 'sales',
    STOCK: 'stock',
    STOCK_HISTORY: 'stockHistory',
    SUPPLY: 'supply',
    WAREHOUSE: 'warehouse',
    ADVERTISING: 'advertising',
    FINANCE: 'finance',
    SETTINGS: 'settings',
    IMPORTS: 'imports',
    PRICES: 'prices',
    PROFILE: 'profile'
};

function createStore(db, name) {
    if (db.objectStoreNames.contains(name)) return db.transaction;
    return db.createObjectStore(name, { keyPath: 'id' });
}

function ensureIndex(store, name, keyPath, options = {}) {
    if (!store.indexNames.contains(name)) {
        store.createIndex(name, keyPath, options);
    }
}

function configureIndexes(db, transaction) {
    const configure = (name, fn) => {
        if (!db.objectStoreNames.contains(name)) return;
        fn(transaction.objectStore(name));
    };

    configure(STORES.PRODUCTS, store => {
        ensureIndex(store, 'article', 'article');
        ensureIndex(store, 'articleKey', 'articleKey', { unique: true });
        ensureIndex(store, 'baseModel', 'baseModel');
        ensureIndex(store, 'status', 'status');
    });

    configure(STORES.SALES, store => {
        ensureIndex(store, 'productId', 'productId');
        ensureIndex(store, 'article', 'article');
        ensureIndex(store, 'date', 'date');
    });

    configure(STORES.STOCK, store => {
        ensureIndex(store, 'productId', 'productId');
        ensureIndex(store, 'articleKey', 'articleKey');
        ensureIndex(store, 'warehouseName', 'warehouseName');
        ensureIndex(store, 'date', 'date');
    });

    configure(STORES.STOCK_HISTORY, store => {
        ensureIndex(store, 'productId', 'productId');
        ensureIndex(store, 'warehouseName', 'warehouseName');
        ensureIndex(store, 'date', 'date');
    });

    configure(STORES.SUPPLY, store => {
        ensureIndex(store, 'productId', 'productId');
        ensureIndex(store, 'status', 'status');
    });

    configure(STORES.ADVERTISING, store => {
        ensureIndex(store, 'campaignId', 'campaignId', { unique: true });
        ensureIndex(store, 'productId', 'productId');
        ensureIndex(store, 'date', 'date');
    });

    configure(STORES.IMPORTS, store => {
        ensureIndex(store, 'type', 'type');
        ensureIndex(store, 'createdAt', 'createdAt');
    });
}

function openDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            reject(new Error('Браузер не поддерживает IndexedDB'));
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = event => {
            const db = event.target.result;
            Object.values(STORES).forEach(name => createStore(db, name));
            configureIndexes(db, event.target.transaction);
        };

        request.onsuccess = event => {
            const db = event.target.result;
            db.onversionchange = () => db.close();
            resolve(db);
        };

        request.onerror = event => reject(event.target.error || new Error('Не удалось открыть базу данных'));
        request.onblocked = () => reject(new Error('База данных занята другой вкладкой. Закройте другие вкладки BELTANEE.'));
    });
}

function withTransaction(storeName, mode, callback) {
    return openDB().then(db => new Promise((resolve, reject) => {
        let result;
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);

        try {
            result = callback(store, tx);
        } catch (error) {
            reject(error);
            db.close();
            return;
        }

        tx.oncomplete = () => {
            db.close();
            resolve(result);
        };
        tx.onerror = () => {
            const error = tx.error || new Error('Ошибка транзакции IndexedDB');
            db.close();
            reject(error);
        };
        tx.onabort = () => {
            const error = tx.error || new Error('Транзакция IndexedDB отменена');
            db.close();
            reject(error);
        };
    }));
}

function save(storeName, data) {
    return withTransaction(storeName, 'readwrite', store => store.put(data));
}

function saveMany(storeName, records) {
    const items = Array.isArray(records) ? records : [];
    return withTransaction(storeName, 'readwrite', store => {
        items.forEach(record => store.put(record));
        return items.length;
    });
}

function replaceAll(storeName, records) {
    const items = Array.isArray(records) ? records : [];
    return withTransaction(storeName, 'readwrite', store => {
        store.clear();
        items.forEach(record => store.put(record));
        return items.length;
    });
}

function getAll(storeName) {
    return withTransaction(storeName, 'readonly', store => {
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    });
}

function getById(storeName, id) {
    return withTransaction(storeName, 'readonly', store => {
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    });
}

function getByIndex(storeName, indexName, value) {
    return withTransaction(storeName, 'readonly', store => {
        return new Promise((resolve, reject) => {
            let index;
            try {
                index = store.index(indexName);
            } catch (error) {
                reject(new Error(`Индекс ${indexName} отсутствует в ${storeName}`));
                return;
            }
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    });
}

function deleteById(storeName, id) {
    return withTransaction(storeName, 'readwrite', store => store.delete(id));
}

function clear(storeName) {
    return withTransaction(storeName, 'readwrite', store => store.clear());
}

function count(storeName) {
    return withTransaction(storeName, 'readonly', store => {
        return new Promise((resolve, reject) => {
            const request = store.count();
            request.onsuccess = () => resolve(request.result || 0);
            request.onerror = () => reject(request.error);
        });
    });
}

export const Database = {
    DB_NAME,
    DB_VERSION,
    STORES,
    openDB,
    save,
    saveMany,
    replaceAll,
    getAll,
    getById,
    getByIndex,
    delete: deleteById,
    clear,
    count
};

export default Database;
