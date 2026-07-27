// ============================================================
// КОНСТАНТЫ ПРИЛОЖЕНИЯ
// ============================================================

var APP_VERSION = '5.0.0';
var APP_STAGE = 'Beta';
var DB_NAME = 'BeltaneeDB_v5';
var DB_VERSION = 4;
var STORES = ['sales', 'stock', 'settings', 'shipments', 'warehouse', 'ads'];
var currentCardArticle = null;
var cardChart = null;
var supplyCart = [];
var currentWarehouse = 'Основной';

// Пагинация рекламы
var adsCurrentPage = 1;
var adsPerPage = 25;
var adsDataCache = [];
var selectedAds = [];

// ============================================================
// НАВИГАЦИЯ
// ============================================================

function navigateTo(pageName) {
    document.querySelectorAll('.menu-item').forEach(function(item) { item.classList.remove('active'); });
    var menuItem = document.querySelector('.menu-item[data-page="' + pageName + '"]');
    if (menuItem) menuItem.classList.add('active');
    document.querySelectorAll('.page').forEach(function(page) { page.classList.remove('active'); });
    var page = document.getElementById('page-' + pageName);
    if (page) page.classList.add('active');
    if (pageName === 'settings') { loadSettings(); updateDBStats(); }
    if (pageName === 'dashboard') updateDashboard();
    if (pageName === 'products') updateProductList();
    if (pageName === 'orders') updateOrdersPage();
    if (pageName === 'supplies') updateSuppliesPage();
    if (pageName === 'warehouse') updateWarehousePage();
    if (pageName === 'ads') updateAdsPage();
}

// ============================================================
// БАЗА ДАННЫХ
// ============================================================

function openDB() {
    return new Promise(function(resolve, reject) {
        var request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function(event) {
            var db = event.target.result;
            STORES.forEach(function(storeName) { if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true }); });
        };
        request.onsuccess = function(event) { resolve(event.target.result); };
        request.onerror = function(event) { reject(event.target.error); };
        request.onblocked = function() { reject(new Error('База данных заблокирована.')); };
    });
}

function dbSave(storeName, data) {
    return openDB().then(function(db) { return new Promise(function(resolve, reject) { var tx = db.transaction(storeName, 'readwrite'); var store = tx.objectStore(storeName); var req = store.put(data); req.onsuccess = function() { resolve(req.result); }; req.onerror = function() { reject(req.error); }; tx.oncomplete = function() { db.close(); }; }); });
}

function dbGetAll(storeName) {
    return openDB().then(function(db) { return new Promise(function(resolve, reject) { var tx = db.transaction(storeName, 'readonly'); var store = tx.objectStore(storeName); var req = store.getAll(); req.onsuccess = function() { resolve(req.result); }; req.onerror = function() { reject(req.error); }; tx.oncomplete = function() { db.close(); }; }); });
}

function dbClear(storeName) {
    return openDB().then(function(db) { return new Promise(function(resolve, reject) { var tx = db.transaction(storeName, 'readwrite'); var store = tx.objectStore(storeName); var req = store.clear(); req.onsuccess = function() { resolve(); }; req.onerror = function() { reject(req.error); }; tx.oncomplete = function() { db.close(); }; }); });
}

function dbDelete(storeName, id) {
    return openDB().then(function(db) { return new Promise(function(resolve, reject) { var tx = db.transaction(storeName, 'readwrite'); var store = tx.objectStore(storeName); var req = store.delete(id); req.onsuccess = function() { resolve(); }; req.onerror = function() { reject(req.error); }; tx.oncomplete = function() { db.close(); }; }); });
}

// ============================================================
// TOAST
// ============================================================

function showToast(message, type) {
    var toast = document.getElementById('toast'); if (!toast) return;
    toast.textContent = message; toast.className = 'toast ' + (type || 'success') + ' show';
    clearTimeout(toast._timeout); toast._timeout = setTimeout(function() { toast.classList.remove('show'); }, 3000);
}

// ============================================================
// ПРОВЕРКА БД
// ============================================================

function checkDatabase() {
    var el = document.getElementById('dbStatus'); if (!el) return;
    el.innerHTML = 'Проверка базы данных...';
    openDB().then(function(db) { db.close(); el.innerHTML = '<span style="color:#10B981;">✅ База данных готова (v.' + DB_VERSION + ')</span>'; }).catch(function(e) { el.innerHTML = '<span style="color:#EF4444;">❌ Ошибка: ' + e.message + '</span>'; });
}

function updateDBStats() {
    var el = document.getElementById('dbStats'); if (!el) return;
    Promise.all([dbGetAll('sales'), dbGetAll('stock'), dbGetAll('ads')]).then(function(r) { el.textContent = 'Продаж: ' + r[0].length + ', Остатков: ' + r[1].length + ', Рекламы: ' + r[2].length; }).catch(function() { el.textContent = ''; });
}

// ============================================================
// НАСТРОЙКИ
// ============================================================

function loadSettings() {
    dbGetAll('settings').then(function(data) { if (data.length > 0) { data.forEach(function(item) { var el = document.getElementById(item.key); if (el) el.value = item.value; }); togglePatentField(); } });
}

function saveSettings() {
    var s = [
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
    dbClear('settings').then(function() { Promise.all(s.map(function(x) { return dbSave('settings', x); })).then(function() { showToast('✅ Настройки сохранены', 'success'); }); });
}

function togglePatentField() { var v = document.getElementById('taxSystem').value; var b = document.getElementById('patentBlock'); if (b) b.style.display = (v === 'patent') ? 'block' : 'none'; }

// ============================================================
// МЕНЮ — ГРУППИРОВКА
// ============================================================

function toggleMenuGroup(header) {
    var items = header.nextElementSibling;
    var arrow = header.querySelector('.menu-group-arrow');
    if (items) {
        items.classList.toggle('collapsed');
        if (arrow) arrow.classList.toggle('collapsed');
        // Сохраняем состояние
        var groupLabel = header.querySelector('.menu-group-label');
        if (groupLabel) {
            var state = items.classList.contains('collapsed') ? 'collapsed' : 'expanded';
            localStorage.setItem('menu_group_' + groupLabel.textContent.trim(), state);
        }
    }
}

function restoreMenuState() {
    document.querySelectorAll('.menu-group').forEach(function(group) {
        var header = group.querySelector('.menu-group-header');
        var items = group.querySelector('.menu-group-items');
        var label = header ? header.querySelector('.menu-group-label') : null;
        if (label) {
            var state = localStorage.getItem('menu_group_' + label.textContent.trim());
            if (state === 'collapsed') {
                if (items) items.classList.add('collapsed');
                var arrow = header.querySelector('.menu-group-arrow');
                if (arrow) arrow.classList.add('collapsed');
            }
        }
    });
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

var TEST_ADS = [
    {
        campaign: 'Кампания 5 (Свитер)',
        type: 'Автоставка',
        wbId: '36386803',
        impressions: 32000,
        clicks: 890,
        cpc: 18.5,
        ctr: 2.78,
        cr: 3.5,
        spent: 16465,
        orders_from_ad: 31,
        linkedArticle: '15_К_Свитер_бежевый_46',
        status: 'active',
        budget: 20000,
        dailyLimit: 3000,
        _roi: 0,
        _drr: 0,
        _trend: 5,
        created: '2026-07-20'
    },
    {
        campaign: 'Кампания 1 (Вельвет)',
        type: 'Аукцион',
        wbId: '36386799',
        impressions: 12500,
        clicks: 320,
        cpc: 45.5,
        ctr: 2.56,
        cr: 4.2,
        spent: 14560,
        orders_from_ad: 13,
        linkedArticle: '21_К_Вельвет_голубой_40',
        status: 'active',
        budget: 15000,
        dailyLimit: 2000,
        _roi: 0,
        _drr: 0,
        _trend: -3,
        created: '2026-07-15'
    },
    {
        campaign: 'Кампания 7 (Тестовая)',
        type: 'Автоставка',
        wbId: '36386805',
        impressions: 9400,
        clicks: 210,
        cpc: 35.6,
        ctr: 2.23,
        cr: 4.8,
        spent: 7476,
        orders_from_ad: 10,
        linkedArticle: '41_К_Брюки_серый_42',
        status: 'active',
        budget: 10000,
        dailyLimit: 1500,
        _roi: 0,
        _drr: 0,
        _trend: 2,
        created: '2026-07-18'
    },
    {
        campaign: 'Кампания 4 (Брюки)',
        type: 'Аукцион',
        wbId: '36386802',
        impressions: 6800,
        clicks: 95,
        cpc: 52.1,
        ctr: 1.40,
        cr: 2.1,
        spent: 4950,
        orders_from_ad: 2,
        linkedArticle: '41_К_Брюки_серый_42',
        status: 'paused',
        budget: 8000,
        dailyLimit: 1000,
        _roi: 0,
        _drr: 0,
        _trend: -8,
        created: '2026-07-10'
    },
    {
        campaign: 'Кампания 3 (Жакет)',
        type: 'Автоставка',
        wbId: '36386801',
        impressions: 21500,
        clicks: 540,
        cpc: 28.2,
        ctr: 2.51,
        cr: 2.8,
        spent: 15228,
        orders_from_ad: 15,
        linkedArticle: '33_К_Жакет_синий_48',
        status: 'paused',
        budget: 20000,
        dailyLimit: 2000,
        _roi: 0,
        _drr: 0,
        _trend: -12,
        created: '2026-07-08'
    },
    {
        campaign: 'Кампания 6 (Новая)',
        type: 'Аукцион',
        wbId: '36386804',
        impressions: 3200,
        clicks: 42,
        cpc: 48.2,
        ctr: 1.31,
        cr: 0.5,
        spent: 2024,
        orders_from_ad: 0,
        linkedArticle: null,
        status: 'paused',
        budget: 5000,
        dailyLimit: 500,
        _roi: 0,
        _drr: 0,
        _trend: 0,
        created: '2026-07-21'
    },
    {
        campaign: 'Кампания 2 (Платье)',
        type: 'Аукцион',
        wbId: '36386800',
        impressions: 8400,
        clicks: 180,
        cpc: 32.8,
        ctr: 2.14,
        cr: 3.1,
        spent: 5904,
        orders_from_ad: 5,
        linkedArticle: '27_К_Платье_чёрный_44',
        status: 'active',
        budget: 10000,
        dailyLimit: 1500,
        _roi: 0,
        _drr: 0,
        _trend: -5,
        created: '2026-07-12'
    }
];

function generateTestSales() {
    var sales = [], today = new Date();
    TEST_PRODUCTS.forEach(function(p) { var bs = Math.floor(Math.random() * 5) + 1; for (var i = 29; i >= 0; i--) { var d = new Date(today); d.setDate(d.getDate() - i); var ds = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); var o = Math.max(0, bs + Math.floor(Math.random() * 3) - 1); if (o === 0) continue; var del = Math.floor(o * (0.7 + Math.random() * 0.25)); sales.push({ id: Date.now() + Math.random(), article: p.article, date: ds, orders: o, delivered: del, returns: o - del, amount: o * p.price }); } });
    return sales;
}

function generateTestStock() {
    var q = [3, 45, 120, 67, 8], stock = [];
    TEST_PRODUCTS.forEach(function(p, i) { stock.push({ id: Date.now() + Math.random(), article: p.article, size: p.article.split('_').pop(), warehouse: 'Коледино', available: q[i], inTransit: Math.floor(Math.random() * 20), returns: Math.floor(Math.random() * 3) }); });
    return stock;
}

function loadTestData() {
    Promise.all([dbClear('sales'), dbClear('stock'), dbClear('ads')]).then(function() {
        return Promise.all(generateTestSales().map(function(s) { return dbSave('sales', s); }));
    }).then(function() {
        return Promise.all(generateTestStock().map(function(s) { return dbSave('stock', s); }));
    }).then(function() {
        return loadTestAdsData();
    }).then(function() {
        updateDashboard();
        updateProductList();
        updateAdsPage();
        showToast('✅ Тестовые данные загружены', 'success');
    });
}

function clearAllData() {
    if (!confirm('Удалить все данные?')) return;
    Promise.all([dbClear('sales'), dbClear('stock'), dbClear('ads')]).then(function() {
        updateDashboard();
        updateProductList();
        updateAdsPage();
        showToast('✅ Данные очищены', 'success');
    });
}

// ============================================================
// ТЕСТОВЫЕ ДАННЫЕ РЕКЛАМЫ
// ============================================================

function loadTestAdsData() {
    return dbClear('ads').then(function() {
        return Promise.all(TEST_ADS.map(function(ad) {
            var copy = JSON.parse(JSON.stringify(ad));
            copy.id = Date.now() + Math.random();
            return dbSave('ads', copy);
        }));
    }).then(function() {
        return recalculateAdsROI();
    }).then(function() {
        updateAdsPage();
        showToast('✅ Загружено ' + TEST_ADS.length + ' рекламных кампаний', 'success');
    }).catch(function(e) {
        showToast('❌ Ошибка: ' + e.message, 'error');
    });
}

function clearAdsData() {
    if (!confirm('Удалить все рекламные данные?')) return;
    dbClear('ads').then(function() {
        updateAdsPage();
        showToast('✅ Рекламные данные очищены', 'success');
    });
}

// ============================================================
// РАСЧЁТЫ
// ============================================================

function calculateIO(stock, s30) { if (s30 === 0) return stock > 0 ? 999 : 0; return parseFloat((stock / s30).toFixed(4)); }
function getIOStatus(io) { if (io < 0.2) return { status: 'Дефицит', color: '#EF4444', level: 'critical' }; if (io < 0.5) return { status: 'Недостаток', color: '#F59E0B', level: 'warning' }; if (io < 1.0) return { status: 'Норма', color: '#10B981', level: 'normal' }; if (io < 2.0) return { status: 'Избыток', color: '#3B82F6', level: 'excess' }; return { status: 'Сильный избыток', color: '#8B5CF6', level: 'excess' }; }
function calculateDaysLeft(stock, s30) { var d = s30 / 30; if (d === 0) return 999; return Math.round(stock / d); }
function calculateMargin(price, cost) { if (price === 0) return 0; return parseFloat(((price - cost) / price * 100).toFixed(2)); }

var appSettings = { fboCommission: 15, fbsCommission: 10, storageBaseRate: 0.07, storageOverRate: 0.15, volumePerUnit: 5, taxSystem: 'usn6', patentCost: 30000, targetStockDays: 60, safetyStockDays: 30, productionDays: 14, deliveryDays: 7 };

function loadAppSettings() { return dbGetAll('settings').then(function(d) { d.forEach(function(x) { if (appSettings.hasOwnProperty(x.key)) appSettings[x.key] = x.value; }); return appSettings; }); }

// ============================================================
// ГЛАВНАЯ
// ============================================================

function updateDashboard() {
    loadAppSettings().then(function() { return Promise.all([dbGetAll('sales'), dbGetAll('stock')]); }).then(function(r) {
        if (r[0].length === 0 && r[1].length === 0) { document.getElementById('dashboardEmpty').style.display = 'block'; document.getElementById('dashboardContent').style.display = 'none'; return; }
        document.getElementById('dashboardEmpty').style.display = 'none'; document.getElementById('dashboardContent').style.display = 'block';
        var stats = collectStats(r[0], r[1]); renderKPIs(stats); renderAttentionBlock(stats);
    });
}

function collectStats(sales, stock) {
    var y = getYesterdayStr(), yo = 0, yd = 0, ya = 0, m30 = {}, arts = [], seen = {};
    sales.forEach(function(s) { if (s.date === y) { yo += s.orders || 0; yd += s.delivered || 0; ya += s.amount || 0; } if (!m30[s.article]) m30[s.article] = 0; m30[s.article] += s.orders || 0; if (!seen[s.article]) { seen[s.article] = true; arts.push(s.article); } });
    var prods = []; arts.forEach(function(a) { var info = getProductInfo(a); var ts = getTotalStock(a, stock); var s30 = m30[a] || 0; var io = calculateIO(ts, s30); var ioI = getIOStatus(io); var m = info ? calculateMargin(info.price, info.cost) : 0; prods.push({ article: a, stock: ts, sales30: s30, io: io, ioStatus: ioI.status, ioColor: ioI.color, ioLevel: ioI.level, margin: m, daysLeft: calculateDaysLeft(ts, s30), price: info ? info.price : 0, cost: info ? info.cost : 0 }); });
    return { yesterdayOrders: yo, yesterdayDelivered: yd, yesterdayAmount: ya, productsCount: arts.length, products: prods };
}

function renderKPIs(s) { document.getElementById('kpiProducts').textContent = s.productsCount; document.getElementById('kpiOrders').textContent = s.yesterdayOrders; document.getElementById('kpiDelivered').textContent = s.yesterdayDelivered; var am = 0; if (s.products.length > 0) { var sm = 0; s.products.forEach(function(p) { sm += p.margin; }); am = parseFloat((sm / s.products.length).toFixed(1)); } document.getElementById('kpiAvgMargin').textContent = am + '%'; }

function renderAttentionBlock(s) {
    var c = document.getElementById('attentionBlock'), probs = getProblems(s.products);
    if (probs.length === 0) { c.innerHTML = '<div style="color:#10B981;font-size:13px;">✅ Все показатели в норме</div>'; return; }
    var h = ''; probs.forEach(function(p) { var bg = p.type === 'critical' ? '#FEF2F2' : '#FFFBEB', bd = p.type === 'critical' ? '#EF4444' : '#F59E0B'; h += '<div style="padding:8px 12px;background:' + bg + ';border-left:3px solid ' + bd + ';margin-bottom:6px;border-radius:6px;font-size:13px;"><span style="margin-right:6px;">' + p.icon + '</span>' + p.text + '</div>'; }); c.innerHTML = h;
}

// ============================================================
// ТОВАРЫ
// ============================================================

function updateProductList() {
    Promise.all([dbGetAll('sales'), dbGetAll('stock')]).then(function(r) {
        if (r[0].length === 0 && r[1].length === 0) { document.getElementById('productsEmpty').style.display = 'block'; document.getElementById('productsContent').style.display = 'none'; return; }
        document.getElementById('productsEmpty').style.display = 'none'; document.getElementById('productsContent').style.display = 'block';
        renderGroupedProducts(buildProductList(r[0], r[1]));
    });
}

function buildProductList(sales, stock) {
    var m30 = {}, prods = [], seen = {}; sales.forEach(function(s) { if (!m30[s.article]) m30[s.article] = 0; m30[s.article] += s.orders || 0; });
    sales.forEach(function(s) { if (!seen[s.article]) { seen[s.article] = true; var info = getProductInfo(s.article); var ts = getTotalStock(s.article, stock); var s30 = m30[s.article] || 0; var io = calculateIO(ts, s30); var ioI = getIOStatus(io); var m = info ? calculateMargin(info.price, info.cost) : 0; prods.push({ article: s.article, baseArticle: info ? info.baseArticle : s.article.split('_').slice(0, -2).join('_'), price: info ? info.price : 0, cost: info ? info.cost : 0, category: info ? info.category : 'Товар', margin: m, stock: ts, io: io, ioStatus: ioI.status, ioColor: ioI.color, ioLevel: ioI.level, sales30: s30, daysLeft: calculateDaysLeft(ts, s30) }); } });
    return prods;
}

function renderGroupedProducts(prods) {
    var c = document.getElementById('productsGroupedList'), sq = document.getElementById('productSearch').value.toLowerCase(), fl = document.getElementById('productFilter').value;
    var grps = {}; prods.forEach(function(p) { var b = p.baseArticle || p.article; if (!grps[b]) grps[b] = { baseArticle: b, category: p.category, items: [], totalStock: 0, totalSales30: 0 }; grps[b].items.push(p); grps[b].totalStock += p.stock; grps[b].totalSales30 += p.sales30; });
    var keys = Object.keys(grps).filter(function(k) { var g = grps[k]; if (sq && !g.items.some(function(p) { return p.article.toLowerCase().indexOf(sq) !== -1; })) return false; if (fl === 'profitable' && !g.items.some(function(p) { return p.margin > 20; })) return false; if (fl === 'unprofitable' && !g.items.some(function(p) { return p.margin < 0; })) return false; if (fl === 'deficit' && !g.items.some(function(p) { return p.io < 0.2; })) return false; if (fl === 'lowMargin' && !g.items.some(function(p) { return p.margin > 0 && p.margin <= 20; })) return false; return true; });
    if (keys.length === 0) { c.innerHTML = '<div class="card" style="text-align:center;padding:20px;">Ничего не найдено</div>'; return; }
    var icons = { 'Костюмы': '👔', 'Платья': '👗', 'Жакеты': '🧥', 'Брюки': '👖', 'Свитеры': '🧶', 'Товар': '📦' }, h = '';
    keys.forEach(function(k) { var g = grps[k], icon = icons[g.category] || '📦', margins = g.items.map(function(p) { return p.margin; }), am = parseFloat((margins.reduce(function(a, b) { return a + b; }, 0) / margins.length).toFixed(1)), tio = calculateIO(g.totalStock, g.totalSales30), ioI = getIOStatus(tio), hp = g.items.some(function(p) { return p.ioLevel === 'critical' || p.stock < 5 || p.margin < 0; });
        h += '<div class="product-group"><div class="product-group-header" onclick="toggleGroup(this)"><span class="product-group-icon">' + icon + '</span><div class="product-group-info"><div class="product-group-name">' + g.baseArticle + (hp ? ' ⚠️' : '') + '</div><div class="product-group-category">' + g.category + ' · ' + g.items.length + ' вар.</div></div><div class="product-group-metrics"><div class="product-group-metric"><div class="product-group-metric-label">Маржа</div><div class="product-group-metric-value" style="color:' + (am > 20 ? '#10B981' : am > 0 ? '#F59E0B' : '#EF4444') + ';">' + am + '%</div></div><div class="product-group-metric"><div class="product-group-metric-label">Остаток</div><div class="product-group-metric-value" style="color:' + (g.totalStock < 10 ? '#EF4444' : '#10B981') + ';">' + g.totalStock + '</div></div><div class="product-group-metric"><div class="product-group-metric-label">ИО</div><div class="product-group-metric-value" style="color:' + ioI.color + ';">' + tio.toFixed(2) + '</div></div></div><span class="product-group-arrow">▶</span></div><div class="product-group-items">';
        g.items.forEach(function(p) { var mC = p.margin > 20 ? '#10B981' : p.margin > 0 ? '#F59E0B' : '#EF4444', sC = p.stock < 5 ? '#EF4444' : p.stock < 20 ? '#F59E0B' : '#10B981', si = p.ioLevel === 'critical' || p.stock < 5 ? '🔴' : p.margin < 0 ? '🟡' : ''; h += '<div class="product-group-item" onclick="openProductCard(\'' + p.article + '\')"><span class="product-group-item-name">' + p.article + '</span><span class="product-group-item-price">' + (p.price > 0 ? p.price.toLocaleString('ru-RU') + ' ₽' : '—') + '</span><span class="product-group-item-margin" style="color:' + mC + ';">' + p.margin + '%</span><span class="product-group-item-stock" style="color:' + sC + ';">' + p.stock + ' шт</span><span class="product-group-item-io" style="color:' + p.ioColor + ';">' + p.io.toFixed(2) + '</span><span class="product-group-item-status">' + si + '</span></div>'; });
        h += '</div></div>';
    }); c.innerHTML = h;
}

function toggleGroup(hdr) { var arr = hdr.querySelector('.product-group-arrow'), items = hdr.nextElementSibling; if (items.classList.contains('open')) { items.classList.remove('open'); arr.classList.remove('open'); } else { items.classList.add('open'); arr.classList.add('open'); } }

// ============================================================
// ЗАКАЗЫ
// ============================================================

function updateOrdersPage() { Promise.all([dbGetAll('sales'), dbGetAll('stock')]).then(function(r) { if (r[0].length === 0 && r[1].length === 0) { document.getElementById('ordersEmpty').style.display = 'block'; document.getElementById('ordersContent').style.display = 'none'; return; } document.getElementById('ordersEmpty').style.display = 'none'; document.getElementById('ordersContent').style.display = 'block'; renderOrders(); }); }

function renderOrders() {
    var sq = document.getElementById('ordersSearch').value.toLowerCase(), fl = document.getElementById('ordersFilter').value;
    getAllProducts().then(function(arts) { return Promise.all(arts.map(function(a) { return buildProduct(a); })); }).then(function(prods) {
        var filt = prods.filter(function(p) { if (sq && p.article.toLowerCase().indexOf(sq) === -1) return false; if (fl === 'critical' && p.forecast.urgency !== 'critical') return false; if (fl === 'soon' && p.forecast.urgency !== 'soon') return false; if (fl === 'normal' && p.forecast.urgency !== 'normal') return false; return true; });
        filt.sort(function(a, b) { return a.forecast.daysUntilStockout - b.forecast.daysUntilStockout; });
        renderOrdersSummary(filt); renderOrdersList(filt);
    });
}

function renderOrdersSummary(prods) { var cr = prods.filter(function(p) { return p.forecast.urgency === 'critical'; }).length, sn = prods.filter(function(p) { return p.forecast.urgency === 'soon'; }).length, no = prods.filter(function(p) { return p.forecast.urgency === 'normal'; }).length; document.getElementById('ordersSummary').innerHTML = '<div style="display:flex;gap:14px;"><div class="orders-summary-card critical"><div class="orders-summary-value" style="color:#EF4444;">' + cr + '</div><div class="orders-summary-label">🔴 Срочно</div></div><div class="orders-summary-card soon"><div class="orders-summary-value" style="color:#F59E0B;">' + sn + '</div><div class="orders-summary-label">🟡 Скоро</div></div><div class="orders-summary-card normal"><div class="orders-summary-value" style="color:#10B981;">' + no + '</div><div class="orders-summary-label">🟢 Норма</div></div></div>'; }

function renderOrdersList(prods) { var c = document.getElementById('ordersList'), h = ''; prods.forEach(function(p) { var uc = p.forecast.urgency === 'critical' ? '#EF4444' : p.forecast.urgency === 'soon' ? '#F59E0B' : '#10B981', ul = p.forecast.urgency === 'critical' ? '🔴 Срочно' : p.forecast.urgency === 'soon' ? '🟡 Скоро' : '🟢 Норма'; h += '<div class="product-group"><div class="product-group-header" onclick="toggleGroup(this)"><span class="product-group-icon">📦</span><div class="product-group-info"><div class="product-group-name">' + p.article + '</div><div class="product-group-category">' + p.category + ' · ' + p.model + '</div></div><div class="product-group-metrics"><div class="product-group-metric"><div class="product-group-metric-label">Остаток</div><div class="product-group-metric-value">' + p.stock.total + '</div></div><div class="product-group-metric"><div class="product-group-metric-label">Продаж/д</div><div class="product-group-metric-value">' + p.forecast.dailyDemand.toFixed(1) + '</div></div><div class="product-group-metric"><div class="product-group-metric-label">Дней</div><div class="product-group-metric-value" style="color:' + uc + ';">' + p.forecast.daysUntilStockout + '</div></div><div class="product-group-metric"><div class="product-group-metric-label">Заказ</div><div class="product-group-metric-value">' + p.forecast.recommendedOrder + ' шт</div></div></div><span class="product-group-arrow">▶</span></div><div class="product-group-items"><div style="padding:12px 16px;font-size:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;"><div>WB: <strong>' + p.stock.wb + '</strong></div><div>В пути: <strong>' + p.stock.inTransit + '</strong></div><div>Склад: <strong>' + p.stock.ownWarehouse + '</strong></div><div>Продажи 7д: <strong>' + p.sales.last7days + '</strong></div><div>14д: <strong>' + p.sales.last14days + '</strong></div><div>30д: <strong>' + p.sales.last30days + '</strong></div><div>Маржа: <strong>' + p.metrics.margin + '%</strong></div><div>Цена: <strong>' + p.sellingPrice.toLocaleString('ru-RU') + ' ₽</strong></div><div style="color:' + uc + ';">' + ul + '</div></div></div></div>'; }); c.innerHTML = h || '<div class="card" style="text-align:center;padding:20px;">Нет данных</div>'; }

// ============================================================
// РЕКЛАМА — ОСНОВНЫЕ ФУНКЦИИ
// ============================================================

function updateAdsPage() {
    dbGetAll('ads').then(function(ads) {
        if (ads.length === 0) {
            document.getElementById('adsEmpty').style.display = 'block';
            document.getElementById('adsContent').style.display = 'none';
            return;
        }
        document.getElementById('adsEmpty').style.display = 'none';
        document.getElementById('adsContent').style.display = 'block';
        renderAds();
    });
}

function recalculateAdsROI() {
    return Promise.all([dbGetAll('ads'), getAllProducts(), loadAppSettings()]).then(function(r) {
        var ads = r[0], allArticles = r[1], settings = r[2];
        var promises = [];
        ads.forEach(function(ad) {
            if (!ad.linkedArticle) {
                ad._roi = 0;
                ad._drr = 0;
                ad._trend = ad._trend || 0;
                promises.push(dbSave('ads', ad));
                return;
            }
            var prod = null;
            for (var i = 0; i < allArticles.length; i++) {
                if (allArticles[i] === ad.linkedArticle) {
                    var info = getProductInfo(ad.linkedArticle);
                    prod = { article: ad.linkedArticle, price: info.price, cost: info.cost };
                    break;
                }
            }
            if (!prod) {
                ad._roi = 0;
                ad._drr = 0;
                ad._trend = ad._trend || 0;
                promises.push(dbSave('ads', ad));
                return;
            }
            var price = prod.price || 0;
            var cost = prod.cost || 0;
            var fboComm = settings.fboCommission || 15;
            var comm = price * (fboComm / 100);
            var log = 150;
            var storage = 0.07 * 5 * 30;
            var ret = price * 0.05;
            var profitPerUnit = price - comm - log - storage - cost - ret;
            
            var revenue = (ad.orders_from_ad || 0) * price;
            var spent = ad.spent || 0;
            var totalProfit = (ad.orders_from_ad || 0) * profitPerUnit;
            ad._roi = spent > 0 ? Math.round((totalProfit - spent) / spent * 100) : 0;
            ad._drr = revenue > 0 ? Math.round((spent / revenue) * 100) : 0;
            ad._trend = ad._trend || 0;
            promises.push(dbSave('ads', ad));
        });
        return Promise.all(promises);
    });
}

// ============================================================
// РЕКЛАМА — ОТРИСОВКА ТАБЛИЦЫ
// ============================================================

function renderAds() {
    var sq = document.getElementById('adsSearch').value.toLowerCase();
    var fl = document.getElementById('adsFilter').value;
    var sort = document.getElementById('adsSort').value;
    
    recalculateAdsROI().then(function() {
        Promise.all([dbGetAll('ads'), getAllProducts()]).then(function(r) {
            var ads = r[0], allArticles = r[1];
            
            // Фильтрация
            var filt = ads.filter(function(a) {
                var name = (a.campaign || '').toLowerCase();
                if (sq && name.indexOf(sq) === -1 && (a.linkedArticle || '').toLowerCase().indexOf(sq) === -1) return false;
                if (fl === 'unlinked' && a.linkedArticle) return false;
                if (fl === 'linked' && !a.linkedArticle) return false;
                if (fl === 'effective' && a._roi < 50) return false;
                if (fl === 'loss' && a._roi >= 0) return false;
                if (fl === 'active' && a.status !== 'active') return false;
                if (fl === 'paused' && a.status !== 'paused') return false;
                return true;
            });
            
            // Сортировка
            filt.sort(function(a, b) {
                switch(sort) {
                    case 'roi_asc': return (a._roi || 0) - (b._roi || 0);
                    case 'spent_desc': return (b.spent || 0) - (a.spent || 0);
                    case 'orders_desc': return (b.orders_from_ad || 0) - (a.orders_from_ad || 0);
                    case 'ctr_desc': return (b.ctr || 0) - (a.ctr || 0);
                    default: return (b._roi || 0) - (a._roi || 0);
                }
            });
            
            adsDataCache = filt;
            renderAdsSummary(filt);
            renderAdsTable(filt);
            renderAdsPagination(filt.length);
        });
    });
}

function renderAdsSummary(ads) {
    var totalSpent = ads.reduce(function(s, a) { return s + (a.spent || 0); }, 0);
    var totalOrders = ads.reduce(function(s, a) { return s + (a.orders_from_ad || 0); }, 0);
    var totalImpressions = ads.reduce(function(s, a) { return s + (a.impressions || 0); }, 0);
    var totalClicks = ads.reduce(function(s, a) { return s + (a.clicks || 0); }, 0);
    var avgRoi = ads.length > 0 ? Math.round(ads.reduce(function(s, a) { return s + (a._roi || 0); }, 0) / ads.length) : 0;
    
    var active = ads.filter(function(a) { return a.status === 'active'; }).length;
    var paused = ads.filter(function(a) { return a.status === 'paused'; }).length;
    var effective = ads.filter(function(a) { return a._roi > 50; }).length;
    var loss = ads.filter(function(a) { return a._roi < 0; }).length;
    
    // Топ-3 лучшие и худшие
    var sorted = ads.slice().sort(function(a, b) { return (b._roi || 0) - (a._roi || 0); });
    var best = sorted.filter(function(a) { return a._roi > 0; }).slice(0, 3);
    var worst = sorted.slice().reverse().filter(function(a) { return a._roi < 0; }).slice(0, 3);
    
    var h = '<div class="ads-summary-grid">';
    h += '<div class="ads-summary-item"><div class="value">' + ads.length + '</div><div class="label">Всего кампаний</div></div>';
    h += '<div class="ads-summary-item"><div class="value">' + totalSpent.toLocaleString() + ' ₽</div><div class="label">Общие затраты</div></div>';
    h += '<div class="ads-summary-item"><div class="value">' + totalOrders + '</div><div class="label">Всего заказов</div></div>';
    h += '<div class="ads-summary-item"><div class="value" style="color:' + (avgRoi > 0 ? '#10B981' : '#EF4444') + ';">' + avgRoi + '%</div><div class="label">Средний ROI</div></div>';
    h += '<div class="ads-summary-item"><div class="value">🟢 ' + active + ' ⏸️ ' + paused + '</div><div class="label">Активные / Приостановлены</div></div>';
    h += '<div class="ads-summary-item"><div class="value">📈 ' + effective + ' 📉 ' + loss + '</div><div class="label">Эффективные / Убыточные</div></div>';
    h += '</div>';
    
    // Топ-3 (компактно, без перегруза)
    if (best.length > 0 || worst.length > 0) {
        h += '<div style="display:flex;gap:16px;margin-top:10px;font-size:11px;flex-wrap:wrap;">';
        if (best.length > 0) {
            h += '<div><span style="color:#10B981;">🏆 Лучшие:</span> ';
            best.forEach(function(a, i) {
                h += '<span style="background:rgba(16,185,129,0.15);padding:2px 8px;border-radius:10px;margin:2px;">' + (a.campaign || '—').substring(0, 20) + ' (' + a._roi + '%)</span>';
                if (i < best.length - 1) h += ' ';
            });
            h += '</div>';
        }
        if (worst.length > 0) {
            h += '<div><span style="color:#EF4444;">📉 Худшие:</span> ';
            worst.forEach(function(a, i) {
                h += '<span style="background:rgba(239,68,68,0.15);padding:2px 8px;border-radius:10px;margin:2px;">' + (a.campaign || '—').substring(0, 20) + ' (' + a._roi + '%)</span>';
                if (i < worst.length - 1) h += ' ';
            });
            h += '</div>';
        }
        h += '</div>';
    }
    
    document.getElementById('adsSummary').innerHTML = h;
}

function renderAdsTable(ads) {
    var start = (adsCurrentPage - 1) * adsPerPage;
    var end = Math.min(start + adsPerPage, ads.length);
    var pageAds = ads.slice(start, end);
    var tbody = document.getElementById('adsTableBody');
    
    if (pageAds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:20px;color:#9CA3AF;">Нет кампаний</td></tr>';
        return;
    }
    
    var h = '';
    pageAds.forEach(function(a) {
        var roi = a._roi || 0;
        var drr = a._drr || 0;
        var roiColor = roi > 50 ? '#10B981' : roi > 0 ? '#F59E0B' : '#EF4444';
        var statusText = a.status === 'active' ? '🟢 Активна' : '⏸️ Приостановлена';
        var statusClass = a.status === 'active' ? 'status-active' : 'status-paused';
        
        // Тренд
        var trend = a._trend || 0;
        var trendHtml = trend > 0 ? '<span class="trend-up">▲ +' + trend + '%</span>' : 
                        trend < 0 ? '<span class="trend-down">▼ ' + trend + '%</span>' : 
                        '<span class="trend-flat">↔ 0%</span>';
        
        var linkedLabel = a.linkedArticle || '—';
        var linkedColor = a.linkedArticle ? '#10B981' : '#F59E0B';
        
        h += '<tr>';
        h += '<td><input type="checkbox" class="ads-checkbox" data-id="' + a.id + '" onchange="toggleAdSelect(this)"></td>';
        h += '<td><strong>' + (a.campaign || 'Без названия') + '</strong><br><span style="font-size:10px;color:' + linkedColor + ';">' + linkedLabel + '</span></td>';
        h += '<td>' + (a.type || '—') + '</td>';
        h += '<td class="' + statusClass + '">' + statusText + '</td>';
        h += '<td>' + (a.spent || 0).toLocaleString() + ' ₽</td>';
        h += '<td>' + (a.impressions || 0).toLocaleString() + '</td>';
        h += '<td>' + (a.ctr || 0).toFixed(2) + '%</td>';
        h += '<td>' + (a.orders_from_ad || 0) + '</td>';
        h += '<td style="color:' + roiColor + ';font-weight:600;">' + roi + '%</td>';
        h += '<td>' + drr + '%</td>';
        h += '<td>' + trendHtml + '</td>';
        h += '<td style="white-space:nowrap;">';
        h += '<button class="btn btn-xs btn-secondary" onclick="editCampaign(' + a.id + ')" title="Редактировать">✏️</button> ';
        h += '<button class="btn btn-xs ' + (a.status === 'active' ? 'btn-warning' : 'btn-success') + '" onclick="toggleCampaignStatus(' + a.id + ')" title="' + (a.status === 'active' ? 'Приостановить' : 'Запустить') + '">' + (a.status === 'active' ? '⏸️' : '▶️') + '</button> ';
        h += '<button class="btn btn-xs btn-danger" onclick="deleteCampaign(' + a.id + ')" title="Удалить">🗑️</button>';
        h += '</td>';
        h += '</tr>';
    });
    tbody.innerHTML = h;
    
    // Обновляем информацию о пагинации
    document.getElementById('adsShowing').textContent = pageAds.length;
    document.getElementById('adsTotal').textContent = ads.length;
    var totalPages = Math.ceil(ads.length / adsPerPage) || 1;
    document.getElementById('adsPageInfo').textContent = adsCurrentPage + ' / ' + totalPages;
}

function renderAdsPagination(total) {
    var totalPages = Math.ceil(total / adsPerPage) || 1;
    if (adsCurrentPage > totalPages) adsCurrentPage = totalPages;
    document.getElementById('adsPageInfo').textContent = adsCurrentPage + ' / ' + totalPages;
    document.getElementById('adsShowing').textContent = Math.min(adsPerPage, total - (adsCurrentPage - 1) * adsPerPage);
    document.getElementById('adsTotal').textContent = total;
}

function adsPrevPage() {
    if (adsCurrentPage > 1) { adsCurrentPage--; renderAds(); }
}

function adsNextPage() {
    var total = adsDataCache.length;
    var totalPages = Math.ceil(total / adsPerPage) || 1;
    if (adsCurrentPage < totalPages) { adsCurrentPage++; renderAds(); }
}

// ============================================================
// РЕКЛАМА — УПРАВЛЕНИЕ КАМПАНИЯМИ
// ============================================================

function toggleAdSelect(checkbox) {
    var id = parseInt(checkbox.getAttribute('data-id'));
    if (checkbox.checked) {
        if (selectedAds.indexOf(id) === -1) selectedAds.push(id);
    } else {
        selectedAds = selectedAds.filter(function(x) { return x !== id; });
    }
    // Обновляем "выбрать всё"
    var allCheckboxes = document.querySelectorAll('.ads-checkbox');
    var allChecked = true;
    allCheckboxes.forEach(function(cb) {
        if (!cb.checked) allChecked = false;
    });
    var selectAll = document.getElementById('adsSelectAll');
    if (selectAll) selectAll.checked = allChecked && allCheckboxes.length > 0;
}

function toggleAllAds(selectAll) {
    var checkboxes = document.querySelectorAll('.ads-checkbox');
    checkboxes.forEach(function(cb) {
        cb.checked = selectAll.checked;
        if (selectAll.checked) {
            var id = parseInt(cb.getAttribute('data-id'));
            if (selectedAds.indexOf(id) === -1) selectedAds.push(id);
        } else {
            var id = parseInt(cb.getAttribute('data-id'));
            selectedAds = selectedAds.filter(function(x) { return x !== id; });
        }
    });
}

function applyBulkAction() {
    if (selectedAds.length === 0) {
        showToast('❌ Выберите хотя бы одну кампанию', 'error');
        return;
    }
    var action = confirm('Выбрано ' + selectedAds.length + ' кампаний. Применить массовое действие?\n\n' +
                         'Нажмите "OK" для приостановки всех выбранных.\n' +
                         'Нажмите "Отмена" для удаления всех выбранных.');
    
    if (action) {
        // Приостановить все
        dbGetAll('ads').then(function(ads) {
            var promises = [];
            ads.forEach(function(a) {
                if (selectedAds.indexOf(a.id) !== -1) {
                    a.status = 'paused';
                    promises.push(dbSave('ads', a));
                }
            });
            return Promise.all(promises);
        }).then(function() {
            selectedAds = [];
            renderAds();
            showToast('✅ Выбранные кампании приостановлены', 'success');
        });
    } else {
        // Удалить все
        if (!confirm('Удалить выбранные кампании?')) return;
        dbGetAll('ads').then(function(ads) {
            var promises = [];
            ads.forEach(function(a) {
                if (selectedAds.indexOf(a.id) !== -1) {
                    promises.push(dbDelete('ads', a.id));
                }
            });
            return Promise.all(promises);
        }).then(function() {
            selectedAds = [];
            renderAds();
            showToast('✅ Выбранные кампании удалены', 'success');
        });
    }
}

function toggleCampaignStatus(id) {
    dbGetAll('ads').then(function(ads) {
        var ad = null;
        ads.forEach(function(a) { if (a.id === id) ad = a; });
        if (!ad) return;
        ad.status = ad.status === 'active' ? 'paused' : 'active';
        return dbSave('ads', ad);
    }).then(function() {
        renderAds();
        showToast('✅ Статус обновлён', 'success');
    });
}

function deleteCampaign(id) {
    if (!confirm('Удалить кампанию?')) return;
    dbDelete('ads', id).then(function() {
        renderAds();
        showToast('✅ Кампания удалена', 'success');
    });
}

// ============================================================
// РЕКЛАМА — СОЗДАНИЕ КАМПАНИИ
// ============================================================

function openCreateCampaignModal() {
    document.getElementById('campaignModal').style.display = 'flex';
    document.getElementById('campaignName').value = '';
    document.getElementById('campaignArticle').value = '';
    document.getElementById('campaignBudget').value = 5000;
    document.getElementById('campaignDailyLimit').value = 1000;
    document.getElementById('campaignCpc').value = 35;
    document.getElementById('campaignTargetRoi').value = 50;
    document.getElementById('campaignType').value = 'Аукцион';
    document.getElementById('campaignStatus').value = 'active';
    document.getElementById('campaignArticleList').style.display = 'none';
}

function closeCampaignModal() {
    document.getElementById('campaignModal').style.display = 'none';
}

function createCampaign() {
    var name = document.getElementById('campaignName').value.trim();
    if (!name) { showToast('❌ Введите название кампании', 'error'); return; }
    
    var article = document.getElementById('campaignArticle').value.trim();
    var budget = parseFloat(document.getElementById('campaignBudget').value) || 0;
    var dailyLimit = parseFloat(document.getElementById('campaignDailyLimit').value) || 0;
    var cpc = parseFloat(document.getElementById('campaignCpc').value) || 0;
    var type = document.getElementById('campaignType').value;
    var status = document.getElementById('campaignStatus').value;
    
    var ad = {
        id: Date.now() + Math.random(),
        campaign: name,
        type: type,
        wbId: 'manual_' + Date.now(),
        impressions: 0,
        clicks: 0,
        cpc: cpc,
        ctr: 0,
        cr: 0,
        spent: 0,
        orders_from_ad: 0,
        linkedArticle: article || null,
        status: status,
        budget: budget,
        dailyLimit: dailyLimit,
        _roi: 0,
        _drr: 0,
        _trend: 0,
        created: getYesterdayStr()
    };
    
    dbSave('ads', ad).then(function() {
        closeCampaignModal();
        renderAds();
        showToast('✅ Кампания создана', 'success');
    });
}

// ============================================================
// РЕКЛАМА — РЕДАКТИРОВАНИЕ КАМПАНИИ
// ============================================================

var editCampaignId = null;

function editCampaign(id) {
    editCampaignId = id;
    dbGetAll('ads').then(function(ads) {
        var ad = null;
        ads.forEach(function(a) { if (a.id === id) ad = a; });
        if (!ad) return;
        
        document.getElementById('editCampaignName').value = ad.campaign || '';
        document.getElementById('editCampaignStatus').value = ad.status || 'active';
        document.getElementById('editCampaignCpc').value = ad.cpc || 0;
        document.getElementById('editCampaignBudget').value = ad.budget || 0;
        document.getElementById('editCampaignDailyLimit').value = ad.dailyLimit || 0;
        
        document.getElementById('editCampaignModal').style.display = 'flex';
    });
}

function closeEditCampaignModal() {
    document.getElementById('editCampaignModal').style.display = 'none';
    editCampaignId = null;
}

function saveEditCampaign() {
    if (!editCampaignId) return;
    
    var name = document.getElementById('editCampaignName').value.trim();
    if (!name) { showToast('❌ Введите название', 'error'); return; }
    
    var status = document.getElementById('editCampaignStatus').value;
    var cpc = parseFloat(document.getElementById('editCampaignCpc').value) || 0;
    var budget = parseFloat(document.getElementById('editCampaignBudget').value) || 0;
    var dailyLimit = parseFloat(document.getElementById('editCampaignDailyLimit').value) || 0;
    
    dbGetAll('ads').then(function(ads) {
        var ad = null;
        ads.forEach(function(a) { if (a.id === editCampaignId) ad = a; });
        if (!ad) return;
        
        ad.campaign = name;
        ad.status = status;
        ad.cpc = cpc;
        ad.budget = budget;
        ad.dailyLimit = dailyLimit;
        
        return dbSave('ads', ad);
    }).then(function() {
        closeEditCampaignModal();
        renderAds();
        showToast('✅ Кампания обновлена', 'success');
    });
}

// ============================================================
// РЕКЛАМА — ПРИВЯЗКА ТОВАРА (обновлённая)
// ============================================================

function filterArticleSuggestions(inputId, listId) {
    var input = document.getElementById(inputId);
    var list = document.getElementById(listId || inputId + '_list');
    if (!input || !list) return;
    var q = input.value.toLowerCase();
    if (q.length < 1) { list.style.display = 'none'; return; }
    getAllProducts().then(function(arts) {
        var matches = arts.filter(function(a) {
            return a.toLowerCase().indexOf(q) !== -1;
        }).slice(0, 8);
        if (matches.length === 0) { list.style.display = 'none'; return; }
        var h = '';
        matches.forEach(function(m) {
            h += '<div onclick="document.getElementById(\'' + inputId + '\').value=\'' + m + '\';document.getElementById(\'' + (listId || inputId + '_list') + '\').style.display=\'none\';">' + m + '</div>';
        });
        list.innerHTML = h;
        list.style.display = 'block';
        var rect = input.getBoundingClientRect();
        var left = Math.min(rect.left, window.innerWidth - 300);
        var top = Math.min(rect.bottom + 4, window.innerHeight - 200);
        list.style.position = 'fixed';
        list.style.left = left + 'px';
        list.style.top = top + 'px';
        list.style.width = Math.min(rect.width, 300) + 'px';
        list.style.maxHeight = '150px';
        list.style.overflowY = 'auto';
        list.style.background = '#1E1E32';
        list.style.border = '1px solid #2A2A42';
        list.style.borderRadius = '6px';
        list.style.zIndex = '100';
        list.style.boxShadow = '0 4px 12px rgba(0,0,0,0.4)';
        list.style.color = '#F0F0FF';
    });
}

// Новая версия привязки для таблицы
function linkAdToArticle(adId) {
    var input = document.getElementById('adLink_' + adId);
    if (!input) return;
    var article = input.value.trim();
    if (!article) { showToast('❌ Введите артикул', 'error'); return; }
    dbGetAll('ads').then(function(ads) {
        var ad = null;
        ads.forEach(function(a) { if (a.id === adId) ad = a; });
        if (!ad) return;
        ad.linkedArticle = article;
        return dbSave('ads', ad);
    }).then(function() {
        return recalculateAdsROI();
    }).then(function() {
        renderAds();
        showToast('✅ Товар привязан', 'success');
    });
}

// ============================================================
// ПОСТАВКИ
// ============================================================

function updateSuppliesPage() { renderSupplyCart(); renderSupplyHistory(); }

function addToSupplyCart() { var a = document.getElementById('supplyArticle').value.trim(), s = document.getElementById('supplySize').value.trim(), q = parseInt(document.getElementById('supplyQty').value) || 1, p = document.getElementById('supplyPallet').value.trim(); if (!a) { showToast('❌ Введите артикул', 'error'); return; } supplyCart.push({ article: a, size: s, quantity: q, pallet: p || 'Без паллеты' }); document.getElementById('supplyArticle').value = ''; document.getElementById('supplySize').value = ''; document.getElementById('supplyQty').value = '1'; document.getElementById('supplyPallet').value = ''; renderSupplyCart(); showToast('✅ Товар добавлен', 'success'); }

function removeFromSupplyCart(i) { supplyCart.splice(i, 1); renderSupplyCart(); }

function renderSupplyCart() { var c = document.getElementById('supplyCart'), tp = 0; supplyCart.forEach(function(x) { tp += x.quantity; }); document.getElementById('supplyPlaces').textContent = tp; document.getElementById('supplyWeight').textContent = (tp * 0.5).toFixed(1) + ' кг'; document.getElementById('supplyVolume').textContent = (tp * 5) + ' л'; if (supplyCart.length === 0) { c.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:20px;">Корзина пуста</div>'; return; } var h = ''; supplyCart.forEach(function(x, i) { h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;"><span style="flex:1;">' + x.article + '</span><span style="width:50px;text-align:center;">' + (x.size || '—') + '</span><span style="width:50px;text-align:center;">' + x.quantity + '</span><span style="width:80px;text-align:center;font-size:10px;">' + x.pallet + '</span><button class="btn btn-danger btn-sm" onclick="removeFromSupplyCart(' + i + ')" style="padding:2px 6px;font-size:10px;">✕</button></div>'; }); c.innerHTML = h; }

function createSupply() { if (supplyCart.length === 0) { showToast('❌ Корзина пуста', 'error'); return; } var tp = 0; supplyCart.forEach(function(x) { tp += x.quantity; }); var s = { id: Date.now(), name: 'Поставка #' + new Date().toISOString().slice(0, 10).replace(/-/g, ''), date: getYesterdayStr(), items: supplyCart.length, places: tp, weight: tp * 0.5, volume: tp * 5, status: 'planned', cart: JSON.parse(JSON.stringify(supplyCart)) }; dbSave('shipments', s).then(function() { supplyCart = []; renderSupplyCart(); renderSupplyHistory(); showToast('✅ Поставка создана', 'success'); }); }

function updateSupplyStatus(id, ns) { dbGetAll('shipments').then(function(ss) { var s = null; ss.forEach(function(x) { if (x.id === id) s = x; }); if (!s) return; s.status = ns; return dbSave('shipments', s); }).then(function() { renderSupplyHistory(); showToast('✅ Статус обновлён', 'success'); }); }

function renderSupplyHistory() { var tb = document.getElementById('supplyHistoryBody'); dbGetAll('shipments').then(function(ss) { if (ss.length === 0) { tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">Нет поставок</td></tr>'; return; } ss.sort(function(a, b) { return b.id - a.id; }); var sl = { 'planned': '📋 Запланировано', 'in_transit': '🚛 В пути', 'accepted': '✅ Принято', 'archive': '📦 Архив' }, h = ''; ss.forEach(function(s) { h += '<tr><td>' + (s.date || '—') + '</td><td>' + s.name + '</td><td>' + s.items + '</td><td>' + s.places + '</td><td>' + (sl[s.status] || s.status) + '</td><td>'; if (s.status === 'planned') h += '<button class="btn btn-primary btn-sm" onclick="updateSupplyStatus(' + s.id + ',\'in_transit\')" style="font-size:10px;padding:2px 8px;">🚛 В путь</button> '; if (s.status === 'in_transit') h += '<button class="btn btn-success btn-sm" onclick="updateSupplyStatus(' + s.id + ',\'accepted\')" style="font-size:10px;padding:2px 8px;">✅ Принято</button> '; if (s.status === 'accepted') h += '<button class="btn btn-secondary btn-sm" onclick="updateSupplyStatus(' + s.id + ',\'archive\')" style="font-size:10px;padding:2px 8px;">📦 Архив</button>'; h += '</td></tr>'; }); tb.innerHTML = h; }); }

function exportSupplyForWB() { if (supplyCart.length === 0) { showToast('❌ Корзина пуста', 'error'); return; } var data = supplyCart.map(function(x) { return { 'Артикул продавца': x.article, 'Размер': x.size || '', 'Количество': x.quantity, 'Номер палеты': x.pallet || 'Без паллеты' }; }); var wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(data); ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 18 }]; XLSX.utils.book_append_sheet(wb, ws, 'Поставка_WB'); XLSX.writeFile(wb, 'StockFlow_Поставка_WB_' + getYesterdayStr().replace(/\./g, '_') + '.xlsx'); showToast('✅ Файл для WB готов', 'success'); }

function exportSupplyPackingList() { if (supplyCart.length === 0) { showToast('❌ Корзина пуста', 'error'); return; } var grp = {}; supplyCart.forEach(function(x) { var p = x.pallet || 'Без паллеты'; if (!grp[p]) grp[p] = []; grp[p].push(x); }); var data = []; Object.keys(grp).sort().forEach(function(p) { data.push({ 'Паллета': p, 'Артикул': '', 'Размер': '', 'Количество': '', 'Проклеить?': '' }); grp[p].forEach(function(x) { data.push({ 'Паллета': '', 'Артикул': x.article, 'Размер': x.size || '', 'Количество': x.quantity, 'Проклеить?': '☐' }); }); data.push({ 'Паллета': '', 'Артикул': '', 'Размер': '', 'Количество': '', 'Проклеить?': '' }); }); var wb = XLSX.utils.book_new(), ws = XLSX.utils.json_to_sheet(data); ws['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 12 }]; XLSX.utils.book_append_sheet(wb, ws, 'Сборочный_лист'); XLSX.writeFile(wb, 'StockFlow_Сборочный_лист_' + getYesterdayStr().replace(/\./g, '_') + '.xlsx'); showToast('✅ Сборочный лист готов', 'success'); }

function addFromWarehouseToSupply() {
    dbGetAll('warehouse').then(function(items) {
        var active = items.filter(function(i) { return i.type === 'item' && i.status === 'active' && i.warehouse === currentWarehouse; });
        if (active.length === 0) { showToast('❌ Нет товаров на складе', 'error'); return; }
        var msg = 'Товары на складе (' + currentWarehouse + '):\n\n', grouped = {}; active.forEach(function(i) { var key = i.article + ' | ' + i.color + ' | ' + i.size; if (!grouped[key]) grouped[key] = { article: i.article, color: i.color, size: i.size, qty: 0, pallet: i.pallet, box: i.box }; grouped[key].qty += i.quantity || 0; });
        Object.keys(grouped).forEach(function(k, idx) { var g = grouped[k]; msg += (idx + 1) + '. ' + g.article + ' ' + g.color + ' ' + g.size + ' — ' + g.qty + ' шт (пал.' + g.pallet + ', ' + g.box + ')\n'; });
        msg += '\nВведите номер товара и количество через запятую (например: 1,20):'; var input = prompt(msg); if (!input) return;
        var parts = input.split(','), idx = parseInt(parts[0]) - 1, qty = parseInt(parts[1]) || 1;
        if (idx < 0 || idx >= Object.keys(grouped).length) { showToast('❌ Неверный номер', 'error'); return; }
        var g = grouped[Object.keys(grouped)[idx]]; supplyCart.push({ article: g.article, size: g.size, quantity: qty, pallet: 'Склад ' + g.pallet }); renderSupplyCart(); showToast('✅ Добавлено: ' + g.article + ' x' + qty, 'success');
    });
}

// ============================================================
// КАРТОЧКА ТОВАРА
// ============================================================

function openProductCard(article) {
    currentCardArticle = article; document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); }); document.getElementById('page-product-card').classList.add('active');
    var bc = document.getElementById('backContext'), cp = ''; document.querySelectorAll('.menu-item.active').forEach(function(x) { cp = x.getAttribute('data-page'); });
    if (cp === 'orders') bc.textContent = 'из Заказов'; else if (cp === 'supplies') bc.textContent = 'из Поставок'; else if (cp === 'warehouse') bc.textContent = 'из Склада'; else if (cp === 'ads') bc.textContent = 'из Рекламы'; else bc.textContent = 'из Товаров';
    Promise.all([dbGetAll('sales'), dbGetAll('stock'), loadAppSettings()]).then(function(r) {
        var sales = r[0], stock = r[1], info = getProductInfo(article); if (!info) return;
        var aSales = sales.filter(function(s) { return s.article === article; }), aStock = stock.filter(function(s) { return s.article === article; });
        var ts = getTotalStock(article, aStock), s30 = getSales30(article, sales), io = calculateIO(ts, s30), ioI = getIOStatus(io), m = calculateMargin(info.price, info.cost), dl = calculateDaysLeft(ts, s30);
        var icons = { 'Костюмы': '👔', 'Платья': '👗', 'Жакеты': '🧥', 'Брюки': '👖', 'Свитеры': '🧶', 'Товар': '📦' };
        document.getElementById('cardCategoryIcon').textContent = icons[info.category] || '📦'; document.getElementById('cardTitle').textContent = article; document.getElementById('cardSubtitle').textContent = info.category + ' · FBO';
        var st = '🟢 Стабильно', sbg = 'rgba(16,185,129,0.15)', sc = '#10B981'; if (ioI.level === 'critical' || ts < 5) { st = '🔴 Проблема'; sbg = 'rgba(239,68,68,0.15)'; sc = '#EF4444'; } else if (ioI.level === 'warning' || m < 0) { st = '🟡 Внимание'; sbg = 'rgba(245,158,11,0.15)'; sc = '#F59E0B'; }
        var badge = document.getElementById('cardStatusBadge'); badge.textContent = st; badge.style.background = sbg; badge.style.color = sc;
        document.getElementById('cardKpiPrice').textContent = info.price.toLocaleString('ru-RU') + ' ₽'; var me = document.getElementById('cardKpiMargin'); me.textContent = m + '%'; me.style.color = m > 20 ? '#10B981' : m > 0 ? '#F59E0B' : '#EF4444';
        var se = document.getElementById('cardKpiStock'); se.textContent = ts + ' шт'; se.style.color = ts < 5 ? '#EF4444' : ts < 20 ? '#F59E0B' : '#10B981';
        var ie = document.getElementById('cardKpiIO'); ie.textContent = io.toFixed(2); ie.style.color = ioI.color;
        renderCardChart(aSales, 7); renderCardSalesTab(aSales); renderCardStockTab(aStock, ts, dl, s30); renderCardEconomicsTab(info, ts, s30);
    });
}

function closeProductCard() { currentCardArticle = null; if (cardChart) { cardChart.destroy(); cardChart = null; } var bc = document.getElementById('backContext'); if (bc.textContent.indexOf('Заказов') !== -1) navigateTo('orders'); else if (bc.textContent.indexOf('Поставок') !== -1) navigateTo('supplies'); else if (bc.textContent.indexOf('Склада') !== -1) navigateTo('warehouse'); else if (bc.textContent.indexOf('Рекламы') !== -1) navigateTo('ads'); else navigateTo('products'); }

function renderCardChart(sales, days) { var cv = document.getElementById('cardSalesChart'); if (!cv) return; if (cardChart) { cardChart.destroy(); cardChart = null; } var today = new Date(), lbs = [], od = [], dd = []; for (var i = days - 1; i >= 0; i--) { var d = new Date(today); d.setDate(d.getDate() - i); var ds = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); lbs.push(ds); var oo = 0, dv = 0; sales.forEach(function(s) { if (s.date === ds) { oo += s.orders || 0; dv += s.delivered || 0; } }); od.push(oo); dd.push(dv); } cardChart = new Chart(cv.getContext('2d'), { type: 'line', data: { labels: lbs, datasets: [{ label: 'Заказы', data: od, borderColor: '#A78BFA', backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 2 }, { label: 'Выкупы', data: dd, borderColor: '#10B981', borderWidth: 2, borderDash: [4, 3], fill: false, tension: 0.3, pointRadius: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#9CA3AF', usePointStyle: true, padding: 15, font: { size: 11 } } } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9CA3AF', font: { size: 10 } } }, x: { grid: { display: false }, ticks: { color: '#9CA3AF', font: { size: 9 }, maxTicksLimit: 10 } } } } }); }

function renderCardSalesTab(sales) { var srt = sales.slice().sort(function(a, b) { return b.date.localeCompare(a.date); }), tb = document.getElementById('cardSalesHistory'); if (srt.length === 0) { tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Нет данных</td></tr>'; } else { var h = ''; srt.slice(0, 30).forEach(function(s) { h += '<tr><td>' + s.date + '</td><td>' + s.orders + '</td><td>' + s.delivered + '</td><td>' + (s.returns || 0) + '</td><td>' + (s.orders > 0 ? Math.round((s.delivered / s.orders) * 100) : 0) + '%</td></tr>'; }); tb.innerHTML = h; } var today = new Date(), wa = new Date(today), twa = new Date(today); wa.setDate(wa.getDate() - 7); twa.setDate(twa.getDate() - 14); var tw = 0, pw = 0; sales.forEach(function(s) { var p = s.date.split('.'), sd = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])); if (sd >= wa) tw += s.orders || 0; else if (sd >= twa && sd < wa) pw += s.orders || 0; }); var ce = document.getElementById('cardSalesCompare'); if (pw > 0) { var ch = Math.round(((tw - pw) / pw) * 100); ce.innerHTML = 'Эта неделя: <strong>' + tw + '</strong> заказов <span style="color:' + (ch > 0 ? '#10B981' : '#EF4444') + ';">' + (ch > 0 ? '▲' : '▼') + ' ' + Math.abs(ch) + '%</span> к прошлой'; } else ce.textContent = 'Эта неделя: ' + tw + ' заказов'; }

function renderCardStockTab(stock, ts, dl, s30) { var tb = document.getElementById('cardStockTable'); if (stock.length === 0) { tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Нет данных</td></tr>'; } else { var h = ''; stock.forEach(function(s) { h += '<tr><td>' + (s.warehouse || '—') + '</td><td style="font-weight:600;">' + (s.available || 0) + '</td><td>' + (s.inTransit || 0) + '</td><td>' + (s.returns || 0) + '</td><td>' + (s.available < 5 ? '🔴 Мало' : '🟡 Норма') + '</td></tr>'; }); tb.innerHTML = h; } var fe = document.getElementById('cardStockForecast'), ds = s30 / 30; if (ts === 0) fe.innerHTML = '<span style="color:#EF4444;">❌ Товар отсутствует</span>'; else if (dl <= 3) fe.innerHTML = '<span style="color:#EF4444;">⚠️ Остатка на <strong>' + dl + ' дн</strong></span>'; else if (dl <= 7) fe.innerHTML = '<span style="color:#F59E0B;">🟡 Остатка на <strong>' + dl + ' дн</strong></span>'; else fe.innerHTML = '<span style="color:#10B981;">✅ Остатка на <strong>' + dl + ' дн</strong></span>'; }

function renderCardEconomicsTab(info, ts, s30) { var p = info.price, cst = info.cost, comm = Math.round(p * appSettings.fboCommission / 100), log = 150, stor = Math.round(appSettings.storageBaseRate * appSettings.volumePerUnit * 30), ret = Math.round(p * 0.05), prof = p - comm - log - stor - cst - ret, tax = Math.round(p * 0.06), np = prof - tax, tm = parseFloat(((np / p) * 100).toFixed(1)); var be = document.getElementById('cardEconomicsBreakdown'), bars = [{ l: 'Комиссия WB', v: comm, c: 'commission' }, { l: 'Логистика', v: log, c: 'logistics' }, { l: 'Хранение (мес)', v: stor, c: 'storage' }, { l: 'Себестоимость', v: cst, c: 'cost' }, { l: 'Возвраты', v: ret, c: 'returns' }, { l: 'Налог', v: tax, c: 'tax' }], mx = Math.max(comm, log, stor, cst, ret, tax); var h = '<div style="font-size:16px;font-weight:600;color:#F0F0FF;margin-bottom:12px;">Цена: ' + p.toLocaleString('ru-RU') + ' ₽</div><div style="border-top:1px solid #2A2A42;margin-bottom:8px;"></div>'; bars.forEach(function(b) { var w = mx > 0 ? Math.round((b.v / mx) * 100) : 0; h += '<div class="econ-bar"><span class="econ-bar-label">' + b.l + '</span><div class="econ-bar-track"><div class="econ-bar-fill ' + b.c + '" style="width:' + w + '%;"></div></div><span class="econ-bar-value" style="color:#EF4444;">−' + b.v.toLocaleString('ru-RU') + ' ₽</span></div>'; }); h += '<div style="border-top:1px solid #2A2A42;margin:8px 0;"></div><div class="econ-bar"><span class="econ-bar-label" style="font-weight:600;">Прибыль</span><div class="econ-bar-track"></div><span class="econ-bar-value" style="color:#10B981;">' + prof.toLocaleString('ru-RU') + ' ₽</span></div><div class="econ-bar"><span class="econ-bar-label" style="font-weight:600;">ЧИСТАЯ ПРИБЫЛЬ</span><div class="econ-bar-track"></div><span class="econ-bar-value" style="color:#10B981;font-size:16px;">' + np.toLocaleString('ru-RU') + ' ₽</span></div><div style="font-size:13px;color:#9CA3AF;margin-top:4px;">Маржа: <span style="color:' + (tm > 20 ? '#10B981' : '#F59E0B') + ';">' + tm + '%</span></div>'; be.innerHTML = h; document.getElementById('cardEconomicsTotal').innerHTML = '<div style="font-size:12px;color:#9CA3AF;">📊 Итого за 30 дней</div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px;"><div>Продано<div style="font-weight:600;">' + s30 + ' шт</div></div><div>Выручка<div style="font-weight:600;">' + (s30 * p).toLocaleString('ru-RU') + ' ₽</div></div><div>Прибыль<div style="font-weight:600;color:#10B981;">' + (s30 * np).toLocaleString('ru-RU') + ' ₽</div></div></div>'; }

// ============================================================
// ИМПОРТ
// ============================================================

function downloadTemplate(type) { var hd, ex, fn; if (type === 'sales') { hd = ['Артикул продавца', 'Дата', 'Заказано', 'Выкуплено', 'Сумма заказов', 'Возвраты']; ex = ['21_К_Вельвет_голубой_40', '23.07.2026', '5', '4', '16000', '0']; fn = 'StockFlow_Шаблон_Продажи.xlsx'; } else if (type === 'stock') { hd = ['Артикул продавца', 'Размер', 'Склад', 'Всего на складе', 'В пути', 'Возвраты']; ex = ['21_К_Вельвет_голубой_40', '40', 'Коледино', '50', '10', '2']; fn = 'StockFlow_Шаблон_Остатки.xlsx'; } else if (type === 'ads') { hd = ['Раздел', 'Тип Ставки', 'ID', 'Кампания', 'Бренд', 'Старт', 'Финиш', 'Показы', 'Частота', 'Клики', 'CPC', 'CPM', 'CTR(%)', 'Место', 'Длительность', 'CR(%)', 'Затраты', 'Заказанные товары, шт', 'Добавления в корзину', 'Валюта']; ex = ['Аукцион', 'Единая Ставка', '36386799', 'Кампания от 06.05.2025', '', '2026-05-06', '2026-07-27', '1', '1', '0', '0', '350', '0', '', '1972:01:47', '0', '0,35', '0', '0', 'RUB']; fn = 'StockFlow_Шаблон_Реклама.xlsx'; } else return; var wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet([hd, ex]); ws['!cols'] = hd.map(function() { return { wch: 20 }; }); XLSX.utils.book_append_sheet(wb, ws, 'Шаблон'); XLSX.writeFile(wb, fn); }

function setupImportDropZone(dzId, fiId, type) { var dz = document.getElementById(dzId), fi = document.getElementById(fiId); if (!dz || !fi) return; dz.addEventListener('click', function() { fi.click(); }); dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('dragover'); }); dz.addEventListener('dragleave', function() { dz.classList.remove('dragover'); }); dz.addEventListener('drop', function(e) { e.preventDefault(); dz.classList.remove('dragover'); if (e.dataTransfer.files.length > 0) processImportFile(e.dataTransfer.files[0], type); }); fi.addEventListener('change', function() { if (fi.files.length > 0) { processImportFile(fi.files[0], type); fi.value = ''; } }); }

function processImportFile(file, type) { var se = document.getElementById(type + 'ImportStatus'); if (se) se.innerHTML = '<span style="color:#F59E0B;">⏳ Обработка...</span>'; var rd = new FileReader(); rd.onload = function(e) { try { var wb = XLSX.read(e.target.result, { type: 'array' }), sh = wb.Sheets[wb.SheetNames[0]], data = XLSX.utils.sheet_to_json(sh, { defval: '' }); if (data.length === 0) { if (se) se.innerHTML = '<span style="color:#EF4444;">❌ Файл пуст</span>'; return; } var mapped = [], errs = []; if (type === 'sales') mapped = mapSalesData(data, errs); else if (type === 'stock') mapped = mapStockData(data, errs); else if (type === 'ads') mapped = mapAdsData(data); if (mapped.length === 0) { if (se) se.innerHTML = '<span style="color:#EF4444;">❌ Нет данных</span>'; return; } var sn = type === 'sales' ? 'sales' : type === 'stock' ? 'stock' : 'ads'; dbClear(sn).then(function() { return Promise.all(mapped.map(function(x) { return dbSave(sn, x); })); }).then(function() { var msg = '✅ Импортировано ' + mapped.length + ' записей'; if (se) se.innerHTML = '<span style="color:#10B981;">' + msg + '</span>'; showToast(msg, 'success'); if (type === 'ads') { recalculateAdsROI().then(function() { updateAdsPage(); }); } else { updateDashboard(); updateProductList(); } }).catch(function(er) { if (se) se.innerHTML = '<span style="color:#EF4444;">❌ Ошибка: ' + er.message + '</span>'; }); } catch (er) { if (se) se.innerHTML = '<span style="color:#EF4444;">❌ Ошибка: ' + er.message + '</span>'; } }; rd.onerror = function() { if (se) se.innerHTML = '<span style="color:#EF4444;">❌ Ошибка чтения</span>'; }; rd.readAsArrayBuffer(file); }

function mapSalesData(data, errs) { var keys = Object.keys(data[0]), gk = function(p) { return keys.find(function(k) { return p.some(function(x) { return k.toLowerCase().indexOf(x) !== -1; }); }); }, kA = gk(['артикул', 'article']) || keys[0], kD = gk(['дата', 'date']) || keys[1], kO = gk(['заказано', 'orders']) || keys[2], kDel = gk(['выкуплено', 'delivered']) || keys[3], kAm = gk(['сумма', 'amount']) || keys[4], kR = gk(['возврат', 'returns']) || keys[5], mapped = []; data.forEach(function(r, i) { var a = String(r[kA] || '').trim(); if (!a) { errs.push({ row: i + 1, error: 'Пустой артикул' }); return; } mapped.push({ id: Date.now() + Math.random(), article: a, date: String(r[kD] || '').trim() || getYesterdayStr(), orders: parseInt(r[kO]) || 0, delivered: parseInt(r[kDel]) || 0, returns: parseInt(r[kR]) || 0, amount: parseFloat(String(r[kAm] || '0').replace(',', '.').replace(/\s/g, '')) || 0 }); }); return mapped; }

function mapStockData(data, errs) { var keys = Object.keys(data[0]), gk = function(p) { return keys.find(function(k) { return p.some(function(x) { return k.toLowerCase().indexOf(x) !== -1; }); }); }, kA = gk(['артикул', 'article']) || keys[0], kS = gk(['размер', 'size']) || keys[1], kW = gk(['склад', 'warehouse']) || keys[2], kAv = gk(['всего', 'available']) || keys[3], kT = gk(['пути', 'transit']) || keys[4], kR = gk(['возврат', 'returns']) || keys[5], mapped = []; data.forEach(function(r, i) { var a = String(r[kA] || '').trim(); if (!a) { errs.push({ row: i + 1, error: 'Пустой артикул' }); return; } mapped.push({ id: Date.now() + Math.random(), article: a, size: String(r[kS] || '').trim(), warehouse: String(r[kW] || 'Склад').trim(), available: parseInt(r[kAv]) || 0, inTransit: parseInt(r[kT]) || 0, returns: parseInt(r[kR]) || 0 }); }); return mapped; }

function mapAdsData(data) { var keys = Object.keys(data[0]), gk = function(p) { return keys.find(function(k) { return p.some(function(x) { return k.toLowerCase().indexOf(x) !== -1; }); }); }, kCamp = gk(['кампания', 'campaign']) || keys[3], kType = gk(['тип ставки', 'тип']) || keys[1], kId = gk(['id']) || keys[2], kImpr = gk(['показы', 'impressions']) || keys[7], kClicks = gk(['клики', 'clicks']) || keys[9], kCpc = gk(['cpc']) || keys[10], kCtr = gk(['ctr']) || keys[12], kCr = gk(['cr']) || keys[15], kSpent = gk(['затраты', 'spent']) || keys[16], kOrders = gk(['заказанные', 'orders']) || keys[17], mapped = []; data.forEach(function(r) { var camp = String(r[kCamp] || '').trim(); if (!camp) return; mapped.push({ id: Date.now() + Math.random(), campaign: camp, type: String(r[kType] || '').trim(), wbId: String(r[kId] || '').trim(), impressions: parseInt(r[kImpr]) || 0, clicks: parseInt(r[kClicks]) || 0, cpc: parseFloat(String(r[kCpc] || '0').replace(',', '.')) || 0, ctr: parseFloat(String(r[kCtr] || '0').replace(',', '.')) || 0, cr: parseFloat(String(r[kCr] || '0').replace(',', '.')) || 0, spent: parseFloat(String(r[kSpent] || '0').replace(',', '.')) || 0, orders_from_ad: parseInt(r[kOrders]) || 0, linkedArticle: null, status: 'active', budget: 0, dailyLimit: 0, _roi: 0, _drr: 0, _trend: 0 }); }); return mapped; }

// ============================================================
// ЯДРО: PRODUCT
// ============================================================

function buildProduct(article) { return Promise.all([dbGetAll('sales'), dbGetAll('stock'), dbGetAll('shipments'), dbGetAll('warehouse'), loadAppSettings()]).then(function(r) { var sales = r[0], stock = r[1], shipments = r[2], wh = r[3], info = getProductInfo(article), aSales = sales.filter(function(s) { return s.article === article; }), aStock = stock.filter(function(s) { return s.article === article; }), wbS = getTotalStock(article, aStock), inT = 0; aStock.forEach(function(s) { inT += s.inTransit || 0; }); var ownW = 0; wh.forEach(function(w) { if (w.article === article && w.status === 'active') ownW += w.quantity || 0; }); var today = new Date(), d7 = new Date(today), d14 = new Date(today), d30 = new Date(today); d7.setDate(d7.getDate() - 7); d14.setDate(d14.getDate() - 14); d30.setDate(d30.getDate() - 30); var s7 = 0, s14 = 0, s30 = 0; aSales.forEach(function(s) { var p = s.date.split('.'), sd = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0])); if (sd >= d7) s7 += s.orders || 0; if (sd >= d14) s14 += s.orders || 0; if (sd >= d30) s30 += s.orders || 0; }); var tS = wbS + inT + ownW, a30 = s30 / 30, io = calculateIO(wbS, s30), ioI = getIOStatus(io), dl = calculateDaysLeft(tS, s30), m = calculateMargin(info.price, info.cost), ro = Math.max(0, Math.round((a30 * (parseInt(appSettings.targetStockDays) || 60)) - tS)), urg; if (dl <= 7) urg = 'critical'; else if (dl <= 14) urg = 'soon'; else urg = 'normal'; return { productId: article, article: article, model: info.baseArticle || article, color: info.color || '', size: info.size || article.split('_').pop(), category: info.category || 'Товар', barcode: info.barcode || '', weight: 0.5, volume: parseFloat(appSettings.volumePerUnit) || 5, costPrice: info.cost, sellingPrice: info.price, stock: { wb: wbS, inTransit: inT, ownWarehouse: ownW, total: tS }, sales: { last7days: s7, last14days: s14, last30days: s30, avgPerDay7: parseFloat((s7 / 7).toFixed(1)), avgPerDay14: parseFloat((s14 / 14).toFixed(1)), avgPerDay30: parseFloat(a30.toFixed(1)) }, metrics: { io: io, ioStatus: ioI.status, ioColor: ioI.color, daysLeft: dl, margin: m, profit: info.price - info.cost }, forecast: { dailyDemand: parseFloat(a30.toFixed(1)), daysUntilStockout: dl, recommendedOrder: ro, urgency: urg } }; }); }

function getAllProducts() { return Promise.all([dbGetAll('sales'), dbGetAll('stock')]).then(function(r) { var arts = {}; r[0].forEach(function(s) { arts[s.article] = true; }); r[1].forEach(function(s) { arts[s.article] = true; }); TEST_PRODUCTS.forEach(function(p) { arts[p.article] = true; }); return Object.keys(arts).sort(); }); }

function updateProduct(article, changes) { var p = null; TEST_PRODUCTS.forEach(function(x) { if (x.article === article) p = x; }); if (p) { if (changes.price !== undefined) p.price = changes.price; if (changes.cost !== undefined) p.cost = changes.cost; if (changes.category !== undefined) p.category = changes.category; if (changes.baseArticle !== undefined) p.baseArticle = changes.baseArticle; } }

// ============================================================
// МОЙ СКЛАД
// ============================================================

function updateWarehousePage() { renderWarehouse(); }
function switchWarehouse(name) { currentWarehouse = name; document.querySelectorAll('.wh-tab').forEach(function(t) { t.classList.remove('active'); }); document.querySelector('.wh-tab[data-warehouse="' + name + '"]').classList.add('active'); renderWarehouse(); }
function createPallet() { var n = document.getElementById('newPalletNumber').value.trim(); if (!n) { showToast('❌ Введите номер палеты', 'error'); return; } dbGetAll('warehouse').then(function(items) { if (items.some(function(i) { return i.type === 'pallet' && i.warehouse === currentWarehouse && i.pallet === n; })) { showToast('❌ Паллета №' + n + ' уже существует', 'error'); return; } return dbSave('warehouse', { id: Date.now(), type: 'pallet', warehouse: currentWarehouse, pallet: n, created: getYesterdayStr() }); }).then(function() { renderWarehouse(); showToast('✅ Паллета создана', 'success'); }); }
function deletePallet(pn) { if (!confirm('Удалить палету №' + pn + ' и всё содержимое?')) return; dbGetAll('warehouse').then(function(items) { return Promise.all(items.filter(function(i) { return i.pallet === pn && i.warehouse === currentWarehouse; }).map(function(i) { return dbDelete('warehouse', i.id); })); }).then(function() { renderWarehouse(); showToast('✅ Паллета удалена', 'success'); }); }
function addBoxToPallet(pn, side) { var bl = prompt('Этикетка коробки:'); if (!bl) return; dbSave('warehouse', { id: Date.now(), type: 'box', warehouse: currentWarehouse, pallet: pn, side: side, box: bl.trim(), created: getYesterdayStr() }).then(function() { renderWarehouse(); showToast('✅ Коробка добавлена', 'success'); }); }
function deleteBox(bl, pn) { if (!confirm('Удалить коробку ' + bl + ' с палеты №' + pn + '?')) return; dbGetAll('warehouse').then(function(items) { return Promise.all(items.filter(function(i) { return i.box === bl && i.pallet === pn && i.warehouse === currentWarehouse; }).map(function(i) { return dbDelete('warehouse', i.id); })); }).then(function() { renderWarehouse(); showToast('✅ Коробка удалена', 'success'); }); }
function moveBox(bl, fp) { var np = prompt('Переместить коробку ' + bl + ' с палеты №' + fp + ' на палету №:'); if (!np || np === fp) return; dbGetAll('warehouse').then(function(items) { if (!items.some(function(i) { return i.type === 'pallet' && i.warehouse === currentWarehouse && i.pallet === np; })) { showToast('❌ Паллета №' + np + ' не найдена', 'error'); return; } var bis = items.filter(function(i) { return i.box === bl && i.pallet === fp && i.warehouse === currentWarehouse; }); return Promise.all(bis.map(function(i) { i.pallet = np; if (!i.history) i.history = []; i.history.push(getYesterdayStr() + ': пал.' + fp + ' → пал.' + np); return dbSave('warehouse', i); })); }).then(function() { renderWarehouse(); showToast('✅ Коробка перемещена', 'success'); }); }
function addItemToBox(bid, pn, side) { var a = prompt('Артикул:'), c = prompt('Цвет:') || '', s = prompt('Размер:') || '', q = parseInt(prompt('Кол-во:') || '1') || 1; if (!a || q <= 0) return; dbSave('warehouse', { id: Date.now(), type: 'item', warehouse: currentWarehouse, pallet: pn, side: side, box: bid, article: a, color: c, size: s, quantity: q, status: 'active', created: getYesterdayStr(), history: [] }).then(function() { renderWarehouse(); showToast('✅ Товар добавлен', 'success'); }); }
function removeWarehouseItem(id) { if (!confirm('Удалить элемент?')) return; dbDelete('warehouse', id).then(function() { renderWarehouse(); showToast('✅ Удалено', 'success'); }); }

function renderWarehouse() {
    var c = document.getElementById('warehouseContent');
    dbGetAll('warehouse').then(function(items) {
        var pallets = items.filter(function(i) { return i.type === 'pallet' && i.warehouse === currentWarehouse; });
        if (pallets.length === 0) { c.innerHTML = '<div class="card" style="text-align:center;padding:30px;">📦<br>Склад пуст<br>Создайте первую палету</div>'; return; }
        var h = ''; pallets.sort(function(a, b) { return a.pallet.localeCompare(b.pallet); }).forEach(function(pallet) {
            var boxes = items.filter(function(i) { return i.type === 'box' && i.pallet === pallet.pallet && i.warehouse === currentWarehouse; });
            var itemsAll = items.filter(function(i) { return i.type === 'item' && i.pallet === pallet.pallet && i.warehouse === currentWarehouse && i.status === 'active'; });
            var tq = itemsAll.reduce(function(s, i) { return s + (i.quantity || 0); }, 0);
            h += '<div class="product-group"><div class="product-group-header" onclick="toggleGroup(this)"><span class="product-group-icon">📦</span><div class="product-group-info"><div class="product-group-name">Паллета №' + pallet.pallet + '</div><div class="product-group-category">' + currentWarehouse + ' · ' + boxes.length + ' кор. · ' + tq + ' ед.</div></div><span class="product-group-arrow">▶</span></div><div class="product-group-items"><div style="padding:8px 16px;display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--border);"><button class="btn btn-secondary btn-sm" onclick="addBoxToPallet(\'' + pallet.pallet + '\',\'лицевая\')">➕ Коробка (лицо)</button><button class="btn btn-secondary btn-sm" onclick="addBoxToPallet(\'' + pallet.pallet + '\',\'обратная\')">➕ Коробка (оборот)</button><button class="btn btn-danger btn-sm" onclick="deletePallet(\'' + pallet.pallet + '\')" style="margin-left:auto;">🗑️ Удалить палету</button></div>';
            boxes.forEach(function(box) {
                var bis = itemsAll.filter(function(i) { return i.box === box.box; }), bq = bis.reduce(function(s, i) { return s + (i.quantity || 0); }, 0);
                h += '<div style="padding:6px 16px 6px 24px;border-bottom:1px solid var(--border);"><div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;"><span><strong>' + box.box + '</strong> (' + box.side + ') — ' + bq + ' ед.</span><div style="display:flex;gap:4px;"><button class="btn btn-primary btn-sm" onclick="addItemToBox(\'' + box.box + '\',\'' + pallet.pallet + '\',\'' + box.side + '\')" style="font-size:10px;padding:2px 8px;">➕ Товар</button><button class="btn btn-secondary btn-sm" onclick="moveBox(\'' + box.box + '\',\'' + pallet.pallet + '\')" style="font-size:10px;padding:2px 8px;">↔</button><button class="btn btn-danger btn-sm" onclick="deleteBox(\'' + box.box + '\',\'' + pallet.pallet + '\')" style="font-size:10px;padding:2px 8px;">🗑️</button></div></div>';
                if (bis.length > 0) { h += '<div style="margin-top:4px;font-size:11px;color:var(--text-secondary);">'; bis.forEach(function(item) { h += '<div style="padding:2px 0;">' + item.article + ' ' + item.color + ' ' + item.size + ' — ' + item.quantity + ' шт <button class="btn btn-danger btn-sm" onclick="removeWarehouseItem(' + item.id + ')" style="font-size:9px;padding:1px 6px;">✕</button></div>'; }); h += '</div>'; }
                h += '</div>';
            });
            h += '</div></div>';
        }); c.innerHTML = h;
    });
}

// ============================================================
// ОБЩИЕ ФУНКЦИИ
// ============================================================

function getProductInfo(article) { var r = null; TEST_PRODUCTS.forEach(function(p) { if (p.article === article) r = p; }); if (!r) r = { article: article, baseArticle: article.split('_').slice(0, -2).join('_'), category: 'Товар', price: 0, cost: 0, color: '', size: article.split('_').pop(), barcode: '' }; return r; }
function getTotalStock(article, sd) { var t = 0; sd.forEach(function(s) { if (s.article === article) t += s.available || 0; }); return t; }
function getSales30(article, sd) { var t = 0; sd.forEach(function(s) { if (s.article === article) t += s.orders || 0; }); return t; }
function getProblems(prods) { var p = []; prods.forEach(function(x) { if (x.stock < 5) p.push({ type: 'critical', icon: '🔴', text: x.article + ' — остаток ' + x.stock + ' шт (на ' + x.daysLeft + ' дн)' }); else if (x.ioLevel === 'critical' && x.stock > 0) p.push({ type: 'critical', icon: '🔴', text: x.article + ' — ИО ' + (x.io * 100).toFixed(1) + '% (риск блокировки)' }); else if (x.margin < 0) p.push({ type: 'warning', icon: '🟡', text: x.article + ' — убыточный (маржа ' + x.margin + '%)' }); else if (x.ioLevel === 'warning') p.push({ type: 'warning', icon: '🟡', text: x.article + ' — ИО ' + (x.io * 100).toFixed(1) + '% (недостаток)' }); }); return p; }
function getYesterdayStr() { var d = new Date(); d.setDate(d.getDate() - 1); return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear(); }

// ============================================================
// ЗАПУСК
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    document.querySelector('.sidebar-version').textContent = 'StockFlow v' + APP_VERSION + ' (' + APP_STAGE + ')';
    document.querySelectorAll('.menu-item').forEach(function(item) { item.addEventListener('click', function() { navigateTo(this.getAttribute('data-page')); }); });
    document.getElementById('sidebarLogo').addEventListener('click', function() { navigateTo('dashboard'); });
    
    // Восстанавливаем состояние меню
    restoreMenuState();
    
    // Кнопки "Загрузить все тестовые данные" и "Очистить всё"
    document.getElementById('loadTestDataBtn').addEventListener('click', loadTestData);
    document.getElementById('clearTestDataBtn').addEventListener('click', clearAllData);
    
    checkDatabase();
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
    document.getElementById('exportOrdersBtn').addEventListener('click', function() { showToast('📤 Экспорт в разработке', 'success'); });
    document.getElementById('addToSupplyBtn').addEventListener('click', addToSupplyCart);
    document.getElementById('createSupplyBtn').addEventListener('click', createSupply);
    document.getElementById('addFromWarehouseBtn').addEventListener('click', addFromWarehouseToSupply);
    document.getElementById('backToProductsBtn').addEventListener('click', closeProductCard);
    document.querySelectorAll('.card-chart-btn').forEach(function(btn) { btn.addEventListener('click', function() { document.querySelectorAll('.card-chart-btn').forEach(function(b) { b.classList.remove('active'); }); this.classList.add('active'); if (currentCardArticle) { dbGetAll('sales').then(function(sales) { renderCardChart(sales.filter(function(s) { return s.article === currentCardArticle; }), parseInt(this.getAttribute('data-card-period'))); }.bind(this)); } }); });
    document.querySelectorAll('.card-tab').forEach(function(tab) { tab.addEventListener('click', function() { document.querySelectorAll('.card-tab').forEach(function(t) { t.classList.remove('active'); }); this.classList.add('active'); var tn = this.getAttribute('data-card-tab'); document.querySelectorAll('.card-tab-content').forEach(function(c) { c.style.display = 'none'; }); var ct = document.getElementById('cardTab' + tn.charAt(0).toUpperCase() + tn.slice(1)); if (ct) ct.style.display = 'block'; }); });
    document.getElementById('downloadSalesTemplateBtn').addEventListener('click', function() { downloadTemplate('sales'); });
    document.getElementById('downloadStockTemplateBtn').addEventListener('click', function() { downloadTemplate('stock'); });
    document.getElementById('downloadAdsTemplateBtn').addEventListener('click', function() { downloadTemplate('ads'); });
    setupImportDropZone('salesDropZone', 'salesFileInput', 'sales');
    setupImportDropZone('stockDropZone', 'stockFileInput', 'stock');
    setupImportDropZone('adsDropZone', 'adsFileInput', 'ads');
    document.getElementById('createPalletBtn').addEventListener('click', createPallet);
    document.querySelectorAll('.wh-tab').forEach(function(tab) { tab.addEventListener('click', function() { switchWarehouse(this.getAttribute('data-warehouse')); }); });
    
    // Обработчики для модальных окон
    document.getElementById('campaignModal').addEventListener('click', function(e) {
        if (e.target === this) closeCampaignModal();
    });
    document.getElementById('editCampaignModal').addEventListener('click', function(e) {
        if (e.target === this) closeEditCampaignModal();
    });
    
    // Обработчик клавиши Escape для закрытия модалок
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeCampaignModal();
            closeEditCampaignModal();
        }
    });
    
    // Количество записей на странице
    document.getElementById('adsPerPage').addEventListener('change', function() {
        adsPerPage = parseInt(this.value) || 25;
        adsCurrentPage = 1;
        renderAds();
    });
    
    updateDashboard();
});

function refreshProductTable() { Promise.all([dbGetAll('sales'), dbGetAll('stock')]).then(function(r) { renderGroupedProducts(buildProductList(r[0], r[1])); }); }
