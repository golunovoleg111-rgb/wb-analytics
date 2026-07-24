// ============================================================
// КОНСТАНТЫ ПРИЛОЖЕНИЯ
// ============================================================

var APP_VERSION = '5.0.0';
var APP_STAGE = 'Alpha';

var DB_NAME = 'BeltaneeDB_v5';
var DB_VERSION = 1;
var STORES = ['sales', 'stock', 'settings'];

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

    if (pageName === 'products') {
        updateProductList();
    }
}

// ============================================================
// БАЗА ДАННЫХ (IndexedDB)
// ============================================================

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

        request.onblocked = function() {
            reject(new Error(
                'База данных заблокирована. ' +
                'Закройте другие вкладки BELTANEE и обновите страницу.'
            ));
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

    statusEl.innerHTML = 'Проверка базы данных...';

    openDB().then(function(db) {
        db.close();
        statusEl.innerHTML = '<span style="color: #10B981;">✅ База данных готова (v.' + DB_VERSION + ')</span>';
    }).catch(function(error) {
        statusEl.innerHTML = '<span style="color: #EF4444;">❌ Ошибка подключения: ' + error.message + '</span>';
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
            document.getElementById('saveStatus').innerHTML =
                '<span style="color: #10B981;">✅ Настройки успешно сохранены</span>';
            setTimeout(function() {
                document.getElementById('saveStatus').innerHTML = '';
            }, 3000);
        }).catch(function(error) {
            document.getElementById('saveStatus').innerHTML =
                '<span style="color: #EF4444;">❌ Ошибка: ' + error.message + '</span>';
        });
    }).catch(function(error) {
        document.getElementById('saveStatus').innerHTML =
            '<span style="color: #EF4444;">❌ Ошибка: ' + error.message + '</span>';
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

var TEST_PRODUCTS = [
    { article: '21_К_Вельвет_голубой_40', baseArticle: '21_К_Вельвет', category: 'Костюмы', price: 3200, cost: 960 },
    { article: '27_К_Платье_чёрный_44', baseArticle: '27_К_Платье', category: 'Платья', price: 2100, cost: 2300 },
    { article: '33_К_Жакет_синий_48', baseArticle: '33_К_Жакет', category: 'Жакеты', price: 4500, cost: 3200 },
    { article: '41_К_Брюки_серый_42', baseArticle: '41_К_Брюки', category: 'Брюки', price: 3800, cost: 2100 },
    { article: '15_К_Свитер_бежевый_46', baseArticle: '15_К_Свитер', category: 'Свитеры', price: 2800, cost: 1200 }
];

function generateTestSales() {
    var sales = [];
    var today = new Date();

    TEST_PRODUCTS.forEach(function(product) {
        var baseSales = Math.floor(Math.random() * 5) + 1;

        for (var i = 29; i >= 0; i--) {
            var date = new Date(today);
            date.setDate(date.getDate() - i);
            var dateStr = String(date.getDate()).padStart(2, '0') + '.' +
                          String(date.getMonth() + 1).padStart(2, '0') + '.' +
                          date.getFullYear();

            var orders = Math.max(0, baseSales + Math.floor(Math.random() * 3) - 1);
            if (orders === 0) continue;

            var delivered = Math.floor(orders * (0.7 + Math.random() * 0.25));
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

function generateTestStock() {
    var stock = [];
    var quantities = [3, 45, 120, 67, 8];

    TEST_PRODUCTS.forEach(function(product, index) {
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

function loadTestData() {
    var sales = generateTestSales();
    var stock = generateTestStock();

    Promise.all([
        dbClear('sales'),
        dbClear('stock')
    ]).then(function() {
        var salesPromises = sales.map(function(s) {
            return dbSave('sales', s);
        });

        return Promise.all(salesPromises).then(function() {
            var stockPromises = stock.map(function(s) {
                return dbSave('stock', s);
            });
            return Promise.all(stockPromises);
        });
    }).then(function() {
        updateDashboard();
        updateProductList();
    }).catch(function(error) {
        alert('Ошибка загрузки тестовых данных: ' + error.message);
    });
}

// ============================================================
// РАСЧЁТНЫЕ ФУНКЦИИ
// ============================================================

function calculateIO(stock, sales30days) {
    if (sales30days === 0) {
        return stock > 0 ? 999 : 0;
    }
    return parseFloat((stock / sales30days).toFixed(4));
}

function getIOStatus(io) {
    if (io < 0.2) return { status: 'Дефицит', color: '#EF4444', level: 'critical' };
    if (io < 0.5) return { status: 'Недостаток', color: '#F59E0B', level: 'warning' };
    if (io < 1.0) return { status: 'Норма', color: '#10B981', level: 'normal' };
    if (io < 2.0) return { status: 'Избыток', color: '#3B82F6', level: 'excess' };
    return { status: 'Сильный избыток', color: '#8B5CF6', level: 'excess' };
}

function calculateDaysLeft(stock, sales30days) {
    var dailySales = sales30days / 30;
    if (dailySales === 0) return 999;
    return Math.round(stock / dailySales);
}

function calculateMargin(price, cost) {
    if (price === 0) return 0;
    return parseFloat(((price - cost) / price * 100).toFixed(2));
}

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
    loadAppSettings().then(function() {
        return Promise.all([
            dbGetAll('sales'),
            dbGetAll('stock')
        ]);
    }).then(function(results) {
        var sales = results[0];
        var stock = results[1];

        if (sales.length === 0 && stock.length === 0) {
            document.getElementById('dashboardEmpty').style.display = 'block';
            document.getElementById('dashboardContent').style.display = 'none';
            return;
        }

        document.getElementById('dashboardEmpty').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';

        var stats = collectStats(sales, stock);
        renderKPIs(stats);
        renderAttentionBlock(stats);
    }).catch(function(error) {
        console.error('Ошибка обновления главной:', error);
    });
}

function collectStats(sales, stock) {
    var yesterday = getYesterdayStr();

    var yesterdayOrders = 0;
    var yesterdayDelivered = 0;
    var yesterdayAmount = 0;

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

    var articles = [];
    TEST_PRODUCTS.forEach(function(p) {
        articles.push(p.article);
    });

    var products = [];
    articles.forEach(function(article) {
        var productInfo = getProductInfo(article);
        var totalStock = getTotalStock(article, stock);
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

function renderAttentionBlock(stats) {
    var container = document.getElementById('attentionBlock');
    var problems = getProblems(stats.products);

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
// СТРАНИЦА ТОВАРОВ
// ============================================================

function updateProductList() {
    Promise.all([
        dbGetAll('sales'),
        dbGetAll('stock')
    ]).then(function(results) {
        var sales = results[0];
        var stock = results[1];

        if (sales.length === 0 && stock.length === 0) {
            document.getElementById('productsEmpty').style.display = 'block';
            document.getElementById('productsContent').style.display = 'none';
            return;
        }

        document.getElementById('productsEmpty').style.display = 'none';
        document.getElementById('productsContent').style.display = 'block';

        var products = buildProductList(sales, stock);
        renderProductTable(products);
    }).catch(function(error) {
        console.error('Ошибка загрузки товаров:', error);
    });
}

function buildProductList(sales, stock) {
    var sales30Map = {};
    sales.forEach(function(s) {
        if (!sales30Map[s.article]) {
            sales30Map[s.article] = 0;
        }
        sales30Map[s.article] += s.orders || 0;
    });

    var products = [];
    TEST_PRODUCTS.forEach(function(p) {
        var totalStock = getTotalStock(p.article, stock);
        var sales30 = sales30Map[p.article] || 0;
        var io = calculateIO(totalStock, sales30);
        var ioInfo = getIOStatus(io);
        var margin = calculateMargin(p.price, p.cost);
        var daysLeft = calculateDaysLeft(totalStock, sales30);

        products.push({
            article: p.article,
            price: p.price,
            cost: p.cost,
            margin: margin,
            stock: totalStock,
            io: io,
            ioStatus: ioInfo.status,
            ioColor: ioInfo.color,
            ioLevel: ioInfo.level,
            sales30: sales30,
            daysLeft: daysLeft
        });
    });

    return products;
}

function renderProductTable(products) {
    var tbody = document.getElementById('productsTableBody');
    var searchQuery = document.getElementById('productSearch').value.toLowerCase();
    var filter = document.getElementById('productFilter').value;

    var filtered = products.filter(function(p) {
        if (searchQuery && p.article.toLowerCase().indexOf(searchQuery) === -1) {
            return false;
        }

        if (filter === 'profitable' && p.margin <= 20) return false;
        if (filter === 'lowMargin' && (p.margin <= 0 || p.margin > 20)) return false;
        if (filter === 'unprofitable' && p.margin >= 0) return false;
        if (filter === 'deficit' && p.io >= 0.2) return false;

        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 20px;">Ничего не найдено</td></tr>';
        return;
    }

    var html = '';
    filtered.forEach(function(p) {
        var marginColor = p.margin > 20 ? '#10B981' : p.margin > 0 ? '#F59E0B' : '#EF4444';
        var stockColor = p.stock < 5 ? '#EF4444' : p.stock < 20 ? '#F59E0B' : '#10B981';

        html += '<tr style="cursor: pointer;" onclick="alert(\'Карточка товара «' + p.article + '» будет доступна в следующей версии.\')">';
        html += '<td style="font-weight: 500;">' + p.article + '</td>';
        html += '<td>' + p.price.toLocaleString('ru-RU') + ' ₽</td>';
        html += '<td style="color: ' + marginColor + '; font-weight: 600;">' + p.margin + '%</td>';
        html += '<td style="color: ' + stockColor + '; font-weight: 600;">' + p.stock + ' шт</td>';
        html += '<td style="color: ' + p.ioColor + '; font-weight: 600;">' + (p.io * 100).toFixed(1) + '%</td>';
        html += '<td>' + p.sales30 + '</td>';
        html += '<td>' + (p.daysLeft === 999 ? '—' : p.daysLeft) + '</td>';
        html += '</tr>';
    });

    tbody.innerHTML = html;
}

// ============================================================
// ОБЩИЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getProductInfo(article) {
    var result = null;
    TEST_PRODUCTS.forEach(function(p) {
        if (p.article === article) {
            result = p;
        }
    });
    return result;
}

function getTotalStock(article, stockData) {
    var total = 0;
    stockData.forEach(function(s) {
        if (s.article === article) {
            total += s.available || 0;
        }
    });
    return total;
}

function getProblems(products) {
    var problems = [];

    products.forEach(function(p) {
        if (p.stock < 5) {
            problems.push({
                type: 'critical',
                icon: '🔴',
                text: p.article + ' — остаток ' + p.stock + ' шт (на ' + p.daysLeft + ' дней)'
            });
        } else if (p.ioLevel === 'critical' && p.stock > 0) {
            problems.push({
                type: 'critical',
                icon: '🔴',
                text: p.article + ' — ИО ' + (p.io * 100).toFixed(1) + '% (риск блокировки)'
            });
        } else if (p.margin < 0) {
            problems.push({
                type: 'warning',
                icon: '🟡',
                text: p.article + ' — убыточный (маржа ' + p.margin + '%)'
            });
        } else if (p.ioLevel === 'warning') {
            problems.push({
                type: 'warning',
                icon: '🟡',
                text: p.article + ' — ИО ' + (p.io * 100).toFixed(1) + '% (недостаток)'
            });
        }
    });

    return problems;
}

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
    // Версия в сайдбаре
    var versionEl = document.querySelector('.sidebar-version');
    if (versionEl) {
        versionEl.textContent = 'BELTANEE v' + APP_VERSION + ' (' + APP_STAGE + ')';
    }

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

    // Страница товаров: поиск и фильтры
    document.getElementById('productSearch').addEventListener('input', function() {
        refreshProductTable();
    });

    document.getElementById('productFilter').addEventListener('change', function() {
        refreshProductTable();
    });

    document.getElementById('clearFilterBtn').addEventListener('click', function() {
        document.getElementById('productSearch').value = '';
        document.getElementById('productFilter').value = 'all';
        refreshProductTable();
    });

    // Обновляем главную при старте
    updateDashboard();
});

// Вспомогательная функция для обновления таблицы товаров
function refreshProductTable() {
    Promise.all([dbGetAll('sales'), dbGetAll('stock')]).then(function(results) {
        var products = buildProductList(results[0], results[1]);
        renderProductTable(products);
    });
}
