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

    if (pageName === 'settings') {
        loadSettings();
    }

    if (pageName === 'dashboard') {
        updateDashboard();
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
// ПРОВЕРКА БАЗЫ ДАННЫХ
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

function loadSettings() {
    dbGetAll('settings').then(function(data) {
        if (data.length > 0) {
            data.forEach(function(item) {
                var el = document.getElementById(item.key);
                if (el) {
                    el.value = item.value;
                }
            });
            togglePatentField();
        }
    }).catch(function(error) {
        console.error('Ошибка загрузки настроек:', error);
    });
}

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

    dbClear('settings').then(function() {
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

function togglePatentField() {
    var taxSystem = document.getElementById('taxSystem').value;
    var patentBlock = document.getElementById('patentBlock');
    if (patentBlock) {
        patentBlock.style.display = (taxSystem === 'patent') ? 'block' : 'none';
    }
}

// ============================================================
// ТЕСТОВЫЕ ДАННЫЕ
// ============================================================

// Товары для тестовых данных
var TEST_PRODUCTS = [
    { article: '21_К_Вельвет_голубой_40', baseArticle: '21_К_Вельвет', category: 'Костюмы', price: 3200, cost: 960 },
    { article: '27_К_Платье_чёрный_44', baseArticle: '27_К_Платье', category: 'Платья', price: 2100, cost: 2300 },
    { article: '33_К_Жакет_синий_48', baseArticle: '33_К_Жакет', category: 'Жакеты', price: 4500, cost: 3200 },
    { article: '41_К_Брюки_серый_42', baseArticle: '41_К_Брюки', category: 'Брюки', price: 3800, cost: 2100 },
    { article: '15_К_Свитер_бежевый_46', baseArticle: '15_К_Свитер', category: 'Свитеры', price: 2800, cost: 1200 }
];

// Генерация случайных продаж за последние 30 дней
function generateTestSales() {
    var sales = [];
    var today = new Date();

    TEST_PRODUCTS.forEach(function(product) {
        // Каждый товар продаётся с разной интенсивностью
        var baseSales = Math.floor(Math.random() * 5) + 1; // 1-5 заказов в день в среднем

        for (var i = 29; i >= 0; i--) {
            var date = new Date(today);
            date.setDate(date.getDate() - i);
            var dateStr = String(date.getDate()).padStart(2, '0') + '.' +
                          String(date.getMonth() + 1).padStart(2, '0') + '.' +
                          date.getFullYear();

            // Случайное количество заказов вокруг базового
            var orders = Math.max(0, baseSales + Math.floor(Math.random() * 3) - 1);
            if (orders === 0) continue; // пропускаем дни без продаж

            var delivered = Math.floor(orders * (0.7 + Math.random() * 0.25)); // 70-95% выкуп
            var returns = orders - delivered;
            var amount = orders * product.price;

            sales.push({
                id: Date.now() + Math.random(),
                article: product.article,
                date: dateStr,
                orders: orders,
                delivered: delivered,
                returns: returns,
                amount: amount
            });
        }
    });

    return sales;
}

// Генерация тестовых остатков
function generateTestStock() {
    var stock = [];

    TEST_PRODUCTS.forEach(function(product) {
        // Разные остатки для демонстрации проблем
        var quantities = [3, 45, 120, 67, 8]; // по порядку товаров
        var index = TEST_PRODUCTS.indexOf(product);

        stock.push({
            id: Date.now() + Math.random(),
            article: product.article,
            size: product.article.split('_').pop(),
            warehouse: 'Коледино',
            available: quantities[index],
            inTransit: Math.floor(Math.random() * 20),
            returns: Math.floor(Math.random() * 3)
        });
    });

    return stock;
}

// Загрузка тестовых данных
function loadTestData() {
    var sales = generateTestSales();
    var stock = generateTestStock();

    // Очищаем старые данные
    Promise.all([
        dbClear('sales'),
        dbClear('stock')
    ]).then(function() {
        // Сохраняем продажи
        var salesPromises = sales.map(function(s) {
            return dbSave('sales', s);
        });

        return Promise.all(salesPromises).then(function() {
            // Сохраняем остатки
            var stockPromises = stock.map(function(s) {
                return dbSave('stock', s);
            });
            return Promise.all(stockPromises);
        });
    }).then(function() {
        updateDashboard();
    }).catch(function(error) {
        alert('Ошибка загрузки тестовых данных: ' + error.message);
    });
}

// ============================================================
// РАСЧЁТНЫЕ ФУНКЦИИ
// ============================================================

// Индекс остатка (ИО)
// Формула: ИО = остаток / продажи за 30 дней
function calculateIO(stock, sales30days) {
    if (sales30days === 0) {
        return stock > 0 ? 999 : 0;
    }
    return parseFloat((stock / sales30days).toFixed(4));
}

// Статус ИО
function getIOStatus(io) {
    if (io < 0.2) return { status: 'Дефицит', color: '#EF4444', level: 'critical' };
    if (io < 0.5) return { status: 'Недостаток', color: '#F59E0B', level: 'warning' };
    if (io < 1.0) return { status: 'Норма', color: '#10B981', level: 'normal' };
    if (io < 2.0) return { status: 'Избыток', color: '#3B82F6', level: 'excess' };
    return { status: 'Сильный избыток', color: '#8B5CF6', level: 'excess' };
}

// Прогноз дней до обнуления остатка
function calculateDaysLeft(stock, sales30days) {
    var dailySales = sales30days / 30;
    if (dailySales === 0) return 999;
    return Math.round(stock / dailySales);
}

// Расчёт маржинальности (упрощённый, без логистики и хранения)
// Полная версия будет в карточке товара
function calculateMargin(price, cost) {
    if (price === 0) return 0;
    return parseFloat(((price - cost) / price * 100).toFixed(2));
}

// Получение настроек из БД (синхронно не получится, поэтому загружаем заранее)
var appSettings = {
    fboCommission: 15,
    fbsCommission: 10,
    storageBaseRate: 0.07,
    storageOverRate: 0.15,
    volumePerUnit: 5,
    taxSystem: 'usn6',
    patentCost: 30000
};

function loadAppSettings() {
    return dbGetAll('settings').then(function(data) {
        data.forEach(function(item) {
            if (appSettings.hasOwnProperty(item.key)) {
                appSettings[item.key] = item.value;
            }
        });
    });
}

// ============================================================
// ГЛАВНАЯ СТРАНИЦА
// ============================================================

function updateDashboard() {
    // Загружаем настройки, затем данные
    loadAppSettings().then(function() {
        return Promise.all([
            dbGetAll('sales'),
            dbGetAll('stock')
        ]);
    }).then(function(results) {
        var sales = results[0];
        var stock = results[1];

        // Если данных нет — показываем заглушку
        if (sales.length === 0 && stock.length === 0) {
            document.getElementById('dashboardEmpty').style.display = 'block';
            document.getElementById('dashboardContent').style.display = 'none';
            return;
        }

        // Данные есть — показываем сводку
        document.getElementById('dashboardEmpty').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';

        // Собираем статистику
        var stats = collectStats(sales, stock);
        renderKPIs(stats);
        renderAttentionBlock(stats);
    }).catch(function(error) {
        console.error('Ошибка обновления главной:', error);
    });
}

// Сбор статистики по продажам и остаткам
function collectStats(sales, stock) {
    var yesterday = getYesterdayStr();

    // Продажи за вчера
    var yesterdayOrders = 0;
    var yesterdayDelivered = 0;
    var yesterdayAmount = 0;

    // Продажи за 30 дней по товарам
    var sales30Map = {};

    sales.forEach(function(s) {
        if (s.date === yesterday) {
            yesterdayOrders += s.orders || 0;
            yesterdayDelivered += s.delivered || 0;
            yesterdayAmount += s.amount || 0;
        }

        if (!sales30Map[s.article]) {
            sales30Map[s.article] = 0;
        }
        sales30Map[s.article] += s.orders || 0;
    });

    // Уникальные товары
    var articles = [];
    TEST_PRODUCTS.forEach(function(p) {
        articles.push(p.article);
    });

    // Расчёт ИО и маржи для каждого товара
    var products = [];
    articles.forEach(function(article) {
        var productInfo = null;
        TEST_PRODUCTS.forEach(function(p) {
            if (p.article === article) {
                productInfo = p;
            }
        });

        var totalStock = 0;
        stock.forEach(function(s) {
            if (s.article === article) {
                totalStock += s.available || 0;
            }
        });

        var sales30 = sales30Map[article] || 0;
        var io = calculateIO(totalStock, sales30);
        var ioInfo = getIOStatus(io);
        var margin = productInfo ? calculateMargin(productInfo.price, productInfo.cost) : 0;
        var daysLeft = calculateDaysLeft(totalStock, sales30);

        products.push({
            article: article,
            stock: totalStock,
            sales30: sales30,
            io: io,
            ioStatus: ioInfo.status,
            ioColor: ioInfo.color,
            ioLevel: ioInfo.level,
            margin: margin,
            daysLeft: daysLeft,
            price: productInfo ? productInfo.price : 0,
            cost: productInfo ? productInfo.cost : 0
        });
    });

    return {
        yesterdayOrders: yesterdayOrders,
        yesterdayDelivered: yesterdayDelivered,
        yesterdayAmount: yesterdayAmount,
        productsCount: articles.length,
        products: products
    };
}

// Отображение KPI-карточек
function renderKPIs(stats) {
    document.getElementById('kpiProducts').textContent = stats.productsCount;

    document.getElementById('kpiOrders').textContent = stats.yesterdayOrders;
    document.getElementById('kpiDelivered').textContent = stats.yesterdayDelivered;

    var avgMargin = 0;
    if (stats.products.length > 0) {
        var sum = 0;
        stats.products.forEach(function(p) { sum += p.margin; });
        avgMargin = parseFloat((sum / stats.products.length).toFixed(1));
    }
    document.getElementById('kpiAvgMargin').textContent = avgMargin + '%';
}

// Отображение блока "Внимание"
function renderAttentionBlock(stats) {
    var container = document.getElementById('attentionBlock');

    // Ищем проблемы
    var problems = [];

    stats.products.forEach(function(p) {
        if (p.stock < 5) {
            problems.push({
                type: 'critical',
                icon: '🔴',
                text: p.article + ' — остаток ' + p.stock + ' шт (на ' + p.daysLeft + ' дней)',
                action: 'Пополнить'
            });
        } else if (p.ioLevel === 'critical' && p.stock > 0) {
            problems.push({
                type: 'critical',
                icon: '🔴',
                text: p.article + ' — ИО ' + (p.io * 100).toFixed(1) + '% (риск блокировки)',
                action: 'Снизить цену'
            });
        } else if (p.margin < 0) {
            problems.push({
                type: 'warning',
                icon: '🟡',
                text: p.article + ' — убыточный (маржа ' + p.margin + '%)',
                action: 'Пересмотреть цену'
            });
        } else if (p.ioLevel === 'warning') {
            problems.push({
                type: 'warning',
                icon: '🟡',
                text: p.article + ' — ИО ' + (p.io * 100).toFixed(1) + '% (недостаток)',
                action: 'Планировать поставку'
            });
        }
    });

    if (problems.length === 0) {
        container.innerHTML = '<div style="color: #10B981; font-size: 13px;">✅ Все показатели в норме</div>';
        return;
    }

    var html = '';
    problems.forEach(function(p) {
        var bgColor = p.type === 'critical' ? '#FEF2F2' : '#FFFBEB';
        var borderColor = p.type === 'critical' ? '#EF4444' : '#F59E0B';
        html += '<div style="padding: 8px 12px; background: ' + bgColor + '; border-left: 3px solid ' + borderColor + '; margin-bottom: 6px; border-radius: 6px; font-size: 13px;">';
        html += '<span style="margin-right: 6px;">' + p.icon + '</span>';
        html += p.text;
        html += '</div>';
    });
    container.innerHTML = html;
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getYesterdayStr() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return String(d.getDate()).padStart(2, '0') + '.' +
           String(d.getMonth() + 1).padStart(2, '0') + '.' +
           d.getFullYear();
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

    // Кнопка загрузки тестовых данных
    document.getElementById('loadTestDataBtn').addEventListener('click', loadTestData);

    // Настройки
    loadSettings();
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('taxSystem').addEventListener('change', togglePatentField);

    // Обновляем главную при старте
    updateDashboard();
});
