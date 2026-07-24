// ============================================================
// КОНСТАНТЫ ПРИЛОЖЕНИЯ
// ============================================================

var APP_VERSION = '5.0.0';
var APP_STAGE = 'Beta';

var DB_NAME = 'BeltaneeDB_v5';
var DB_VERSION = 1;
var STORES = ['sales', 'stock', 'settings'];

var currentCardArticle = null;
var cardChart = null;

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
        updateDBStats();
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
// TOAST УВЕДОМЛЕНИЯ
// ============================================================

function showToast(message, type) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast ' + (type || 'success') + ' show';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function() {
        toast.classList.remove('show');
    }, 3000);
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

function updateDBStats() {
    var statsEl = document.getElementById('dbStats');
    if (!statsEl) return;

    Promise.all([
        dbGetAll('sales'),
        dbGetAll('stock'),
        dbGetAll('settings')
    ]).then(function(results) {
        statsEl.textContent = 'Продаж: ' + results[0].length + ' записей, Остатков: ' + results[1].length + ' записей, Настроек: ' + results[2].length;
    }).catch(function() {
        statsEl.textContent = '';
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
            showToast('✅ Настройки успешно сохранены', 'success');
        }).catch(function(error) {
            showToast('❌ Ошибка: ' + error.message, 'error');
        });
    }).catch(function(error) {
        showToast('❌ Ошибка: ' + error.message, 'error');
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
        showToast('❌ Ошибка: ' + error.message, 'error');
    });
}

function clearAllData() {
    if (!confirm('Удалить все данные? Это действие необратимо.')) return;

    Promise.all([
        dbClear('sales'),
        dbClear('stock')
    ]).then(function() {
        updateDashboard();
        updateProductList();
        showToast('✅ Данные очищены', 'success');
    }).catch(function(error) {
        showToast('❌ Ошибка: ' + error.message, 'error');
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
    var articleSet = {};
    sales.forEach(function(s) {
        if (!articleSet[s.article]) {
            articleSet[s.article] = true;
            articles.push(s.article);
        }
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
// СТРАНИЦА ТОВАРОВ (ГРУППИРОВКА)
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
        renderGroupedProducts(products);
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
    var seen = {};
    sales.forEach(function(s) {
        if (!seen[s.article]) {
            seen[s.article] = true;
            var productInfo = getProductInfo(s.article);
            var totalStock = getTotalStock(s.article, stock);
            var sales30 = sales30Map[s.article] || 0;
            var io = calculateIO(totalStock, sales30);
            var ioInfo = getIOStatus(io);
            var margin = productInfo ? calculateMargin(productInfo.price, productInfo.cost) : 0;
            var daysLeft = calculateDaysLeft(totalStock, sales30);
            var baseArticle = productInfo ? productInfo.baseArticle : s.article.split('_').slice(0, -2).join('_');

            products.push({
                article: s.article,
                baseArticle: baseArticle,
                price: productInfo ? productInfo.price : 0,
                cost: productInfo ? productInfo.cost : 0,
                category: productInfo ? productInfo.category : 'Товар',
                margin: margin,
                stock: totalStock,
                io: io,
                ioStatus: ioInfo.status,
                ioColor: ioInfo.color,
                ioLevel: ioInfo.level,
                sales30: sales30,
                daysLeft: daysLeft
            });
        }
    });

    return products;
}

function renderGroupedProducts(products) {
    var container = document.getElementById('productsGroupedList');
    var searchQuery = document.getElementById('productSearch').value.toLowerCase();
    var filter = document.getElementById('productFilter').value;

    // Группируем по базовому артикулу
    var groups = {};
    products.forEach(function(p) {
        var base = p.baseArticle || p.article;
        if (!groups[base]) {
            groups[base] = {
                baseArticle: base,
                category: p.category,
                items: [],
                totalStock: 0,
                totalSales30: 0
            };
        }
        groups[base].items.push(p);
        groups[base].totalStock += p.stock;
        groups[base].totalSales30 += p.sales30;
    });

    // Фильтрация групп
    var groupKeys = Object.keys(groups);
    var filteredGroups = groupKeys.filter(function(key) {
        var group = groups[key];
        if (searchQuery) {
            var found = group.items.some(function(p) {
                return p.article.toLowerCase().indexOf(searchQuery) !== -1;
            });
            if (!found) return false;
        }

        if (filter === 'profitable') {
            return group.items.some(function(p) { return p.margin > 20; });
        }
        if (filter === 'unprofitable') {
            return group.items.some(function(p) { return p.margin < 0; });
        }
        if (filter === 'deficit') {
            return group.items.some(function(p) { return p.io < 0.2; });
        }
        if (filter === 'lowMargin') {
            return group.items.some(function(p) { return p.margin > 0 && p.margin <= 20; });
        }
        return true;
    });

    if (filteredGroups.length === 0) {
        container.innerHTML = '<div class="card" style="text-align: center; padding: 20px; color: var(--text-secondary);">Ничего не найдено</div>';
        return;
    }

    var categoryIcons = {
        'Костюмы': '👔', 'Платья': '👗', 'Жакеты': '🧥',
        'Брюки': '👖', 'Свитеры': '🧶', 'Товар': '📦'
    };

    var html = '';
    filteredGroups.forEach(function(key) {
        var group = groups[key];
        var icon = categoryIcons[group.category] || '📦';
        var avgMargin = 0;
        var margins = group.items.map(function(p) { return p.margin; });
        var sum = margins.reduce(function(a, b) { return a + b; }, 0);
        avgMargin = parseFloat((sum / margins.length).toFixed(1));

        var totalIO = calculateIO(group.totalStock, group.totalSales30);
        var ioInfo = getIOStatus(totalIO);
        var hasProblem = group.items.some(function(p) {
            return p.ioLevel === 'critical' || p.stock < 5 || p.margin < 0;
        });

        var marginColor = avgMargin > 20 ? '#10B981' : avgMargin > 0 ? '#F59E0B' : '#EF4444';
        var stockColor = group.totalStock < 10 ? '#EF4444' : '#10B981';

        html += '<div class="product-group">';
        html += '<div class="product-group-header" onclick="toggleGroup(this)">';
        html += '<span class="product-group-icon">' + icon + '</span>';
        html += '<div class="product-group-info">';
        html += '<div class="product-group-name">' + group.baseArticle + (hasProblem ? ' ⚠️' : '') + '</div>';
        html += '<div class="product-group-category">' + group.category + ' · ' + group.items.length + ' вар.</div>';
        html += '</div>';
        html += '<div class="product-group-metrics">';
        html += '<div class="product-group-metric"><div class="product-group-metric-label">Маржа</div><div class="product-group-metric-value" style="color: ' + marginColor + ';">' + avgMargin + '%</div></div>';
        html += '<div class="product-group-metric"><div class="product-group-metric-label">Остаток</div><div class="product-group-metric-value" style="color: ' + stockColor + ';">' + group.totalStock + '</div></div>';
        html += '<div class="product-group-metric"><div class="product-group-metric-label">ИО</div><div class="product-group-metric-value" style="color: ' + ioInfo.color + ';">' + totalIO.toFixed(2) + '</div></div>';
        html += '</div>';
        html += '<span class="product-group-arrow">▶</span>';
        html += '</div>';

        html += '<div class="product-group-items">';
        group.items.forEach(function(p) {
            var mColor = p.margin > 20 ? '#10B981' : p.margin > 0 ? '#F59E0B' : '#EF4444';
            var sColor = p.stock < 5 ? '#EF4444' : p.stock < 20 ? '#F59E0B' : '#10B981';
            var statusIcon = p.ioLevel === 'critical' || p.stock < 5 ? '🔴' : p.margin < 0 ? '🟡' : '';
            html += '<div class="product-group-item" onclick="openProductCard(\'' + p.article + '\')">';
            html += '<span class="product-group-item-name">' + p.article + '</span>';
            html += '<span class="product-group-item-price">' + (p.price > 0 ? p.price.toLocaleString('ru-RU') + ' ₽' : '—') + '</span>';
            html += '<span class="product-group-item-margin" style="color: ' + mColor + ';">' + p.margin + '%</span>';
            html += '<span class="product-group-item-stock" style="color: ' + sColor + ';">' + p.stock + ' шт</span>';
            html += '<span class="product-group-item-io" style="color: ' + p.ioColor + ';">' + p.io.toFixed(2) + '</span>';
            html += '<span class="product-group-item-status">' + statusIcon + '</span>';
            html += '</div>';
        });
        html += '</div>';
        html += '</div>';
    });

    container.innerHTML = html;
}

function toggleGroup(header) {
    var arrow = header.querySelector('.product-group-arrow');
    var items = header.nextElementSibling;
    if (items.classList.contains('open')) {
        items.classList.remove('open');
        arrow.classList.remove('open');
    } else {
        items.classList.add('open');
        arrow.classList.add('open');
    }
}

// ============================================================
// КАРТОЧКА ТОВАРА
// ============================================================

function openProductCard(article) {
    currentCardArticle = article;

    document.querySelectorAll('.page').forEach(function(p) {
        p.classList.remove('active');
    });
    document.getElementById('page-product-card').classList.add('active');

    Promise.all([
        dbGetAll('sales'),
        dbGetAll('stock'),
        loadAppSettings()
    ]).then(function(results) {
        var sales = results[0];
        var stock = results[1];

        var productInfo = getProductInfo(article);
        if (!productInfo) return;

        var articleSales = sales.filter(function(s) {
            return s.article === article;
        });

        var articleStock = stock.filter(function(s) {
            return s.article === article;
        });

        var totalStock = getTotalStock(article, articleStock);
        var sales30 = getSales30(article, sales);
        var io = calculateIO(totalStock, sales30);
        var ioInfo = getIOStatus(io);
        var margin = calculateMargin(productInfo.price, productInfo.cost);
        var daysLeft = calculateDaysLeft(totalStock, sales30);

        var categoryIcons = {
            'Костюмы': '👔', 'Платья': '👗', 'Жакеты': '🧥',
            'Брюки': '👖', 'Свитеры': '🧶', 'Товар': '📦'
        };
        document.getElementById('cardCategoryIcon').textContent = categoryIcons[productInfo.category] || '📦';
        document.getElementById('cardTitle').textContent = article;
        document.getElementById('cardSubtitle').textContent = productInfo.category + ' · FBO';

        var statusText = '🟢 Стабильно';
        var statusBg = 'rgba(16, 185, 129, 0.15)';
        var statusColor = '#10B981';
        if (ioInfo.level === 'critical' || totalStock < 5) {
            statusText = '🔴 Проблема';
            statusBg = 'rgba(239, 68, 68, 0.15)';
            statusColor = '#EF4444';
        } else if (ioInfo.level === 'warning' || margin < 0) {
            statusText = '🟡 Внимание';
            statusBg = 'rgba(245, 158, 11, 0.15)';
            statusColor = '#F59E0B';
        }
        var badge = document.getElementById('cardStatusBadge');
        badge.textContent = statusText;
        badge.style.background = statusBg;
        badge.style.color = statusColor;

        document.getElementById('cardKpiPrice').textContent = productInfo.price.toLocaleString('ru-RU') + ' ₽';
        document.getElementById('cardKpiPriceSub').textContent = '';

        var marginEl = document.getElementById('cardKpiMargin');
        marginEl.textContent = margin + '%';
        marginEl.style.color = margin > 20 ? '#10B981' : margin > 0 ? '#F59E0B' : '#EF4444';
        document.getElementById('cardKpiMarginSub').textContent = '';

        var stockEl = document.getElementById('cardKpiStock');
        stockEl.textContent = totalStock + ' шт';
        stockEl.style.color = totalStock < 5 ? '#EF4444' : totalStock < 20 ? '#F59E0B' : '#10B981';
        document.getElementById('cardKpiStockSub').textContent = 'на ' + daysLeft + ' дн';

        var ioEl = document.getElementById('cardKpiIO');
        ioEl.textContent = io.toFixed(2);
        ioEl.style.color = ioInfo.color;
        document.getElementById('cardKpiIOSub').textContent = ioInfo.status;

        renderCardChart(articleSales, 7);
        renderCardSalesTab(articleSales);
        renderCardStockTab(articleStock, totalStock, daysLeft, sales30);
        renderCardEconomicsTab(productInfo, totalStock, sales30);
    });
}

function closeProductCard() {
    currentCardArticle = null;
    if (cardChart) {
        cardChart.destroy();
        cardChart = null;
    }
    navigateTo('products');
}

function renderCardChart(sales, days) {
    var canvas = document.getElementById('cardSalesChart');
    if (!canvas) return;

    if (cardChart) {
        cardChart.destroy();
        cardChart = null;
    }

    var today = new Date();
    var labels = [];
    var ordersData = [];
    var deliveredData = [];

    for (var i = days - 1; i >= 0; i--) {
        var d = new Date(today);
        d.setDate(d.getDate() - i);
        var dateStr = String(d.getDate()).padStart(2, '0') + '.' +
                      String(d.getMonth() + 1).padStart(2, '0') + '.' +
                      d.getFullYear();
        labels.push(dateStr);

        var dayOrders = 0;
        var dayDelivered = 0;
        sales.forEach(function(s) {
            if (s.date === dateStr) {
                dayOrders += s.orders || 0;
                dayDelivered += s.delivered || 0;
            }
        });
        ordersData.push(dayOrders);
        deliveredData.push(dayDelivered);
    }

    var ctx = canvas.getContext('2d');
    cardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Заказы',
                    data: ordersData,
                    borderColor: '#A78BFA',
                    backgroundColor: 'rgba(167, 139, 250, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    pointBackgroundColor: '#A78BFA'
                },
                {
                    label: 'Выкупы',
                    data: deliveredData,
                    borderColor: '#10B981',
                    borderWidth: 2,
                    borderDash: [4, 3],
                    fill: false,
                    tension: 0.3,
                    pointRadius: 2,
                    pointBackgroundColor: '#10B981'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#9CA3AF',
                        usePointStyle: true,
                        padding: 15,
                        font: { size: 11 }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#9CA3AF', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#9CA3AF', font: { size: 9 }, maxTicksLimit: 10 }
                }
            }
        }
    });
}

function renderCardSalesTab(sales) {
    var sorted = sales.slice().sort(function(a, b) {
        return b.date.localeCompare(a.date);
    });

    var tbody = document.getElementById('cardSalesHistory');
    if (sorted.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #9CA3AF;">Нет данных</td></tr>';
    } else {
        var html = '';
        sorted.slice(0, 30).forEach(function(s) {
            var conversion = s.orders > 0 ? Math.round((s.delivered / s.orders) * 100) : 0;
            html += '<tr>';
            html += '<td>' + s.date + '</td>';
            html += '<td>' + s.orders + '</td>';
            html += '<td>' + s.delivered + '</td>';
            html += '<td>' + (s.returns || 0) + '</td>';
            html += '<td>' + conversion + '%</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    }

    var today = new Date();
    var weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    var twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    var thisWeek = 0;
    var prevWeek = 0;
    sales.forEach(function(s) {
        var parts = s.date.split('.');
        var saleDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (saleDate >= weekAgo) {
            thisWeek += s.orders || 0;
        } else if (saleDate >= twoWeeksAgo && saleDate < weekAgo) {
            prevWeek += s.orders || 0;
        }
    });

    var compareEl = document.getElementById('cardSalesCompare');
    if (prevWeek > 0) {
        var change = Math.round(((thisWeek - prevWeek) / prevWeek) * 100);
        var arrow = change > 0 ? '▲' : '▼';
        var color = change > 0 ? '#10B981' : '#EF4444';
        compareEl.innerHTML = 'Эта неделя: <strong>' + thisWeek + '</strong> заказов ' +
            '<span style="color: ' + color + ';">' + arrow + ' ' + Math.abs(change) + '%</span> к прошлой';
    } else {
        compareEl.textContent = 'Эта неделя: ' + thisWeek + ' заказов';
    }
}

function renderCardStockTab(stock, totalStock, daysLeft, sales30) {
    var tbody = document.getElementById('cardStockTable');
    if (stock.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #9CA3AF;">Нет данных</td></tr>';
    } else {
        var html = '';
        stock.forEach(function(s) {
            var statusText = s.available < 5 ? '🔴 Мало' : s.available < 20 ? '🟡 Норма' : '🟢 Достаточно';
            html += '<tr>';
            html += '<td>' + (s.warehouse || '—') + '</td>';
            html += '<td style="font-weight: 600;">' + (s.available || 0) + '</td>';
            html += '<td>' + (s.inTransit || 0) + '</td>';
            html += '<td>' + (s.returns || 0) + '</td>';
            html += '<td>' + statusText + '</td>';
            html += '</tr>';
        });
        tbody.innerHTML = html;
    }

    var forecastEl = document.getElementById('cardStockForecast');
    var dailySales = sales30 / 30;
    if (totalStock === 0) {
        forecastEl.innerHTML = '<span style="color: #EF4444;">❌ Товар отсутствует на складе</span>';
    } else if (daysLeft <= 3) {
        forecastEl.innerHTML = '<span style="color: #EF4444;">⚠️ Остатка хватит на <strong>' + daysLeft + ' дн</strong> (продажи ~' + dailySales.toFixed(1) + ' шт/день). Срочно запланируйте поставку.</span>';
    } else if (daysLeft <= 7) {
        forecastEl.innerHTML = '<span style="color: #F59E0B;">🟡 Остатка хватит на <strong>' + daysLeft + ' дн</strong> (продажи ~' + dailySales.toFixed(1) + ' шт/день). Рекомендуется поставка.</span>';
    } else {
        forecastEl.innerHTML = '<span style="color: #10B981;">✅ Остатка хватит на <strong>' + daysLeft + ' дн</strong> (продажи ~' + dailySales.toFixed(1) + ' шт/день).</span>';
    }
}

function renderCardEconomicsTab(productInfo, totalStock, sales30) {
    var price = productInfo.price;
    var cost = productInfo.cost;
    var commission = Math.round(price * appSettings.fboCommission / 100);
    var logistics = 150;
    var storageCost = Math.round(appSettings.storageBaseRate * appSettings.volumePerUnit * 30);
    var returnsLoss = Math.round(price * 0.05);
    var profit = price - commission - logistics - storageCost - cost - returnsLoss;
    var tax = Math.round(price * 0.06);
    var netProfit = profit - tax;
    var totalMargin = parseFloat(((netProfit / price) * 100).toFixed(1));

    var breakdownEl = document.getElementById('cardEconomicsBreakdown');
    var maxExpense = Math.max(commission, logistics, storageCost, cost, returnsLoss, tax);
    var bars = [
        { label: 'Комиссия WB (' + appSettings.fboCommission + '%)', value: commission, cls: 'commission' },
        { label: 'Логистика', value: logistics, cls: 'logistics' },
        { label: 'Хранение (мес)', value: storageCost, cls: 'storage' },
        { label: 'Себестоимость', value: cost, cls: 'cost' },
        { label: 'Возвраты (~5%)', value: returnsLoss, cls: 'returns' },
        { label: 'Налог (УСН 6%)', value: tax, cls: 'tax' }
    ];

    var html = '<div style="font-size: 16px; font-weight: 600; color: #F0F0FF; margin-bottom: 12px;">Цена продажи: ' + price.toLocaleString('ru-RU') + ' ₽</div>';
    html += '<div style="border-top: 1px solid #2A2A42; margin-bottom: 8px;"></div>';

    bars.forEach(function(bar) {
        var width = maxExpense > 0 ? Math.round((bar.value / maxExpense) * 100) : 0;
        html += '<div class="econ-bar">';
        html += '<span class="econ-bar-label">' + bar.label + '</span>';
        html += '<div class="econ-bar-track"><div class="econ-bar-fill ' + bar.cls + '" style="width: ' + width + '%;"></div></div>';
        html += '<span class="econ-bar-value" style="color: #EF4444;">−' + bar.value.toLocaleString('ru-RU') + ' ₽</span>';
        html += '</div>';
    });

    html += '<div style="border-top: 1px solid #2A2A42; margin: 8px 0;"></div>';
    html += '<div class="econ-bar">';
    html += '<span class="econ-bar-label" style="font-weight: 600;">Прибыль с единицы</span>';
    html += '<div class="econ-bar-track"></div>';
    html += '<span class="econ-bar-value" style="color: #10B981; font-size: 14px;">' + profit.toLocaleString('ru-RU') + ' ₽</span>';
    html += '</div>';
    html += '<div class="econ-bar">';
    html += '<span class="econ-bar-label" style="font-weight: 600;">ЧИСТАЯ ПРИБЫЛЬ</span>';
    html += '<div class="econ-bar-track"></div>';
    html += '<span class="econ-bar-value" style="color: #10B981; font-size: 16px; font-weight: 600;">' + netProfit.toLocaleString('ru-RU') + ' ₽</span>';
    html += '</div>';
    html += '<div style="font-size: 13px; color: #9CA3AF; margin-top: 4px;">Маржинальность: <span style="color: ' + (totalMargin > 20 ? '#10B981' : '#F59E0B') + '; font-weight: 600;">' + totalMargin + '%</span></div>';
    breakdownEl.innerHTML = html;

    var monthlyRevenue = sales30 * price;
    var monthlyCosts = sales30 * (commission + logistics + storageCost + cost + returnsLoss + tax);
    var monthlyProfit = monthlyRevenue - monthlyCosts;
    document.getElementById('cardEconomicsTotal').innerHTML =
        '<div style="font-size: 12px; color: #9CA3AF;">📊 Итого за 30 дней</div>' +
        '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 6px;">' +
        '<div><span style="color: #9CA3AF; font-size: 10px;">Продано</span><div style="font-weight: 600; color: #F0F0FF;">' + sales30 + ' шт</div></div>' +
        '<div><span style="color: #9CA3AF; font-size: 10px;">Выручка</span><div style="font-weight: 600; color: #F0F0FF;">' + monthlyRevenue.toLocaleString('ru-RU') + ' ₽</div></div>' +
        '<div><span style="color: #9CA3AF; font-size: 10px;">Чистая прибыль</span><div style="font-weight: 600; color: #10B981;">' + monthlyProfit.toLocaleString('ru-RU') + ' ₽</div></div>' +
        '</div>';
}

// ============================================================
// ИМПОРТ ДАННЫХ
// ============================================================

function downloadTemplate(type) {
    var headers, example, fileName;

    if (type === 'sales') {
        headers = ['Артикул продавца', 'Дата', 'Заказано', 'Выкуплено', 'Сумма заказов', 'Возвраты'];
        example = ['21_К_Вельвет_голубой_40', '23.07.2026', '5', '4', '16000', '0'];
        fileName = 'BELTANEE_Шаблон_Продажи.xlsx';
    } else if (type === 'stock') {
        headers = ['Артикул продавца', 'Размер', 'Склад', 'Всего на складе', 'В пути', 'Возвраты'];
        example = ['21_К_Вельвет_голубой_40', '40', 'Коледино', '50', '10', '2'];
        fileName = 'BELTANEE_Шаблон_Остатки.xlsx';
    } else {
        return;
    }

    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([headers, example]);
    var colWidths = headers.map(function() { return { wch: 20 }; });
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
    XLSX.writeFile(wb, fileName);
}

function setupImportDropZone(dropZoneId, fileInputId, type) {
    var dropZone = document.getElementById(dropZoneId);
    var fileInput = document.getElementById(fileInputId);
    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('click', function() {
        fileInput.click();
    });

    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', function() {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            processImportFile(e.dataTransfer.files[0], type);
        }
    });

    fileInput.addEventListener('change', function() {
        if (fileInput.files.length > 0) {
            processImportFile(fileInput.files[0], type);
            fileInput.value = '';
        }
    });
}

function processImportFile(file, type) {
    var statusEl = document.getElementById(type === 'sales' ? 'salesImportStatus' : 'stockImportStatus');
    if (statusEl) {
        statusEl.innerHTML = '<span style="color: #F59E0B;">⏳ Обработка файла...</span>';
    }

    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var workbook = XLSX.read(e.target.result, { type: 'array' });
            var sheetName = workbook.SheetNames[0];
            var sheet = workbook.Sheets[sheetName];
            var data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

            if (data.length === 0) {
                if (statusEl) statusEl.innerHTML = '<span style="color: #EF4444;">❌ Файл пуст</span>';
                return;
            }

            var mapped = [];
            var errors = [];

            if (type === 'sales') {
                mapped = mapSalesData(data, errors);
            } else if (type === 'stock') {
                mapped = mapStockData(data, errors);
            }

            if (mapped.length === 0) {
                if (statusEl) statusEl.innerHTML = '<span style="color: #EF4444;">❌ Нет данных для импорта. Ошибок: ' + errors.length + '</span>';
                return;
            }

            var storeName = type === 'sales' ? 'sales' : 'stock';
            dbClear(storeName).then(function() {
                var promises = mapped.map(function(item) {
                    return dbSave(storeName, item);
                });
                return Promise.all(promises);
            }).then(function() {
                var message = '✅ Импортировано ' + mapped.length + ' записей';
                if (errors.length > 0) {
                    message += ' (пропущено строк с ошибками: ' + errors.length + ')';
                }
                if (statusEl) statusEl.innerHTML = '<span style="color: #10B981;">' + message + '</span>';
                showToast(message, errors.length > 0 ? 'error' : 'success');
                updateDashboard();
                updateProductList();
            }).catch(function(error) {
                if (statusEl) statusEl.innerHTML = '<span style="color: #EF4444;">❌ Ошибка: ' + error.message + '</span>';
                showToast('❌ Ошибка импорта: ' + error.message, 'error');
            });

        } catch (error) {
            if (statusEl) statusEl.innerHTML = '<span style="color: #EF4444;">❌ Ошибка чтения файла: ' + error.message + '</span>';
            showToast('❌ Ошибка чтения файла', 'error');
        }
    };

    reader.onerror = function() {
        if (statusEl) statusEl.innerHTML = '<span style="color: #EF4444;">❌ Ошибка чтения файла</span>';
    };

    reader.readAsArrayBuffer(file);
}

function mapSalesData(data, errors) {
    var keys = Object.keys(data[0]);
    var getKey = function(patterns) {
        return keys.find(function(k) {
            return patterns.some(function(p) { return k.toLowerCase().indexOf(p) !== -1; });
        });
    };

    var kArticle = getKey(['артикул', 'article']) || keys[0];
    var kDate = getKey(['дата', 'date', 'день']) || keys[1];
    var kOrders = getKey(['заказано', 'заказ', 'orders', 'ordered']) || keys[2];
    var kDelivered = getKey(['выкуплено', 'выкуп', 'delivered']) || keys[3];
    var kAmount = getKey(['сумма', 'amount', 'итого']) || keys[4];
    var kReturns = getKey(['возврат', 'returns', 'return']) || keys[5];

    var mapped = [];
    data.forEach(function(row, index) {
        var article = String(row[kArticle] || '').trim();
        if (!article) {
            errors.push({ row: index + 1, error: 'Пустой артикул' });
            return;
        }

        var dateStr = String(row[kDate] || '').trim();
        if (!dateStr) {
            dateStr = getYesterdayStr();
        }

        var orders = parseInt(row[kOrders]) || 0;
        var delivered = parseInt(row[kDelivered]) || 0;
        var amount = parseFloat(String(row[kAmount] || '0').replace(',', '.').replace(/\s/g, '')) || 0;
        var returns = parseInt(row[kReturns]) || 0;

        mapped.push({
            id: Date.now() + Math.random(),
            article: article,
            date: dateStr,
            orders: orders,
            delivered: delivered,
            returns: returns,
            amount: amount
        });
    });

    return mapped;
}

function mapStockData(data, errors) {
    var keys = Object.keys(data[0]);
    var getKey = function(patterns) {
        return keys.find(function(k) {
            return patterns.some(function(p) { return k.toLowerCase().indexOf(p) !== -1; });
        });
    };

    var kArticle = getKey(['артикул', 'article']) || keys[0];
    var kSize = getKey(['размер', 'size']) || keys[1];
    var kWarehouse = getKey(['склад', 'warehouse']) || keys[2];
    var kAvailable = getKey(['всего', 'available', 'остаток']) || keys[3];
    var kInTransit = getKey(['пути', 'transit']) || keys[4];
    var kReturns = getKey(['возврат', 'returns']) || keys[5];

    var mapped = [];
    data.forEach(function(row, index) {
        var article = String(row[kArticle] || '').trim();
        if (!article) {
            errors.push({ row: index + 1, error: 'Пустой артикул' });
            return;
        }

        var size = String(row[kSize] || '').trim();
        var warehouse = String(row[kWarehouse] || 'Склад').trim();
        var available = parseInt(row[kAvailable]) || 0;
        var inTransit = parseInt(row[kInTransit]) || 0;
        var returns = parseInt(row[kReturns]) || 0;

        mapped.push({
            id: Date.now() + Math.random(),
            article: article,
            size: size,
            warehouse: warehouse,
            available: available,
            inTransit: inTransit,
            returns: returns
        });
    });

    return mapped;
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
    if (!result) {
        result = {
            article: article,
            baseArticle: article.split('_').slice(0, -2).join('_'),
            category: 'Товар',
            price: 0,
            cost: 0
        };
    }
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

function getSales30(article, salesData) {
    var total = 0;
    salesData.forEach(function(s) {
        if (s.article === article) {
            total += s.orders || 0;
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

    // Тестовые данные
    document.getElementById('loadTestDataBtn').addEventListener('click', loadTestData);
    document.getElementById('clearTestDataBtn').addEventListener('click', clearAllData);

    // Обновление главной
    document.getElementById('refreshDashboardBtn').addEventListener('click', updateDashboard);

    // Настройки
    loadSettings();
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('taxSystem').addEventListener('change', togglePatentField);

    // Товары: поиск и фильтры
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

    // Карточка товара
    document.getElementById('backToProductsBtn').addEventListener('click', closeProductCard);

    document.querySelectorAll('.card-chart-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.card-chart-btn').forEach(function(b) {
                b.classList.remove('active');
            });
            this.classList.add('active');
            var days = parseInt(this.getAttribute('data-card-period'));
            if (currentCardArticle) {
                dbGetAll('sales').then(function(sales) {
                    var articleSales = sales.filter(function(s) {
                        return s.article === currentCardArticle;
                    });
                    renderCardChart(articleSales, days);
                });
            }
        });
    });

    document.querySelectorAll('.card-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.card-tab').forEach(function(t) {
                t.classList.remove('active');
            });
            this.classList.add('active');

            var tabName = this.getAttribute('data-card-tab');
            document.querySelectorAll('.card-tab-content').forEach(function(c) {
                c.style.display = 'none';
            });
            var content = document.getElementById('cardTab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
            if (content) {
                content.style.display = 'block';
            }
        });
    });

    // Импорт
    document.getElementById('downloadSalesTemplateBtn').addEventListener('click', function() {
        downloadTemplate('sales');
    });
    document.getElementById('downloadStockTemplateBtn').addEventListener('click', function() {
        downloadTemplate('stock');
    });

    setupImportDropZone('salesDropZone', 'salesFileInput', 'sales');
    setupImportDropZone('stockDropZone', 'stockFileInput', 'stock');

    // Обновляем главную при старте
    updateDashboard();
});

function refreshProductTable() {
    Promise.all([dbGetAll('sales'), dbGetAll('stock')]).then(function(results) {
        var products = buildProductList(results[0], results[1]);
        renderGroupedProducts(products);
    });
}
