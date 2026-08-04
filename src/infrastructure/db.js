// ============================================================
// INFRASTRUCTURE: IndexedDB
// Новая обёртка для работы с базой данных
// ============================================================

const DB_NAME = 'BeltaneeDB_v5';
const DB_VERSION = 6; // Увеличиваем версию для новых хранилищ

// Список всех хранилищ
const STORES = {
    PRODUCTS: 'products',
    SALES: 'sales',
    STOCK: 'stock',
    SUPPLY: 'supply',
    WAREHOUSE: 'warehouse',
    ADVERTISING: 'advertising',
    FINANCE: 'finance',
    SETTINGS: 'settings',
    IMPORTS: 'imports',
    EVENTS: 'events'
};

// ============================================================
// ОТКРЫТИЕ БАЗЫ ДАННЫХ
// ============================================================

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Создаём все хранилища, если их нет
            Object.values(STORES).forEach((storeName) => {
                if (!db.objectStoreNames.contains(storeName)) {
                    const store = db.createObjectStore(storeName, { keyPath: 'id' });
                    
                    // Создаём индексы для частых запросов
                    if (storeName === STORES.PRODUCTS) {
                        store.createIndex('article', 'article', { unique: true });
                        store.createIndex('status', 'status', { unique: false });
                    }
                    if (storeName === STORES.SALES) {
                        store.createIndex('productId', 'productId', { unique: false });
                        store.createIndex('date', 'date', { unique: false });
                    }
                    if (storeName === STORES.STOCK) {
                        store.createIndex('productId', 'productId', { unique: false });
                        store.createIndex('date', 'date', { unique: false });
                    }
                    if (storeName === STORES.SUPPLY) {
                        store.createIndex('productId', 'productId', { unique: false });
                        store.createIndex('status', 'status', { unique: false });
                    }
                    if (storeName === STORES.WAREHOUSE) {
                        store.createIndex('productId', 'productId', { unique: false });
                        store.createIndex('palletNumber', 'palletNumber', { unique: false });
                    }
                    if (storeName === STORES.ADVERTISING) {
                        store.createIndex('campaignId', 'campaignId', { unique: true });
                        store.createIndex('productId', 'productId', { unique: false });
                    }
                }
            });
        };
        
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
        request.onblocked = () => reject(new Error('База данных заблокирована'));
    });
}

// ============================================================
// БАЗОВЫЕ ОПЕРАЦИИ
// ============================================================

function dbSave(storeName, data) {
    return openDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            tx.oncomplete = () => db.close();
        });
    });
}

function dbGetAll(storeName) {
    return openDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            tx.oncomplete = () => db.close();
        });
    });
}

function dbGetByIndex(storeName, indexName, value) {
    return openDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            tx.oncomplete = () => db.close();
        });
    });
}

function dbGetById(storeName, id) {
    return openDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
            tx.oncomplete = () => db.close();
        });
    });
}

function dbDelete(storeName, id) {
    return openDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            tx.oncomplete = () => db.close();
        });
    });
}

function dbClear(storeName) {
    return openDB().then((db) => {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            tx.oncomplete = () => db.close();
        });
    });
}

// ============================================================
// ЭКСПОРТ
// ============================================================

// Старая версия для обратной совместимости
window.Database = {
    openDB,
    dbSave,
    dbGetAll,
    dbGetByIndex,
    dbGetById,
    dbDelete,
    dbClear,
    STORES
};

// Новая версия (будем использовать в новых модулях)
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
