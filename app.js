// ============================================================
// КОНСТАНТЫ ПРИЛОЖЕНИЯ
// ============================================================

var APP_VERSION = '5.0.0';
var APP_STAGE = 'Beta';

var DB_NAME = 'BeltaneeDB_v5';
var DB_VERSION = 3;
var STORES = ['sales', 'stock', 'settings', 'shipments', 'warehouse'];

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

    if (pageName === 'settings') { loadSettings(); updateDBStats(); }
    if (pageName === 'dashboard') { updateDashboard(); }
    if (pageName === 'products') { updateProductList(); }
    if (pageName === 'orders') { updateOrdersPage(); }
    if (pageName === 'supplies') { updateSuppliesPage(); }
    if (pageName === 'warehouse') { updateWarehousePage(); }
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

        request.onsuccess = function(event) { resolve(event.target.result); };
        request.onerror = function(event) { reject(event.target.error); };
        request.onblocked = function() {
            reject(new Error('База данных заблокирована. Закройте другие вкладки StockFlow и обновите страницу.'));
        };
    });
}

function dbSave(storeName, data) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction(storeName, 'readwrite');
            var store = transaction.objectStore(storeName);
            var request = store.put(data);
            request.onsuccess = function() { resolve(request.result); };
            request.onerror = function() { reject(request.error); };
            transaction.oncomplete = function() { db.close(); };
        });
    });
}

function dbGetAll(storeName) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction(storeName, 'readonly');
            var store = transaction.objectStore(storeName);
            var request = store.getAll();
            request.onsuccess = function() { resolve(request.result); };
            request.onerror = function() { reject(request.error); };
            transaction.oncomplete = function() { db.close(); };
        });
    });
}

function dbClear(storeName) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction(storeName, 'readwrite');
            var store = transaction.objectStore(storeName);
            var request = store.clear();
            request.onsuccess = function() { resolve(); };
            request.onerror = function() { reject(request.error); };
            transaction.oncomplete = function() { db.close(); };
        });
    });
}

function dbDelete(storeName, id) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var transaction = db.transaction(storeName, 'readwrite');
            var store = transaction.objectStore(storeName);
            var request = store.delete(id);
            request.onsuccess = function() { resolve(); };
            request.onerror = function() { reject(request.error); };
            transaction.oncomplete = function() { db.close(); };
        });
    });
}

// ============================================================
// TOAST
// ============================================================

function showToast(message, type) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast ' + (type || 'success') + ' show';
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(function() { toast.classList.remove('show'); }, 3000);
}

// ============================================================
// ПРОВЕРКА БД
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
    Promise.all([dbGetAll('sales'), dbGetAll('stock'), dbGetAll('settings')]).then(function(results) {
        statsEl.textContent = 'Продаж: ' + results[0].length + ' записей, Остатков: ' + results[1].length + ' записей, Настроек: ' + results[2].length;
    }).catch(function() { statsEl.textContent = ''; });
}

// ============================================================
// НАСТРОЙКИ
// ============================================================

function loadSettings() {
    dbGetAll('settings').then(function(data) {
        if (data.length > 0) {
            data.forEach(function(item) {
                var el = document.getElementById(item.key);
                if (el) el.value = item.value;
            });
            togglePatentField();
        }
    }).catch(function(error) { console.error('Ошибка загрузки настроек:', error); });
}

function saveSettings() {
    var settings = [
        { key: 'fboCommission', value: parseFloat(document.getElementById('fboCommission').value) || 15 },
        { key: 'fbsCommission', value: parseFloat(document.getElementById('fbsCommission').value) || 10 },
        { key: 'storageBaseRate', value: parseFloat(document.getElementById('storageBaseRate').value) || 0.07 },
        { key: 'storageOverRate', value: parseFloat(document.getElementById('storageOverRate').value) || 0.15 },
        { key: 'volumePerUnit', value: parseFloat(document.getElementById('volumePerUnit').value) || 5 },
        { key: 'taxSystem', value: document.getElementById('taxSystem').value || 'usn6' },
        { key: 'patentCost', value: parseFloat(document.getElementById('patentCost').value) || 30000 },
        { key: 'targetStockDays', value: parseInt(document.getElementById('targetStockDays').value) || 60 },
        { key: 'safetyStockDays', value: parseInt(document.getElementById('safetyStockDays').value) || 30 },
        { key: 'productionDays', value: parseInt(document.getElementById('productionDays').value) || 14 },
        { key: 'deliveryDays', value: parseInt(document.getElementById('deliveryDays').value) || 7 }
    ];
    dbClear('settings').then(function() {
        Promise.all(settings.map(function(s) { return dbSave('settings', s); })).then(function() {
            showToast('✅ Настройки успешно сохранены', 'success');
        }).catch(function(error) { showToast('❌ Ошибка: ' + error.message, 'error'); });
    }).catch(function(error) { showToast('❌ Ошибка: ' + error.message, 'error'); });
}

function togglePatentField() {
    var taxSystem = document.getElementById('taxSystem').value;
    var patentBlock = document.getElementById('patentBlock');
    if (patentBlock) patentBlock.style.display = (taxSystem === 'patent') ? 'block' : 'none';
}

// ============================================================
// ТЕСТОВЫЕ ДАННЫЕ
// ============================================================

var TEST_PRODUCTS = [
    { article: '21_К_Вельвет_голубой_40', baseArticle: '21_К_Вельвет', category: 'Костюмы', price: 3200, cost: 960, color: 'голубой', size: '40' },
    { article: '27_К_Платье_чёрный_44', baseArticle: '27_К_Платье', category: 'Платья', price: 2100, cost: 2300, color: 'чёрный', size: '44' },
    { article: '33_К_Жакет_синий_48', baseArticle: '33_К_Жакет', category: 'Жакеты', price: 4500, cost: 3200, color: 'синий', size: '48' },
    { article: '41_К_Брюки_серый_42', baseArticle: '41_К_Брюки', category: 'Брюки', price: 3800, cost: 2100, color: 'серый', size: '42' },
    { article: '15_К_Свитер_бежевый_46', baseArticle: '15_К_Свитер', category: 'Свитеры', price: 2800, cost: 1200, color: 'бежевый', size: '46' }
];

function generateTestSales() {
    var sales = [];
    var today = new Date();
    TEST_PRODUCTS.forEach(function(product) {
        var baseSales = Math.floor(Math.random() * 5) + 1;
        for (var i = 29; i >= 0; i--) {
            var date = new Date(today); date.setDate(date.getDate() - i);
            var dateStr = String(date.getDate()).padStart(2, '0') + '.' + String(date.getMonth() + 1).padStart(2, '0') + '.' + date.getFullYear();
            var orders = Math.max(0, baseSales + Math.floor(Math.random() * 3) - 1);
            if (orders === 0) continue;
            var delivered = Math.floor(orders * (0.7 + Math.random() * 0.25));
            var returns = orders - delivered;
            sales.push({ id: Date.now() + Math.random(), article: product.article, date: dateStr, orders: orders, delivered: delivered, returns: returns, amount: orders * product.price });
        }
    });
    return sales;
}

function generateTestStock() {
    var stock = [];
    var quantities = [3, 45, 120, 67, 8];
    TEST_PRODUCTS.forEach(function(product, index) {
        stock.push({ id: Date.now() + Math.random(), article: product.article, size: product.article.split('_').pop(), warehouse: 'Коледино', available: quantities[index], inTransit: Math.floor(Math.random() * 20), returns: Math.floor(Math.random() * 3) });
    });
    return stock;
}

function loadTestData() {
    var sales = generateTestSales();
    var stock = generateTestStock();
    Promise.all([dbClear('sales'), dbClear('stock')]).then(function() {
        return Promise.all(sales.map(function(s) { return dbSave('sales', s); }));
    }).then(function() {
        return Promise.all(stock.map(function(s) { return dbSave('stock', s); }));
    }).then(function() {
        updateDashboard(); updateProductList();
    }).catch(function(error) { showToast('❌ Ошибка: ' + error.message, 'error'); });
}

function clearAllData() {
    if (!confirm('Удалить все данные? Это действие необратимо.')) return;
    Promise.all([dbClear('sales'), dbClear('stock')]).then(function() {
        updateDashboard(); updateProductList();
        showToast('✅ Данные очищены', 'success');
    }).catch(function(error) { showToast('❌ Ошибка: ' + error.message, 'error'); });
}

// ============================================================
// РАСЧЁТНЫЕ ФУНКЦИИ
// ============================================================

function calculateIO(stock, sales30days) { if (sales30days === 0) return stock > 0 ? 999 : 0; return parseFloat((stock / sales30days).toFixed(4)); }

function getIOStatus(io) {
    if (io < 0.2) return { status: 'Дефицит', color: '#EF4444', level: 'critical' };
    if (io < 0.5) return { status: 'Недостаток', color: '#F59E0B', level: 'warning' };
    if (io < 1.0) return { status: 'Норма', color: '#10B981', level: 'normal' };
    if (io < 2.0) return { status: 'Избыток', color: '#3B82F6', level: 'excess' };
    return { status: 'Сильный избыток', color: '#8B5CF6', level: 'excess' };
}

function calculateDaysLeft(stock, sales30days) { var d = sales30days / 30; if (d === 0) return 999; return Math.round(stock / d); }
function calculateMargin(price, cost) { if (price === 0) return 0; return parseFloat(((price - cost) / price * 100).toFixed(2)); }

var appSettings = {
    fboCommission: 15, fbsCommission: 10, storageBaseRate: 0.07, storageOverRate: 0.15,
    volumePerUnit: 5, taxSystem: 'usn6', patentCost: 30000,
    targetStockDays: 60, safetyStockDays: 30, productionDays: 14, deliveryDays: 7
};

function loadAppSettings() {
    return dbGetAll('settings').then(function(data) {
        data.forEach(function(item) { if (appSettings.hasOwnProperty(item.key)) appSettings[item.key] = item.value; });
    });
}

// ============================================================
// ГЛАВНАЯ
// ============================================================

function updateDashboard() {
    loadAppSettings().then(function() { return Promise.all([dbGetAll('sales'), dbGetAll('stock')]); }).then(function(results) {
        var sales = results[0], stock = results[1];
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
    }).catch(function(error) { console.error('Ошибка главной:', error); });
}

function collectStats(sales, stock) {
    var yesterday = getYesterdayStr();
    var yesterdayOrders = 0, yesterdayDelivered = 0, yesterdayAmount = 0, sales30Map = {};
    sales.forEach(function(s) {
        if (s.date === yesterday) { yesterdayOrders += s.orders || 0; yesterdayDelivered += s.delivered || 0; yesterdayAmount += s.amount || 0; }
        if (!sales30Map[s.article]) sales30Map[s.article] = 0;
        sales30Map[s.article] += s.orders || 0;
    });
    var articles = [], articleSet = {};
    sales.forEach(function(s) { if (!articleSet[s.article]) { articleSet[s.article] = true; articles.push(s.article); } });
    var products = [];
    articles.forEach(function(article) {
        var info = getProductInfo(article);
        var totalStock = getTotalStock(article, stock);
        var sales30 = sales30Map[article] || 0;
        var io = calculateIO(totalStock, sales30);
        var ioInfo = getIOStatus(io);
        var margin = info ? calculateMargin(info.price, info.cost) : 0;
        var daysLeft = calculateDaysLeft(totalStock, sales30);
        products.push({ article: article, stock: totalStock, sales30: sales30, io: io, ioStatus: ioInfo.status, ioColor: ioInfo.color, ioLevel: ioInfo.level, margin: margin, daysLeft: daysLeft, price: info ? info.price : 0, cost: info ? info.cost : 0 });
    });
    return { yesterdayOrders: yesterdayOrders, yesterdayDelivered: yesterdayDelivered, yesterdayAmount: yesterdayAmount, productsCount: articles.length, products: products };
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
        var bg = p.type === 'critical' ? '#FEF2F2' : '#FFFBEB';
        var border = p.type === 'critical' ? '#EF4444' : '#F59E0B';
        html += '<div style="padding: 8px 12px; background: ' + bg + '; border-left: 3px solid ' + border + '; margin-bottom: 6px; border-radius: 6px; font-size: 13px;"><span style="margin-right: 6px;">' + p.icon + '</span>' + p.text + '</div>';
    });
    container.innerHTML = html;
}

// ============================================================
// ТОВАРЫ
// ============================================================

function updateProductList() {
    Promise.all([dbGetAll('sales'), dbGetAll('stock')]).then(function(results) {
        var sales = results[0], stock = results[1];
        if (sales.length === 0 && stock.length === 0) {
            document.getElementById('productsEmpty').style.display = 'block';
            document.getElementById('productsContent').style.display = 'none';
            return;
        }
        document.getElementById('productsEmpty').style.display = 'none';
        document.getElementById('productsContent').style.display = 'block';
        var products = buildProductList(sales, stock);
        renderGroupedProducts(products);
    }).catch(function(error) { console.error('Ошибка товаров:', error); });
}

function buildProductList(sales, stock) {
    var sales30Map = {};
    sales.forEach(function(s) { if (!sales30Map[s.article]) sales30Map[s.article] = 0; sales30Map[s.article] += s.orders || 0; });
    var products = [], seen = {};
    sales.forEach(function(s) {
        if (!seen[s.article]) {
            seen[s.article] = true;
            var info = getProductInfo(s.article);
            var totalStock = getTotalStock(s.article, stock);
            var sales30 = sales30Map[s.article] || 0;
            var io = calculateIO(totalStock, sales30);
            var ioInfo = getIOStatus(io);
            var margin = info ? calculateMargin(info.price, info.cost) : 0;
            var daysLeft = calculateDaysLeft(totalStock, sales30);
            products.push({ article: s.article, baseArticle: info ? info.baseArticle : s.article.split('_').slice(0, -2).join('_'), price: info ? info.price : 0, cost: info ? info.cost : 0, category: info ? info.category : 'Товар', margin: margin, stock: totalStock, io: io, ioStatus: ioInfo.status, ioColor: ioInfo.color, ioLevel: ioInfo.level, sales30: sales30, daysLeft: daysLeft });
        }
    });
    return products;
}

function renderGroupedProducts(products) {
    var container = document.getElementById('productsGroupedList');
    var searchQuery = document.getElementById('productSearch').value.toLowerCase();
    var filter = document.getElementById('productFilter').value;
    var groups = {};
    products.forEach(function(p) {
        var base = p.baseArticle || p.article;
        if (!groups[base]) groups[base] = { baseArticle: base, category: p.category, items: [], totalStock: 0, totalSales30: 0 };
        groups[base].items.push(p);
        groups[base].totalStock += p.stock;
        groups[base].totalSales30 += p.sales30;
    });
    var groupKeys = Object.keys(groups);
    var filteredGroups = groupKeys.filter(function(key) {
        var g = groups[key];
        if (searchQuery && !g.items.some(function(p) { return p.article.toLowerCase().indexOf(searchQuery) !== -1; })) return false;
        if (filter === 'profitable' && !g.items.some(function(p) { return p.margin > 20; })) return false;
        if (filter === 'unprofitable' && !g.items.some(function(p) { return p.margin < 0; })) return false;
        if (filter === 'deficit' && !g.items.some(function(p) { return p.io < 0.2; })) return false;
        if (filter === 'lowMargin' && !g.items.some(function(p) { return p.margin > 0 && p.margin <= 20; })) return false;
        return true;
    });
    if (filteredGroups.length === 0) { container.innerHTML = '<div class="card" style="text-align: center; padding: 20px; color: var(--text-secondary);">Ничего не найдено</div>'; return; }
    var icons = { 'Костюмы': '👔', 'Платья': '👗', 'Жакеты': '🧥', 'Брюки': '👖', 'Свитеры': '🧶', 'Товар': '📦' };
    var html = '';
    filteredGroups.forEach(function(key) {
        var g = groups[key];
        var icon = icons[g.category] || '📦';
        var margins = g.items.map(function(p) { return p.margin; });
        var avgMargin = parseFloat((margins.reduce(function(a, b) { return a + b; }, 0) / margins.length).toFixed(1));
        var totalIO = calculateIO(g.totalStock, g.totalSales30);
        var ioInfo = getIOStatus(totalIO);
        var hasProblem = g.items.some(function(p) { return p.ioLevel === 'critical' || p.stock < 5 || p.margin < 0; });
        html += '<div class="product-group"><div class="product-group-header" onclick="toggleGroup(this)"><span class="product-group-icon">' + icon + '</span><div class="product-group-info"><div class="product-group-name">' + g.baseArticle + (hasProblem ? ' ⚠️' : '') + '</div><div class="product-group-category">' + g.category + ' · ' + g.items.length + ' вар.</div></div><div class="product-group-metrics"><div class="product-group-metric"><div class="product-group-metric-label">Маржа</div><div class="product-group-metric-value" style="color:' + (avgMargin > 20 ? '#10B981' : avgMargin > 0 ? '#F59E0B' : '#EF4444') + ';">' + avgMargin + '%</div></div><div class="product-group-metric"><div class="product-group-metric-label">Остаток</div><div class="product-group-metric-value" style="color:' + (g.totalStock < 10 ? '#EF4444' : '#10B981') + ';">' + g.totalStock + '</div></div><div class="product-group-metric"><div class="product-group-metric-label">ИО</div><div class="product-group-metric-value" style="color:' + ioInfo.color + ';">' + totalIO.toFixed(2) + '</div></div></div><span class="product-group-arrow">▶</span></div><div class="product-group-items">';
        g.items.forEach(function(p) {
            var mC = p.margin > 20 ? '#10B981' : p.margin > 0 ? '#F59E0B' : '#EF4444';
            var sC = p.stock < 5 ? '#EF4444' : p.stock < 20 ? '#F59E0B' : '#10B981';
            var sIcon = p.ioLevel === 'critical' || p.stock < 5 ? '🔴' : p.margin < 0 ? '🟡' : '';
            html += '<div class="product-group-item" onclick="openProductCard(\'' + p.article + '\')"><span class="product-group-item-name">' + p.article + '</span><span class="product-group-item-price">' + (p.price > 0 ? p.price.toLocaleString('ru-RU') + ' ₽' : '—') + '</span><span class="product-group-item-margin" style="color:' + mC + ';">' + p.margin + '%</span><span class="product-group-item-stock" style="color:' + sC + ';">' + p.stock + ' шт</span><span class="product-group-item-io" style="color:' + p.ioColor + ';">' + p.io.toFixed(2) + '</span><span class="product-group-item-status">' + sIcon + '</span></div>';
        });
        html += '</div></div>';
    });
    container.innerHTML = html;
}

function toggleGroup(header) {
    var arrow = header.querySelector('.product-group-arrow');
    var items = header.nextElementSibling;
    if (items.classList.contains('open')) { items.classList.remove('open'); arrow.classList.remove('open'); }
    else { items.classList.add('open'); arrow.classList.add('open'); }
}

// ============================================================
// ЗАКАЗЫ
// ============================================================

function updateOrdersPage() {
    Promise.all([dbGetAll('sales'), dbGetAll('stock')]).then(function(results) {
        if (results[0].length === 0 && results[1].length === 0) {
            document.getElementById('ordersEmpty').style.display = 'block';
            document.getElementById('ordersContent').style.display = 'none';
            return;
        }
        document.getElementById('ordersEmpty').style.display = 'none';
        document.getElementById('ordersContent').style.display = 'block';
        renderOrders();
    });
}

function renderOrders() {
    var searchQuery = document.getElementById('ordersSearch').value.toLowerCase();
    var filter = document.getElementById('ordersFilter').value;
    getAllProducts().then(function(articles) {
        return Promise.all(articles.map(function(a) { return buildProduct(a); }));
    }).then(function(products) {
        var filtered = products.filter(function(p) {
            if (searchQuery && p.article.toLowerCase().indexOf(searchQuery) === -1) return false;
            if (filter === 'critical' && p.forecast.urgency !== 'critical') return false;
            if (filter === 'soon' && p.forecast.urgency !== 'soon') return false;
            if (filter === 'normal' && p.forecast.urgency !== 'normal') return false;
            return true;
        });
        filtered.sort(function(a, b) { return a.forecast.daysUntilStockout - b.forecast.daysUntilStockout; });
        renderOrdersSummary(filtered);
        renderOrdersList(filtered);
    });
}

function renderOrdersSummary(products) {
    var critical = products.filter(function(p) { return p.forecast.urgency === 'critical'; }).length;
    var soon = products.filter(function(p) { return p.forecast.urgency === 'soon'; }).length;
    var normal = products.filter(function(p) { return p.forecast.urgency === 'normal'; }).length;
    document.getElementById('ordersSummary').innerHTML =
        '<div style="display: flex; gap: 14px;">' +
        '<div class="orders-summary-card critical"><div class="orders-summary-value" style="color:#EF4444;">' + critical + '</div><div class="orders-summary-label">🔴 Срочно</div></div>' +
        '<div class="orders-summary-card soon"><div class="orders-summary-value" style="color:#F59E0B;">' + soon + '</div><div class="orders-summary-label">🟡 Скоро</div></div>' +
        '<div class="orders-summary-card normal"><div class="orders-summary-value" style="color:#10B981;">' + normal + '</div><div class="orders-summary-label">🟢 Норма</div></div>' +
        '</div>';
}

function renderOrdersList(products) {
    var container = document.getElementById('ordersList');
    var html = '';
    products.forEach(function(p) {
        var uColor = p.forecast.urgency === 'critical' ? '#EF4444' : p.forecast.urgency === 'soon' ? '#F59E0B' : '#10B981';
        var uLabel = p.forecast.urgency === 'critical' ? '🔴 Срочно' : p.forecast.urgency === 'soon' ? '🟡 Скоро' : '🟢 Норма';
        html += '<div class="product-group"><div class="product-group-header" onclick="toggleGroup(this)"><span class="product-group-icon">📦</span><div class="product-group-info"><div class="product-group-name">' + p.article + '</div><div class="product-group-category">' + p.category + ' · ' + p.model + '</div></div><div class="product-group-metrics"><div class="product-group-metric"><div class="product-group-metric-label">Остаток</div><div class="product-group-metric-value">' + p.stock.total + '</div></div><div class="product-group-metric"><div class="product-group-metric-label">Продаж/день</div><div class="product-group-metric-value">' + p.forecast.dailyDemand.toFixed(1) + '</div></div><div class="product-group-metric"><div class="product-group-metric-label">Дней</div><div class="product-group-metric-value" style="color:' + uColor + ';">' + p.forecast.daysUntilStockout + '</div></div><div class="product-group-metric"><div class="product-group-metric-label">Заказ</div><div class="product-group-metric-value">' + p.forecast.recommendedOrder + ' шт</div></div></div><span class="product-group-arrow">▶</span></div><div class="product-group-items"><div style="padding: 12px 16px; font-size: 12px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">' +
        '<div><span style="color: var(--text-secondary);">Остатки WB:</span> <strong>' + p.stock.wb + '</strong></div>' +
        '<div><span style="color: var(--text-secondary);">В пути:</span> <strong>' + p.stock.inTransit + '</strong></div>' +
        '<div><span style="color: var(--text-secondary);">Свой склад:</span> <strong>' + p.stock.ownWarehouse + '</strong></div>' +
        '<div><span style="color: var(--text-secondary);">Продажи 7д:</span> <strong>' + p.sales.last7days + '</strong></div>' +
        '<div><span style="color: var(--text-secondary);">Продажи 14д:</span> <strong>' + p.sales.last14days + '</strong></div>' +
        '<div><span style="color: var(--text-secondary);">Продажи 30д:</span> <strong>' + p.sales.last30days + '</strong></div>' +
        '<div><span style="color: var(--text-secondary);">Маржа:</span> <strong>' + p.metrics.margin + '%</strong></div>' +
        '<div><span style="color: var(--text-secondary);">Цена:</span> <strong>' + p.sellingPrice.toLocaleString('ru-RU') + ' ₽</strong></div>' +
        '<div><span style="color:' + uColor + ';">' + uLabel + '</span></div>' +
        '</div></div></div>';
    });
    container.innerHTML = html || '<div class="card" style="text-align: center; padding: 20px; color: var(--text-secondary);">Нет данных</div>';
}

// ============================================================
// ПОСТАВКИ
// ============================================================

var supplyCart = [];

function updateSuppliesPage() { renderSupplyCart(); renderSupplyHistory(); }

function addToSupplyCart() {
    var article = document.getElementById('supplyArticle').value.trim();
    var size = document.getElementById('supplySize').value.trim();
    var qty = parseInt(document.getElementById('supplyQty').value) || 1;
    var pallet = document.getElementById('supplyPallet').value.trim();
    if (!article) { showToast('❌ Введите артикул', 'error'); return; }
    supplyCart.push({ article: article, size: size, quantity: qty, pallet: pallet || 'Без паллеты' });
    document.getElementById('supplyArticle').value = '';
    document.getElementById('supplySize').value = '';
    document.getElementById('supplyQty').value = '1';
    document.getElementById('supplyPallet').value = '';
    renderSupplyCart();
    showToast('✅ Товар добавлен', 'success');
}

function removeFromSupplyCart(index) { supplyCart.splice(index, 1); renderSupplyCart(); }

function renderSupplyCart() {
    var container = document.getElementById('supplyCart');
    var totalPlaces = 0;
    supplyCart.forEach(function(item) { totalPlaces += item.quantity; });
    document.getElementById('supplyPlaces').textContent = totalPlaces;
    document.getElementById('supplyWeight').textContent = (totalPlaces * 0.5).toFixed(1) + ' кг';
    document.getElementById('supplyVolume').textContent = (totalPlaces * 5) + ' л';
    if (supplyCart.length === 0) { container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px; font-size: 13px;">Корзина пуста. Добавьте товары.</div>'; return; }
    var html = '';
    supplyCart.forEach(function(item, index) {
        html += '<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px;">';
        html += '<span style="flex: 1;">' + item.article + '</span><span style="width: 50px; text-align: center;">' + (item.size || '—') + '</span><span style="width: 50px; text-align: center;">' + item.quantity + '</span><span style="width: 80px; text-align: center; font-size: 10px;">' + item.pallet + '</span>';
        html += '<button class="btn btn-danger btn-sm" onclick="removeFromSupplyCart(' + index + ')" style="padding: 2px 6px; font-size: 10px;">✕</button></div>';
    });
    container.innerHTML = html;
}

function createSupply() {
    if (supplyCart.length === 0) { showToast('❌ Корзина пуста', 'error'); return; }
    var totalPlaces = 0;
    supplyCart.forEach(function(item) { totalPlaces += item.quantity; });
    var supply = { id: Date.now(), name: 'Поставка #' + new Date().toISOString().slice(0, 10).replace(/-/g, ''), date: getYesterdayStr(), items: supplyCart.length, places: totalPlaces, weight: totalPlaces * 0.5, volume: totalPlaces * 5, status: 'planned', cart: JSON.parse(JSON.stringify(supplyCart)) };
    dbSave('shipments', supply).then(function() {
        supplyCart = []; renderSupplyCart(); renderSupplyHistory();
        showToast('✅ Поставка создана', 'success');
    }).catch(function(error) { showToast('❌ Ошибка: ' + error.message, 'error'); });
}

function updateSupplyStatus(id, newStatus) {
    dbGetAll('shipments').then(function(shipments) {
        var supply = null;
        shipments.forEach(function(s) { if (s.id === id) supply = s; });
        if (!supply) return;
        supply.status = newStatus;
        return dbSave('shipments', supply);
    }).then(function() { renderSupplyHistory(); showToast('✅ Статус обновлён', 'success'); });
}

function renderSupplyHistory() {
    var tbody = document.getElementById('supplyHistoryBody');
    dbGetAll('shipments').then(function(shipments) {
        if (shipments.length === 0) { tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 20px;">Нет поставок</td></tr>'; return; }
        shipments.sort(function(a, b) { return b.id - a.id; });
        var statusLabels = { 'planned': '📋 Запланировано', 'in_transit': '🚛 В пути', 'accepted': '✅ Принято', 'archive': '📦 Архив' };
        var html = '';
        shipments.forEach(function(s) {
            html += '<tr><td>' + (s.date || '—') + '</td><td>' + s.name + '</td><td>' + s.items + '</td><td>' + s.places + '</td><td>' + (statusLabels[s.status] || s.status) + '</td><td>';
            if (s.status === 'planned') html += '<button class="btn btn-primary btn-sm" onclick="updateSupplyStatus(' + s.id + ', \'in_transit\')" style="font-size: 10px; padding: 2px 8px;">🚛 В путь</button> ';
            if (s.status === 'in_transit') html += '<button class="btn btn-success btn-sm" onclick="updateSupplyStatus(' + s.id + ', \'accepted\')" style="font-size: 10px; padding: 2px 8px;">✅ Принято</button> ';
            if (s.status === 'accepted') html += '<button class="btn btn-secondary btn-sm" onclick="updateSupplyStatus(' + s.id + ', \'archive\')" style="font-size: 10px; padding: 2px 8px;">📦 Архив</button>';
            html += '</td></tr>';
        });
        tbody.innerHTML = html;
    });
}

// ============================================================
// КАРТОЧКА ТОВАРА
// ============================================================

function openProductCard(article) {
    currentCardArticle = article;
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    document.getElementById('page-product-card').classList.add('active');
    var backContext = document.getElementById('backContext');
    var currentPage = '';
    document.querySelectorAll('.menu-item.active').forEach(function(item) { currentPage = item.getAttribute('data-page'); });
    if (currentPage === 'orders') backContext.textContent = 'из Заказов';
    else if (currentPage === 'supplies') backContext.textContent = 'из Поставок';
    else backContext.textContent = 'из Товаров';
    Promise.all([dbGetAll('sales'), dbGetAll('stock'), loadAppSettings()]).then(function(results) {
        var sales = results[0], stock = results[1];
        var productInfo = getProductInfo(article);
        if (!productInfo) return;
        var articleSales = sales.filter(function(s) { return s.article === article; });
        var articleStock = stock.filter(function(s) { return s.article === article; });
        var totalStock = getTotalStock(article, articleStock);
        var sales30 = getSales30(article, sales);
        var io = calculateIO(totalStock, sales30);
        var ioInfo = getIOStatus(io);
        var margin = calculateMargin(productInfo.price, productInfo.cost);
        var daysLeft = calculateDaysLeft(totalStock, sales30);
        var icons = { 'Костюмы': '👔', 'Платья': '👗', 'Жакеты': '🧥', 'Брюки': '👖', 'Свитеры': '🧶', 'Товар': '📦' };
        document.getElementById('cardCategoryIcon').textContent = icons[productInfo.category] || '📦';
        document.getElementById('cardTitle').textContent = article;
        document.getElementById('cardSubtitle').textContent = productInfo.category + ' · FBO';
        var statusText = '🟢 Стабильно', statusBg = 'rgba(16, 185, 129, 0.15)', statusColor = '#10B981';
        if (ioInfo.level === 'critical' || totalStock < 5) { statusText = '🔴 Проблема'; statusBg = 'rgba(239, 68, 68, 0.15)'; statusColor = '#EF4444'; }
        else if (ioInfo.level === 'warning' || margin < 0) { statusText = '🟡 Внимание'; statusBg = 'rgba(245, 158, 11, 0.15)'; statusColor = '#F59E0B'; }
        var badge = document.getElementById('cardStatusBadge'); badge.textContent = statusText; badge.style.background = statusBg; badge.style.color = statusColor;
        document.getElementById('cardKpiPrice').textContent = productInfo.price.toLocaleString('ru-RU') + ' ₽';
        var marginEl = document.getElementById('cardKpiMargin'); marginEl.textContent = margin + '%'; marginEl.style.color = margin > 20 ? '#10B981' : margin > 0 ? '#F59E0B' : '#EF4444';
        var stockEl = document.getElementById('cardKpiStock'); stockEl.textContent = totalStock + ' шт'; stockEl.style.color = totalStock < 5 ? '#EF4444' : totalStock < 20 ? '#F59E0B' : '#10B981'; document.getElementById('cardKpiStockSub').textContent = 'на ' + daysLeft + ' дн';
        var ioEl = document.getElementById('cardKpiIO'); ioEl.textContent = io.toFixed(2); ioEl.style.color = ioInfo.color; document.getElementById('cardKpiIOSub').textContent = ioInfo.status;
        renderCardChart(articleSales, 7);
        renderCardSalesTab(articleSales);
        renderCardStockTab(articleStock, totalStock, daysLeft, sales30);
        renderCardEconomicsTab(productInfo, totalStock, sales30);
    });
}

function closeProductCard() {
    currentCardArticle = null;
    if (cardChart) { cardChart.destroy(); cardChart = null; }
    var backContext = document.getElementById('backContext');
    if (backContext.textContent.indexOf('Заказов') !== -1) navigateTo('orders');
    else if (backContext.textContent.indexOf('Поставок') !== -1) navigateTo('supplies');
    else navigateTo('products');
}

function renderCardChart(sales, days) {
    var canvas = document.getElementById('cardSalesChart'); if (!canvas) return;
    if (cardChart) { cardChart.destroy(); cardChart = null; }
    var today = new Date(), labels = [], ordersData = [], deliveredData = [];
    for (var i = days - 1; i >= 0; i--) {
        var d = new Date(today); d.setDate(d.getDate() - i);
        var ds = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
        labels.push(ds); var dayO = 0, dayD = 0;
        sales.forEach(function(s) { if (s.date === ds) { dayO += s.orders || 0; dayD += s.delivered || 0; } });
        ordersData.push(dayO); deliveredData.push(dayD);
    }
    cardChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels: labels, datasets: [{ label: 'Заказы', data: ordersData, borderColor: '#A78BFA', backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 2 }, { label: 'Выкупы', data: deliveredData, borderColor: '#10B981', borderWidth: 2, borderDash: [4,3], fill: false, tension: 0.3, pointRadius: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#9CA3AF', usePointStyle: true, padding: 15, font: { size: 11 } } } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9CA3AF', font: { size: 10 } } }, x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: { size: 9 }, maxTicksLimit: 10 } } } }
    });
}

function renderCardSalesTab(sales) {
    var sorted = sales.slice().sort(function(a, b) { return b.date.localeCompare(a.date); });
    var tbody = document.getElementById('cardSalesHistory');
    if (sorted.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #9CA3AF;">Нет данных</td></tr>'; }
    else {
        var html = '';
        sorted.slice(0, 30).forEach(function(s) { html += '<tr><td>' + s.date + '</td><td>' + s.orders + '</td><td>' + s.delivered + '</td><td>' + (s.returns || 0) + '</td><td>' + (s.orders > 0 ? Math.round((s.delivered / s.orders) * 100) : 0) + '%</td></tr>'; });
        tbody.innerHTML = html;
    }
    var today = new Date(), weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 7);
    var twoWeeksAgo = new Date(today); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    var thisWeek = 0, prevWeek = 0;
    sales.forEach(function(s) {
        var parts = s.date.split('.'); var sd = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        if (sd >= weekAgo) thisWeek += s.orders || 0;
        else if (sd >= twoWeeksAgo && sd < weekAgo) prevWeek += s.orders || 0;
    });
    var compareEl = document.getElementById('cardSalesCompare');
    if (prevWeek > 0) { var change = Math.round(((thisWeek - prevWeek) / prevWeek) * 100); compareEl.innerHTML = 'Эта неделя: <strong>' + thisWeek + '</strong> заказов <span style="color:' + (change > 0 ? '#10B981' : '#EF4444') + ';">' + (change > 0 ? '▲' : '▼') + ' ' + Math.abs(change) + '%</span> к прошлой'; }
    else compareEl.textContent = 'Эта неделя: ' + thisWeek + ' заказов';
}

function renderCardStockTab(stock, totalStock, daysLeft, sales30) {
    var tbody = document.getElementById('cardStockTable');
    if (stock.length === 0) { tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #9CA3AF;">Нет данных</td></tr>'; }
    else { var html = ''; stock.forEach(function(s) { html += '<tr><td>' + (s.warehouse || '—') + '</td><td style="font-weight: 600;">' + (s.available || 0) + '</td><td>' + (s.inTransit || 0) + '</td><td>' + (s.returns || 0) + '</td><td>' + (s.available < 5 ? '🔴 Мало' : s.available < 20 ? '🟡 Норма' : '🟢 Достаточно') + '</td></tr>'; }); tbody.innerHTML = html; }
    var forecastEl = document.getElementById('cardStockForecast'), dailySales = sales30 / 30;
    if (totalStock === 0) forecastEl.innerHTML = '<span style="color: #EF4444;">❌ Товар отсутствует на складе</span>';
    else if (daysLeft <= 3) forecastEl.innerHTML = '<span style="color: #EF4444;">⚠️ Остатка хватит на <strong>' + daysLeft + ' дн</strong> (продажи ~' + dailySales.toFixed(1) + ' шт/день). Срочно запланируйте поставку.</span>';
    else if (daysLeft <= 7) forecastEl.innerHTML = '<span style="color: #F59E0B;">🟡 Остатка хватит на <strong>' + daysLeft + ' дн</strong> (продажи ~' + dailySales.toFixed(1) + ' шт/день). Рекомендуется поставка.</span>';
    else forecastEl.innerHTML = '<span style="color: #10B981;">✅ Остатка хватит на <strong>' + daysLeft + ' дн</strong> (продажи ~' + dailySales.toFixed(1) + ' шт/день).</span>';
}

function renderCardEconomicsTab(productInfo, totalStock, sales30) {
    var price = productInfo.price, cost = productInfo.cost;
    var commission = Math.round(price * appSettings.fboCommission / 100), logistics = 150, storageCost = Math.round(appSettings.storageBaseRate * appSettings.volumePerUnit * 30), returnsLoss = Math.round(price * 0.05);
    var profit = price - commission - logistics - storageCost - cost - returnsLoss, tax = Math.round(price * 0.06), netProfit = profit - tax, totalMargin = parseFloat(((netProfit / price) * 100).toFixed(1));
    var breakdownEl = document.getElementById('cardEconomicsBreakdown');
    var bars = [{ label: 'Комиссия WB (' + appSettings.fboCommission + '%)', value: commission, cls: 'commission' }, { label: 'Логистика', value: logistics, cls: 'logistics' }, { label: 'Хранение (мес)', value: storageCost, cls: 'storage' }, { label: 'Себестоимость', value: cost, cls: 'cost' }, { label: 'Возвраты (~5%)', value: returnsLoss, cls: 'returns' }, { label: 'Налог (УСН 6%)', value: tax, cls: 'tax' }];
    var maxExpense = Math.max(commission, logistics, storageCost, cost, returnsLoss, tax);
    var html = '<div style="font-size: 16px; font-weight: 600; color: #F0F0FF; margin-bottom: 12px;">Цена продажи: ' + price.toLocaleString('ru-RU') + ' ₽</div><div style="border-top: 1px solid #2A2A42; margin-bottom: 8px;"></div>';
    bars.forEach(function(bar) { var width = maxExpense > 0 ? Math.round((bar.value / maxExpense) * 100) : 0; html += '<div class="econ-bar"><span class="econ-bar-label">' + bar.label + '</span><div class="econ-bar-track"><div class="econ-bar-fill ' + bar.cls + '" style="width:' + width + '%;"></div></div><span class="econ-bar-value" style="color:#EF4444;">−' + bar.value.toLocaleString('ru-RU') + ' ₽</span></div>'; });
    html += '<div style="border-top: 1px solid #2A2A42; margin: 8px 0;"></div><div class="econ-bar"><span class="econ-bar-label" style="font-weight:600;">Прибыль с единицы</span><div class="econ-bar-track"></div><span class="econ-bar-value" style="color:#10B981; font-size:14px;">' + profit.toLocaleString('ru-RU') + ' ₽</span></div><div class="econ-bar"><span class="econ-bar-label" style="font-weight:600;">ЧИСТАЯ ПРИБЫЛЬ</span><div class="econ-bar-track"></div><span class="econ-bar-value" style="color:#10B981; font-size:16px; font-weight:600;">' + netProfit.toLocaleString('ru-RU') + ' ₽</span></div><div style="font-size:13px; color:#9CA3AF; margin-top:4px;">Маржинальность: <span style="color:' + (totalMargin > 20 ? '#10B981' : '#F59E0B') + '; font-weight:600;">' + totalMargin + '%</span></div>';
    breakdownEl.innerHTML = html;
    var monthlyRevenue = sales30 * price, monthlyCosts = sales30 * (commission + logistics + storageCost + cost + returnsLoss + tax), monthlyProfit = monthlyRevenue - monthlyCosts;
    document.getElementById('cardEconomicsTotal').innerHTML = '<div style="font-size:12px; color:#9CA3AF;">📊 Итого за 30 дней</div><div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:6px;"><div><span style="color:#9CA3AF; font-size:10px;">Продано</span><div style="font-weight:600; color:#F0F0FF;">' + sales30 + ' шт</div></div><div><span style="color:#9CA3AF; font-size:10px;">Выручка</span><div style="font-weight:600; color:#F0F0FF;">' + monthlyRevenue.toLocaleString('ru-RU') + ' ₽</div></div><div><span style="color:#9CA3AF; font-size:10px;">Чистая прибыль</span><div style="font-weight:600; color:#10B981;">' + monthlyProfit.toLocaleString('ru-RU') + ' ₽</div></div></div>';
}

// ============================================================
// ИМПОРТ
// ============================================================

function downloadTemplate(type) {
    var headers, example, fileName;
    if (type === 'sales') { headers = ['Артикул продавца', 'Дата', 'Заказано', 'Выкуплено', 'Сумма заказов', 'Возвраты']; example = ['21_К_Вельвет_голубой_40', '23.07.2026', '5', '4', '16000', '0']; fileName = 'StockFlow_Шаблон_Продажи.xlsx'; }
    else if (type === 'stock') { headers = ['Артикул продавца', 'Размер', 'Склад', 'Всего на складе', 'В пути', 'Возвраты']; example = ['21_К_Вельвет_голубой_40', '40', 'Коледино', '50', '10', '2']; fileName = 'StockFlow_Шаблон_Остатки.xlsx'; }
    else return;
    var wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map(function() { return { wch: 20 }; });
    XLSX.utils.book_append_sheet(wb, ws, 'Шаблон'); XLSX.writeFile(wb, fileName);
}

function setupImportDropZone(dropZoneId, fileInputId, type) {
    var dropZone = document.getElementById(dropZoneId), fileInput = document.getElementById(fileInputId);
    if (!dropZone || !fileInput) return;
    dropZone.addEventListener('click', function() { fileInput.click(); });
    dropZone.addEventListener('dragover', function(e) { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', function() { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', function(e) { e.preventDefault(); dropZone.classList.remove('dragover'); if (e.dataTransfer.files.length > 0) processImportFile(e.dataTransfer.files[0], type); });
    fileInput.addEventListener('change', function() { if (fileInput.files.length > 0) { processImportFile(fileInput.files[0], type); fileInput.value = ''; } });
}

function processImportFile(file, type) {
    var statusEl = document.getElementById(type === 'sales' ? 'salesImportStatus' : 'stockImportStatus');
    if (statusEl) statusEl.innerHTML = '<span style="color: #F59E0B;">⏳ Обработка файла...</span>';
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var workbook = XLSX.read(e.target.result, { type: 'array' }), sheet = workbook.Sheets[workbook.SheetNames[0]], data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
            if (data.length === 0) { if (statusEl) statusEl.innerHTML = '<span style="color: #EF4444;">❌ Файл пуст</span>'; return; }
            var mapped = [], errors = [];
            if (type === 'sales') mapped = mapSalesData(data, errors); else if (type === 'stock') mapped = mapStockData(data, errors);
            if (mapped.length === 0) { if (statusEl) statusEl.innerHTML = '<span style="color: #EF4444;">❌ Нет данных. Ошибок: ' + errors.length + '</span>'; return; }
            var storeName = type === 'sales' ? 'sales' : 'stock';
            dbClear(storeName).then(function() { return Promise.all(mapped.map(function(item) { return dbSave(storeName, item); })); }).then(function() {
                var msg = '✅ Импортировано ' + mapped.length + ' записей'; if (errors.length > 0) msg += ' (ошибок: ' + errors.length + ')';
                if (statusEl) statusEl.innerHTML = '<span style="color: #10B981;">' + msg + '</span>';
                showToast(msg, errors.length > 0 ? 'error' : 'success'); updateDashboard(); updateProductList();
            }).catch(function(error) { if (statusEl) statusEl.innerHTML = '<span style="color: #EF4444;">❌ Ошибка: ' + error.message + '</span>'; });
        } catch (error) { if (statusEl) statusEl.innerHTML = '<span style="color: #EF4444;">❌ Ошибка чтения: ' + error.message + '</span>'; }
    };
    reader.onerror = function() { if (statusEl) statusEl.innerHTML = '<span style="color: #EF4444;">❌ Ошибка чтения файла</span>'; };
    reader.readAsArrayBuffer(file);
}

function mapSalesData(data, errors) {
    var keys = Object.keys(data[0]), getKey = function(p) { return keys.find(function(k) { return p.some(function(x) { return k.toLowerCase().indexOf(x) !== -1; }); }); };
    var kA = getKey(['артикул', 'article']) || keys[0], kD = getKey(['дата', 'date']) || keys[1], kO = getKey(['заказано', 'orders']) || keys[2], kDel = getKey(['выкуплено', 'delivered']) || keys[3], kAm = getKey(['сумма', 'amount']) || keys[4], kR = getKey(['возврат', 'returns']) || keys[5];
    var mapped = [];
    data.forEach(function(row, i) { var a = String(row[kA] || '').trim(); if (!a) { errors.push({ row: i+1, error: 'Пустой артикул' }); return; } mapped.push({ id: Date.now() + Math.random(), article: a, date: String(row[kD] || '').trim() || getYesterdayStr(), orders: parseInt(row[kO]) || 0, delivered: parseInt(row[kDel]) || 0, returns: parseInt(row[kR]) || 0, amount: parseFloat(String(row[kAm] || '0').replace(',', '.').replace(/\s/g, '')) || 0 }); });
    return mapped;
}

function mapStockData(data, errors) {
    var keys = Object.keys(data[0]), getKey = function(p) { return keys.find(function(k) { return p.some(function(x) { return k.toLowerCase().indexOf(x) !== -1; }); }); };
    var kA = getKey(['артикул', 'article']) || keys[0], kS = getKey(['размер', 'size']) || keys[1], kW = getKey(['склад', 'warehouse']) || keys[2], kAv = getKey(['всего', 'available']) || keys[3], kT = getKey(['пути', 'transit']) || keys[4], kR = getKey(['возврат', 'returns']) || keys[5];
    var mapped = [];
    data.forEach(function(row, i) { var a = String(row[kA] || '').trim(); if (!a) { errors.push({ row: i+1, error: 'Пустой артикул' }); return; } mapped.push({ id: Date.now() + Math.random(), article: a, size: String(row[kS] || '').trim(), warehouse: String(row[kW] || 'Склад').trim(), available: parseInt(row[kAv]) || 0, inTransit: parseInt(row[kT]) || 0, returns: parseInt(row[kR]) || 0 }); });
    return mapped;
}

// ============================================================
// ЯДРО: PRODUCT
// ============================================================

function buildProduct(article) {
    return Promise.all([dbGetAll('sales'), dbGetAll('stock'), dbGetAll('shipments'), dbGetAll('warehouse'), loadAppSettings()]).then(function(results) {
        var sales = results[0], stock = results[1], shipments = results[2], warehouse = results[3];
        var productInfo = getProductInfo(article);
        var articleSales = sales.filter(function(s) { return s.article === article; });
        var articleStock = stock.filter(function(s) { return s.article === article; });
        var wbStock = getTotalStock(article, articleStock);
        var inTransit = 0; articleStock.forEach(function(s) { inTransit += s.inTransit || 0; });
        var ownWarehouse = 0;
        warehouse.forEach(function(w) { if (w.article === article && w.status === 'active') ownWarehouse += w.quantity || 0; });
        var today = new Date(), days7ago = new Date(today), days14ago = new Date(today), days30ago = new Date(today);
        days7ago.setDate(days7ago.getDate() - 7); days14ago.setDate(days14ago.getDate() - 14); days30ago.setDate(days30ago.getDate() - 30);
        var s7 = 0, s14 = 0, s30 = 0;
        articleSales.forEach(function(s) { var p = s.date.split('.'); var sd = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])); if (sd >= days7ago) s7 += s.orders || 0; if (sd >= days14ago) s14 += s.orders || 0; if (sd >= days30ago) s30 += s.orders || 0; });
        var totalStock = wbStock + inTransit + ownWarehouse, avg30 = s30 / 30;
        var io = calculateIO(wbStock, s30), ioInfo = getIOStatus(io);
        var daysLeft = calculateDaysLeft(totalStock, s30);
        var margin = calculateMargin(productInfo.price, productInfo.cost);
        var recommendedOrder = Math.max(0, Math.round((avg30 * (parseInt(appSettings.targetStockDays) || 60)) - totalStock));
        var urgency; if (daysLeft <= 7) urgency = 'critical'; else if (daysLeft <= 14) urgency = 'soon'; else urgency = 'normal';
        return { productId: article, article: article, model: productInfo.baseArticle || article, color: productInfo.color || '', size: productInfo.size || article.split('_').pop(), category: productInfo.category || 'Товар', barcode: productInfo.barcode || '', weight: 0.5, volume: parseFloat(appSettings.volumePerUnit) || 5, costPrice: productInfo.cost, sellingPrice: productInfo.price, stock: { wb: wbStock, inTransit: inTransit, ownWarehouse: ownWarehouse, total: totalStock }, sales: { last7days: s7, last14days: s14, last30days: s30, avgPerDay7: parseFloat((s7/7).toFixed(1)), avgPerDay14: parseFloat((s14/14).toFixed(1)), avgPerDay30: parseFloat(avg30.toFixed(1)) }, metrics: { io: io, ioStatus: ioInfo.status, ioColor: ioInfo.color, daysLeft: daysLeft, margin: margin, profit: productInfo.price - productInfo.cost }, forecast: { dailyDemand: parseFloat(avg30.toFixed(1)), daysUntilStockout: daysLeft, recommendedOrder: recommendedOrder, urgency: urgency } };
    });
}

function getAllProducts() {
    return Promise.all([dbGetAll('sales'), dbGetAll('stock')]).then(function(results) {
        var articles = {}; results[0].forEach(function(s) { articles[s.article] = true; }); results[1].forEach(function(s) { articles[s.article] = true; }); TEST_PRODUCTS.forEach(function(p) { articles[p.article] = true; }); return Object.keys(articles).sort();
    });
}

function updateProduct(article, changes) {
    var product = null; TEST_PRODUCTS.forEach(function(p) { if (p.article === article) product = p; });
    if (product) { if (changes.price !== undefined) product.price = changes.price; if (changes.cost !== undefined) product.cost = changes.cost; if (changes.category !== undefined) product.category = changes.category; if (changes.baseArticle !== undefined) product.baseArticle = changes.baseArticle; }
}

// ============================================================
// МОЙ СКЛАД
// ============================================================

var currentWarehouse = 'Основной';

function updateWarehousePage() {
    renderWarehouse();
}

function switchWarehouse(name) {
    currentWarehouse = name;
    document.querySelectorAll('.wh-tab').forEach(function(tab) { tab.classList.remove('active'); });
    document.querySelector('.wh-tab[data-warehouse="' + name + '"]').classList.add('active');
    renderWarehouse();
}

function createPallet() {
    var number = document.getElementById('newPalletNumber').value.trim();
    if (!number) { showToast('❌ Введите номер палеты', 'error'); return; }
    dbGetAll('warehouse').then(function(items) {
        var exists = items.some(function(i) { return i.type === 'pallet' && i.warehouse === currentWarehouse && i.pallet === number; });
        if (exists) { showToast('❌ Паллета №' + number + ' уже существует', 'error'); return; }
        return dbSave('warehouse', { id: Date.now(), type: 'pallet', warehouse: currentWarehouse, pallet: number, side: 'лицевая', created: getYesterdayStr() });
    }).then(function() { renderWarehouse(); showToast('✅ Паллета создана', 'success'); });
}

function addBoxToPallet(palletNumber, side) {
    var boxLabel = prompt('Этикетка коробки (например, КЗЖ№1):');
    if (!boxLabel) return;
    dbSave('warehouse', { id: Date.now(), type: 'box', warehouse: currentWarehouse, pallet: palletNumber, side: side, box: boxLabel.trim(), created: getYesterdayStr() }).then(function() { renderWarehouse(); showToast('✅ Коробка добавлена', 'success'); });
}

function addItemToBox(boxId, palletNumber, side) {
    var article = prompt('Артикул товара:');
    if (!article) return;
    var color = prompt('Цвет:') || '';
    var size = prompt('Размер:') || '';
    var qty = parseInt(prompt('Количество:') || '1') || 1;
    if (qty <= 0) return;
    dbSave('warehouse', { id: Date.now(), type: 'item', warehouse: currentWarehouse, pallet: palletNumber, side: side, box: boxId, article: article, color: color, size: size, quantity: qty, status: 'active', created: getYesterdayStr() }).then(function() { renderWarehouse(); showToast('✅ Товар добавлен', 'success'); });
}

function removeWarehouseItem(id) {
    if (!confirm('Удалить этот элемент со склада?')) return;
    dbDelete('warehouse', id).then(function() { renderWarehouse(); showToast('✅ Удалено', 'success'); });
}

function renderWarehouse() {
    var container = document.getElementById('warehouseContent');
    dbGetAll('warehouse').then(function(items) {
        var pallets = items.filter(function(i) { return i.type === 'pallet' && i.warehouse === currentWarehouse; });
        if (pallets.length === 0) {
            container.innerHTML = '<div class="card" style="text-align: center; padding: 30px;"><div style="font-size: 36px; margin-bottom: 10px;">📦</div><div style="font-size: 15px; font-weight: 600;">Склад пуст</div><div style="font-size: 13px; color: var(--text-secondary); margin-top: 4px;">Создайте первую палету</div></div>';
            return;
        }
        var html = '';
        pallets.sort(function(a, b) { return a.pallet.localeCompare(b.pallet); }).forEach(function(pallet) {
            var boxes = items.filter(function(i) { return i.type === 'box' && i.pallet === pallet.pallet && i.warehouse === currentWarehouse; });
            var itemsAll = items.filter(function(i) { return i.type === 'item' && i.pallet === pallet.pallet && i.warehouse === currentWarehouse && i.status === 'active'; });
            var totalQty = itemsAll.reduce(function(s, i) { return s + (i.quantity || 0); }, 0);
            html += '<div class="product-group"><div class="product-group-header" onclick="toggleGroup(this)"><span class="product-group-icon">📦</span><div class="product-group-info"><div class="product-group-name">Паллета №' + pallet.pallet + '</div><div class="product-group-category">' + currentWarehouse + ' · ' + boxes.length + ' коробок · ' + totalQty + ' ед.</div></div><span class="product-group-arrow">▶</span></div><div class="product-group-items"><div style="padding: 8px 16px; display: flex; gap: 6px; flex-wrap: wrap; border-bottom: 1px solid var(--border);"><button class="btn btn-secondary btn-sm" onclick="addBoxToPallet(\'' + pallet.pallet + '\', \'лицевая\')">➕ Коробка (лицо)</button><button class="btn btn-secondary btn-sm" onclick="addBoxToPallet(\'' + pallet.pallet + '\', \'обратная\')">➕ Коробка (оборот)</button></div>';
            boxes.forEach(function(box) {
                var boxItems = itemsAll.filter(function(i) { return i.box === box.box; });
                var boxQty = boxItems.reduce(function(s, i) { return s + (i.quantity || 0); }, 0);
                html += '<div style="padding: 6px 16px 6px 24px; border-bottom: 1px solid var(--border);"><div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px;"><span><strong>' + box.box + '</strong> (' + box.side + ') — ' + boxQty + ' ед.</span><button class="btn btn-primary btn-sm" onclick="addItemToBox(\'' + box.box + '\', \'' + pallet.pallet + '\', \'' + box.side + '\')" style="font-size: 10px; padding: 2px 8px;">➕ Товар</button></div>';
                if (boxItems.length > 0) {
                    html += '<div style="margin-top: 4px; font-size: 11px; color: var(--text-secondary);">';
                    boxItems.forEach(function(item) { html += '<div style="padding: 2px 0;">' + item.article + ' ' + item.color + ' ' + item.size + ' — ' + item.quantity + ' шт <button class="btn btn-danger btn-sm" onclick="removeWarehouseItem(' + item.id + ')" style="font-size: 9px; padding: 1px 6px;">✕</button></div>'; });
                    html += '</div>';
                }
                html += '</div>';
            });
            html += '</div></div>';
        });
        container.innerHTML = html;
    });
}

// ============================================================
// ОБЩИЕ ФУНКЦИИ
// ============================================================

function getProductInfo(article) {
    var result = null; TEST_PRODUCTS.forEach(function(p) { if (p.article === article) result = p; });
    if (!result) result = { article: article, baseArticle: article.split('_').slice(0, -2).join('_'), category: 'Товар', price: 0, cost: 0, color: '', size: article.split('_').pop(), barcode: '' };
    return result;
}
function getTotalStock(article, stockData) { var t = 0; stockData.forEach(function(s) { if (s.article === article) t += s.available || 0; }); return t; }
function getSales30(article, salesData) { var t = 0; salesData.forEach(function(s) { if (s.article === article) t += s.orders || 0; }); return t; }
function getProblems(products) {
    var p = [];
    products.forEach(function(x) { if (x.stock < 5) p.push({ type: 'critical', icon: '🔴', text: x.article + ' — остаток ' + x.stock + ' шт (на ' + x.daysLeft + ' дней)' }); else if (x.ioLevel === 'critical' && x.stock > 0) p.push({ type: 'critical', icon: '🔴', text: x.article + ' — ИО ' + (x.io*100).toFixed(1) + '% (риск блокировки)' }); else if (x.margin < 0) p.push({ type: 'warning', icon: '🟡', text: x.article + ' — убыточный (маржа ' + x.margin + '%)' }); else if (x.ioLevel === 'warning') p.push({ type: 'warning', icon: '🟡', text: x.article + ' — ИО ' + (x.io*100).toFixed(1) + '% (недостаток)' }); });
    return p;
}
function getYesterdayStr() { var d = new Date(); d.setDate(d.getDate() - 1); return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); }

// ============================================================
// ЗАПУСК
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    document.querySelector('.sidebar-version').textContent = 'StockFlow v' + APP_VERSION + ' (' + APP_STAGE + ')';
    document.querySelectorAll('.menu-item').forEach(function(item) { item.addEventListener('click', function() { navigateTo(this.getAttribute('data-page')); }); });
    document.getElementById('sidebarLogo').addEventListener('click', function() { navigateTo('dashboard'); });
    checkDatabase();
    document.getElementById('loadTestDataBtn').addEventListener('click', loadTestData);
    document.getElementById('clearTestDataBtn').addEventListener('click', clearAllData);
    document.getElementById('refreshDashboardBtn').addEventListener('click', updateDashboard);
    loadSettings();
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('taxSystem').addEventListener('change', togglePatentField);
    document.getElementById('productSearch').addEventListener('input', function() { refreshProductTable(); });
    document.getElementById('productFilter').addEventListener('change', function() { refreshProductTable(); });
    document.getElementById('clearFilterBtn').addEventListener('click', function() { document.getElementById('productSearch').value = ''; document.getElementById('productFilter').value = 'all'; refreshProductTable(); });
    document.getElementById('ordersPeriodSelect').addEventListener('change', renderOrders);
    document.getElementById('ordersSearch').addEventListener('input', renderOrders);
    document.getElementById('ordersFilter').addEventListener('change', renderOrders);
    document.getElementById('clearOrdersFilterBtn').addEventListener('click', function() { document.getElementById('ordersSearch').value = ''; document.getElementById('ordersFilter').value = 'all'; renderOrders(); });
    document.getElementById('exportOrdersBtn').addEventListener('click', function() { showToast('📤 Экспорт будет добавлен в следующем обновлении', 'success'); });
    document.getElementById('addToSupplyBtn').addEventListener('click', addToSupplyCart);
    document.getElementById('createSupplyBtn').addEventListener('click', createSupply);
    document.getElementById('addFromWarehouseBtn').addEventListener('click', function() { showToast('📦 Добавление со склада будет доступно в следующем обновлении', 'success'); });
    document.getElementById('backToProductsBtn').addEventListener('click', closeProductCard);
    document.querySelectorAll('.card-chart-btn').forEach(function(btn) { btn.addEventListener('click', function() { document.querySelectorAll('.card-chart-btn').forEach(function(b) { b.classList.remove('active'); }); this.classList.add('active'); if (currentCardArticle) { dbGetAll('sales').then(function(sales) { renderCardChart(sales.filter(function(s) { return s.article === currentCardArticle; }), parseInt(this.getAttribute('data-card-period'))); }.bind(this)); } }); });
    document.querySelectorAll('.card-tab').forEach(function(tab) { tab.addEventListener('click', function() { document.querySelectorAll('.card-tab').forEach(function(t) { t.classList.remove('active'); }); this.classList.add('active'); var tn = this.getAttribute('data-card-tab'); document.querySelectorAll('.card-tab-content').forEach(function(c) { c.style.display = 'none'; }); var content = document.getElementById('cardTab' + tn.charAt(0).toUpperCase() + tn.slice(1)); if (content) content.style.display = 'block'; }); });
    document.getElementById('downloadSalesTemplateBtn').addEventListener('click', function() { downloadTemplate('sales'); });
    document.getElementById('downloadStockTemplateBtn').addEventListener('click', function() { downloadTemplate('stock'); });
    setupImportDropZone('salesDropZone', 'salesFileInput', 'sales');
    setupImportDropZone('stockDropZone', 'stockFileInput', 'stock');
    document.getElementById('createPalletBtn').addEventListener('click', createPallet);
    document.querySelectorAll('.wh-tab').forEach(function(tab) { tab.addEventListener('click', function() { switchWarehouse(this.getAttribute('data-warehouse')); }); });
    updateDashboard();
});

function refreshProductTable() { Promise.all([dbGetAll('sales'), dbGetAll('stock')]).then(function(r) { renderGroupedProducts(buildProductList(r[0], r[1])); }); }
