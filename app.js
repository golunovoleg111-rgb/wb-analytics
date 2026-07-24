// ============================================================
// НАВИГАЦИЯ
// ============================================================

function navigateTo(pageName) {
    document.querySelectorAll('.menu-item').forEach(function(item) {
        item.classList.remove('active');
    });

    var menuItem = document.querySelector('.menu-item[data-page="' + pageName + '"]');
    if (menuItem) {
        menuItem.classList.add('active');
    }

    document.querySelectorAll('.page').forEach(function(page) {
        page.classList.remove('active');
    });

    var page = document.getElementById('page-' + pageName);
    if (page) {
        page.classList.add('active');
    }

    // При переходе в Настройки — загружаем сохранённые значения
    if (pageName === 'settings') {
        loadSettings();
    }
}

// ============================================================
// БАЗА ДАННЫХ (IndexedDB)
// ============================================================

var DB_NAME = 'BeltaneeDB';
var DB_VERSION = 1;
var STORES = ['sales', 'stock', 'settings'];

function openDB() {
    return new Promise(function(resolve, reject) {
        var request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function(event) {
            var db = event.target.result;
            STORES.forEach(function(storeName) {
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                }
            });
        };

        request.onsuccess = function(event) {
            resolve(event.target.result);
        };

        request.onerror = function(event) {
            reject(event.target.error);
        };
    });
}

function dbSave(storeName, data) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction(storeName, 'readwrite');
            var store = transaction.objectStore(storeName);
            var request = store.put(data);

            request.onsuccess = function() {
                resolve(request.result);
            };

            request.onerror = function() {
                reject(request.error);
            };

            transaction.oncomplete = function() {
                db.close();
            };
        });
    });
}

function dbGetAll(storeName) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction(storeName, 'readonly');
            var store = transaction.objectStore(storeName);
            var request = store.getAll();

            request.onsuccess = function() {
                resolve(request.result);
            };

            request.onerror = function() {
                reject(request.error);
            };

            transaction.oncomplete = function() {
                db.close();
            };
        });
    });
}

function dbClear(storeName) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction(storeName, 'readwrite');
            var store = transaction.objectStore(storeName);
            var request = store.clear();

            request.onsuccess = function() {
                resolve();
            };

            request.onerror = function() {
                reject(request.error);
            };

            transaction.oncomplete = function() {
                db.close();
            };
        });
    });
}

// ============================================================
// ПРОВЕРКА БАЗЫ ДАННЫХ (диагностика)
// ============================================================

function checkDatabase() {
    var statusEl = document.getElementById('dbStatus');
    if (!statusEl) return;

    openDB().then(function() {
        statusEl.innerHTML = '<span style="color: #10B981;">✅ База данных работает</span>';
    }).catch(function(error) {
        statusEl.innerHTML = '<span style="color: #EF4444;">❌ Ошибка базы данных: ' + error.message + '</span>';
    });
}

// ============================================================
// НАСТРОЙКИ
// ============================================================

// Загрузка сохранённых настроек из БД и заполнение формы
function loadSettings() {
    dbGetAll('settings').then(function(data) {
        if (data.length > 0) {
            data.forEach(function(item) {
                var el = document.getElementById(item.key);
                if (el) {
                    el.value = item.value;
                }
            });
            // Показать или скрыть поле стоимости патента
            togglePatentField();
        }
    }).catch(function(error) {
        console.error('Ошибка загрузки настроек:', error);
    });
}

// Сохранение настроек в БД
function saveSettings() {
    var settings = [
        { key: 'fboCommission', value: parseFloat(document.getElementById('fboCommission').value) || 15 },
        { key: 'fbsCommission', value: parseFloat(document.getElementById('fbsCommission').value) || 10 },
        { key: 'storageBaseRate', value: parseFloat(document.getElementById('storageBaseRate').value) || 0.07 },
        { key: 'storageOverRate', value: parseFloat(document.getElementById('storageOverRate').value) || 0.15 },
        { key: 'volumePerUnit', value: parseFloat(document.getElementById('volumePerUnit').value) || 5 },
        { key: 'taxSystem', value: document.getElementById('taxSystem').value || 'usn6' },
        { key: 'patentCost', value: parseFloat(document.getElementById('patentCost').value) || 30000 }
    ];

    // Очищаем старые настройки
    dbClear('settings').then(function() {
        // Сохраняем новые
        var promises = settings.map(function(s) {
            return dbSave('settings', s);
        });

        Promise.all(promises).then(function() {
            document.getElementById('saveStatus').innerHTML = '<span style="color: #10B981;">✅ Настройки сохранены</span>';
            setTimeout(function() {
                document.getElementById('saveStatus').innerHTML = '';
            }, 3000);
        }).catch(function(error) {
            document.getElementById('saveStatus').innerHTML = '<span style="color: #EF4444;">❌ Ошибка: ' + error.message + '</span>';
        });
    });
}

// Показать или скрыть поле стоимости патента
function togglePatentField() {
    var taxSystem = document.getElementById('taxSystem').value;
    var patentBlock = document.getElementById('patentBlock');
    if (patentBlock) {
        patentBlock.style.display = (taxSystem === 'patent') ? 'block' : 'none';
    }
}

// ============================================================
// ЗАПУСК ПРИЛОЖЕНИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    // Навигация
    document.querySelectorAll('.menu-item').forEach(function(item) {
        item.addEventListener('click', function() {
            var page = this.getAttribute('data-page');
            navigateTo(page);
        });
    });

    document.getElementById('sidebarLogo').addEventListener('click', function() {
        navigateTo('dashboard');
    });

    // Проверка базы данных
    checkDatabase();

    // Загрузка настроек при старте (если активна страница Настроек)
    loadSettings();

    // Кнопка сохранения настроек
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);

    // Переключение системы налогообложения — показ/скрытие поля патента
    document.getElementById('taxSystem').addEventListener('change', togglePatentField);
});
