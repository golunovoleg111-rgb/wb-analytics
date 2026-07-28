// ============================================================
// КОНСТАНТЫ ПРИЛОЖЕНИЯ
// ============================================================

var APP_VERSION = '5.0.0';
var APP_STAGE = 'Beta';
var DB_NAME = 'BeltaneeDB_v5';
var DB_VERSION = 5;
var STORES = ['sales', 'stock', 'settings', 'shipments', 'warehouse', 'ads', 'products'];
var currentCardArticle = null;
var cardChart = null;
var supplyCart = [];
var currentWarehouse = 'Основной';

// Пагинация рекламы
var adsCurrentPage = 1;
var adsPerPage = 25;
var adsDataCache = [];
var selectedAds = [];

// Настройки приложения
var appSettings = {
    fboCommission: 15,
    fbsCommission: 10,
    storageBaseRate: 0.07,
    storageOverRate: 0.15,
    volumePerUnit: 5,
    taxSystem: 'usn6',
    patentCost: 30000,
    targetStockDays: 60,
    safetyStockDays: 30,
    productionDays: 14,
    deliveryDays: 7
};

// ============================================================
// БАЗА ДАННЫХ
// ============================================================

function openDB() {
    return new Promise(function(resolve, reject) {
        var request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = function(event) {
            var db = event.target.result;
            STORES.forEach(function(storeName) {
                if (!db.objectStoreNames.contains(storeName)) {
                    db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
                }
            });
        };
        request.onsuccess = function(event) { resolve(event.target.result); };
        request.onerror = function(event) { reject(event.target.error); };
        request.onblocked = function() { reject(new Error('База данных заблокирована.')); };
    });
}

function dbSave(storeName, data) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(storeName, 'readwrite');
            var store = tx.objectStore(storeName);
            var req = store.put(data);
            req.onsuccess = function() { resolve(req.result); };
            req.onerror = function() { reject(req.error); };
            tx.oncomplete = function() { db.close(); };
        });
    });
}

function dbGetAll(storeName) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(storeName, 'readonly');
            var store = tx.objectStore(storeName);
            var req = store.getAll();
            req.onsuccess = function() { resolve(req.result); };
            req.onerror = function() { reject(req.error); };
            tx.oncomplete = function() { db.close(); };
        });
    });
}

function dbClear(storeName) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(storeName, 'readwrite');
            var store = tx.objectStore(storeName);
            var req = store.clear();
            req.onsuccess = function() { resolve(); };
            req.onerror = function() { reject(req.error); };
            tx.oncomplete = function() { db.close(); };
        });
    });
}

function dbDelete(storeName, id) {
    return openDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction(storeName, 'readwrite');
            var store = tx.objectStore(storeName);
            var req = store.delete(id);
            req.onsuccess = function() { resolve(); };
            req.onerror = function() { reject(req.error); };
            tx.oncomplete = function() { db.close(); };
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
    toast._timeout = setTimeout(function() {
        toast.classList.remove('show');
    }, 3000);
}

// ============================================================
// НАВИГАЦИЯ (НОВАЯ ВЕРСИЯ)
// ============================================================

function navigateTo(pageName) {
    // Обновляем активный пункт в верхнем меню
    document.querySelectorAll('.nav-item').forEach(function(item) {
        item.classList.remove('active');
    });
    var navItem = document.querySelector('.nav-item[data-page="' + pageName + '"]');
    if (navItem) navItem.classList.add('active');

    // Показываем нужную страницу
    document.querySelectorAll('.page').forEach(function(page) {
        page.classList.remove('active');
    });
    var page = document.getElementById('page-' + pageName);
    if (page) page.classList.add('active');

    // Загружаем данные для страницы
    if (pageName === 'settings') { loadSettings(); updateDBStats(); }
    if (pageName === 'dashboard') updateDashboard();
    if (pageName === 'products') updateProductList();
    if (pageName === 'orders') updateOrdersPage();
    if (pageName === 'supplies') updateSuppliesPage();
    if (pageName === 'warehouse') updateWarehousePage();
    if (pageName === 'ads') updateAdsPage();
}

// ============================================================
// ПРОВЕРКА БД
// ============================================================

function checkDatabase() {
    var el = document.getElementById('dbStatus');
    if (!el) return;
    el.innerHTML = 'Проверка базы данных...';
    openDB().then(function(db) {
        db.close();
        el.innerHTML = '<span style="color:#10B981;">✅ База данных готова (v.' + DB_VERSION + ')</span>';
        updateDBStats();
    }).catch(function(e) {
        el.innerHTML = '<span style="color:#EF4444;">❌ Ошибка: ' + e.message + '</span>';
    });
}

function updateDBStats() {
    var el = document.getElementById('dbStats');
    if (!el) return;
    Promise.all([
        dbGetAll('sales'),
        dbGetAll('stock'),
        dbGetAll('ads'),
        dbGetAll('products')
    ]).then(function(r) {
        el.textContent = 'Продаж: ' + r[0].length +
                        ', Остатков: ' + r[1].length +
                        ', Рекламы: ' + r[2].length +
                        ', Товаров: ' + r[3].length;
    }).catch(function() {
        el.textContent = '';
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
                if (el) el.value = item.value;
            });
            togglePatentField();
        }
    });
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
        { key: 'deliveryDays', value: parseInt(document.getElementById('deliveryDays').value) || 7 },
        { key: 'wbApiKey', value: document.getElementById('wbApiKey').value || '' },
        { key: 'ozonApiKey', value: document.getElementById('ozonApiKey').value || '' }
    ];
    dbClear('settings').then(function() {
        return Promise.all(s.map(function(x) { return dbSave('settings', x); }));
    }).then(function() {
        s.forEach(function(item) {
            if (appSettings.hasOwnProperty(item.key)) {
                appSettings[item.key] = item.value;
            }
        });
        showToast('✅ Настройки сохранены', 'success');
        updateDBStats();
    });
}

function togglePatentField() {
    var v = document.getElementById('taxSystem').value;
    var b = document.getElementById('patentBlock');
    if (b) b.style.display = (v === 'patent') ? 'block' : 'none';
}

// ============================================================
// СТАРЫЕ ФУНКЦИИ МЕНЮ — УДАЛЕНЫ (toggleMenuGroup, restoreMenuState)
// ============================================================

// ============================================================
// РАСЧЁТЫ (ЕДИНЫЕ ФУНКЦИИ)
// ============================================================

function calculateIO(stock, s30) {
    if (s30 === 0) return stock > 0 ? 999 : 0;
    return parseFloat((stock / s30).toFixed(4));
}

function getIOStatus(io) {
    if (io < 0.2) return { status: 'Дефицит', color: '#EF4444', level: 'critical' };
    if (io < 0.5) return { status: 'Недостаток', color: '#F59E0B', level: 'warning' };
    if (io < 1.0) return { status: 'Норма', color: '#10B981', level: 'normal' };
    if (io < 2.0) return { status: 'Избыток', color: '#3B82F6', level: 'excess' };
    return { status: 'Сильный избыток', color: '#8B5CF6', level: 'excess' };
}

function calculateDaysLeft(stock, s30) {
    var d = s30 / 30;
    if (d === 0) return 999;
    return Math.round(stock / d);
}

function calculateMargin(price, cost) {
    if (price === 0) return 0;
    return parseFloat(((price - cost) / price * 100).toFixed(2));
}

function getYesterdayStr() {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    return String(d.getDate()).padStart(2, '0') + '.' +
           String(d.getMonth() + 1).padStart(2, '0') + '.' +
           d.getFullYear();
}

function loadAppSettings() {
    return dbGetAll('settings').then(function(d) {
        d.forEach(function(x) {
            if (appSettings.hasOwnProperty(x.key)) appSettings[x.key] = x.value;
        });
        return appSettings;
    });
}

// ============================================================
// РАБОТА С ТОВАРАМИ (ЧЕРЕЗ IndexedDB)
// ============================================================

function getProductInfo(article) {
    return dbGetAll('products').then(function(products) {
        var found = null;
        products.forEach(function(p) {
            if (p.article === article) found = p;
        });
        if (!found) {
            // Создаём базовую запись, но НЕ СОХРАНЯЕМ в БД
            return {
                article: article,
                baseArticle: article.split('_').slice(0, -2).join('_'),
                category: 'Товар',
                cost: 0,
                price: 0,
                color: '',
                size: article.split('_').pop(),
                barcode: ''
            };
        }
        return found;
    });
}

function getAllProducts() {
    return dbGetAll('products').then(function(products) {
        var arts = [];
        products.forEach(function(p) {
            arts.push(p.article);
        });
        return arts.sort();
    });
}

function getTotalStock(article, stockData) {
    var t = 0;
    stockData.forEach(function(s) {
        if (s.article === article) t += s.available || 0;
    });
    return t;
}

function getSales30(article, salesData) {
    var t = 0;
    salesData.forEach(function(s) {
        if (s.article === article) t += s.orders || 0;
    });
    return t;
}

// ============================================================
// ГЛАВНАЯ
// ============================================================

function updateDashboard() {
    loadAppSettings().then(function() {
        return Promise.all([dbGetAll('sales'), dbGetAll('stock')]);
    }).then(function(r) {
        var sales = r[0];
        var stock = r[1];

        if (sales.length === 0 && stock.length === 0) {
            document.getElementById('dashboardEmpty').style.display = 'block';
            document.getElementById('dashboardContent').style.display = 'none';
            return;
        }

        document.getElementById('dashboardEmpty').style.display = 'none';
        document.getElementById('dashboardContent').style.display = 'block';

        collectStats(sales, stock).then(function(stats) {
            renderKPIs(stats);
            renderAttentionBlock(stats);
        });
    });
}

function collectStats(sales, stock) {
    var y = getYesterdayStr();
    var yo = 0,
        yd = 0,
        ya = 0;
    var m30 = {};
    var arts = {};
    var seen = {};

    sales.forEach(function(s) {
        if (s.date === y) {
            yo += s.orders || 0;
            yd += s.delivered || 0;
            ya += s.amount || 0;
        }
        if (!m30[s.article]) m30[s.article] = 0;
        m30[s.article] += s.orders || 0;
        if (!seen[s.article]) {
            seen[s.article] = true;
            arts[s.article] = true;
        }
    });

    var productList = Object.keys(arts);

    return Promise.all(productList.map(function(a) {
        return getProductInfo(a).then(function(info) {
            var ts = getTotalStock(a, stock);
            var s30 = m30[a] || 0;
            var io = calculateIO(ts, s30);
            var ioI = getIOStatus(io);
            var m = info ? calculateMargin(info.price || 0, info.cost || 0) : 0;
            return {
                article: a,
                stock: ts,
                sales30: s30,
                io: io,
                ioStatus: ioI.status,
                ioColor: ioI.color,
                ioLevel: ioI.level,
                margin: m,
                daysLeft: calculateDaysLeft(ts, s30),
                price: info ? info.price || 0 : 0,
                cost: info ? info.cost || 0 : 0
            };
        });
    })).then(function(prods) {
        return {
            yesterdayOrders: yo,
            yesterdayDelivered: yd,
            yesterdayAmount: ya,
            productsCount: productList.length,
            products: prods
        };
    });
}

function renderKPIs(stats) {
    document.getElementById('kpiProducts').textContent = stats.productsCount || 0;
    document.getElementById('kpiOrders').textContent = stats.yesterdayOrders || 0;
    document.getElementById('kpiDelivered').textContent = stats.yesterdayDelivered || 0;

    var am = 0;
    if (stats.products && stats.products.length > 0) {
        var sm = 0;
        stats.products.forEach(function(p) {
            sm += p.margin || 0;
        });
        am = parseFloat((sm / stats.products.length).toFixed(1));
    }
    document.getElementById('kpiAvgMargin').textContent = (isNaN(am) ? 0 : am) + '%';
}

function renderAttentionBlock(stats) {
    var c = document.getElementById('attentionBlock');
    var probs = getProblems(stats.products || []);

    if (probs.length === 0) {
        c.innerHTML = '<div style="color:#10B981;font-size:13px;">✅ Все показатели в норме</div>';
        return;
    }

    var h = '';
    probs.forEach(function(p) {
        var bg = p.type === 'critical' ? '#FEF2F2' : '#FFFBEB';
        var bd = p.type === 'critical' ? '#EF4444' : '#F59E0B';
        h += '<div style="padding:8px 12px;background:' + bg + ';border-left:3px solid ' + bd + ';margin-bottom:6px;border-radius:6px;font-size:13px;">';
        h += '<span style="margin-right:6px;">' + p.icon + '</span>' + p.text;
        h += '</div>';
    });
    c.innerHTML = h;
}

function getProblems(prods) {
    var p = [];
    prods.forEach(function(x) {
        if (x.stock < 5) {
            p.push({
                type: 'critical',
                icon: '🔴',
                text: x.article + ' — остаток ' + x.stock + ' шт (на ' + x.daysLeft + ' дн)'
            });
        } else if (x.ioLevel === 'critical' && x.stock > 0) {
            p.push({
                type: 'critical',
                icon: '🔴',
                text: x.article + ' — ИО ' + (x.io * 100).toFixed(1) + '% (риск блокировки)'
            });
        } else if (x.margin < 0) {
            p.push({
                type: 'warning',
                icon: '🟡',
                text: x.article + ' — убыточный (маржа ' + x.margin + '%)'
            });
        } else if (x.ioLevel === 'warning') {
            p.push({
                type: 'warning',
                icon: '🟡',
                text: x.article + ' — ИО ' + (x.io * 100).toFixed(1) + '% (недостаток)'
            });
        }
    });
    return p;
}

// ============================================================
// ТОВАРЫ
// ============================================================

function updateProductList() {
    Promise.all([dbGetAll('sales'), dbGetAll('stock'), dbGetAll('products')]).then(function(r) {
        var sales = r[0],
            stock = r[1],
            products = r[2];

        if (sales.length === 0 && stock.length === 0 && products.length === 0) {
            document.getElementById('productsEmpty').style.display = 'block';
            document.getElementById('productsContent').style.display = 'none';
            return;
        }

        document.getElementById('productsEmpty').style.display = 'none';
        document.getElementById('productsContent').style.display = 'block';

        renderGroupedProducts(sales, stock, products);
    });
}

function buildProductList(sales, stock, products) {
    var m30 = {};
    var seen = {};
    var prods = [];

    sales.forEach(function(s) {
        if (!m30[s.article]) m30[s.article] = 0;
        m30[s.article] += s.orders || 0;
    });

    var productMap = {};
    products.forEach(function(p) {
        productMap[p.article] = p;
    });

    sales.forEach(function(s) {
        if (!seen[s.article]) {
            seen[s.article] = true;
            var info = productMap[s.article] || null;
            var ts = getTotalStock(s.article, stock);
            var s30 = m30[s.article] || 0;
            var io = calculateIO(ts, s30);
            var ioI = getIOStatus(io);
            var m = info ? calculateMargin(info.price || 0, info.cost || 0) : 0;

            prods.push({
                article: s.article,
                baseArticle: info ? info.baseArticle : s.article.split('_').slice(0, -2).join('_'),
                price: info ? info.price || 0 : 0,
                cost: info ? info.cost || 0 : 0,
                category: info ? info.category || 'Товар' : 'Товар',
                margin: m,
                stock: ts,
                io: io,
                ioStatus: ioI.status,
                ioColor: ioI.color,
                ioLevel: ioI.level,
                sales30: s30,
                daysLeft: calculateDaysLeft(ts, s30)
            });
        }
    });

    return prods;
}

function renderGroupedProducts(sales, stock, products) {
    var prods = buildProductList(sales, stock, products);
    var c = document.getElementById('productsGroupedList');
    var sq = document.getElementById('productSearch').value.toLowerCase();
    var fl = document.getElementById('productFilter').value;

    var grps = {};
    prods.forEach(function(p) {
        var b = p.baseArticle || p.article;
        if (!grps[b]) {
            grps[b] = {
                baseArticle: b,
                category: p.category,
                items: [],
                totalStock: 0,
                totalSales30: 0
            };
        }
        grps[b].items.push(p);
        grps[b].totalStock += p.stock;
        grps[b].totalSales30 += p.sales30;
    });

    var keys = Object.keys(grps).filter(function(k) {
        var g = grps[k];
        if (sq && !g.items.some(function(p) {
                return p.article.toLowerCase().indexOf(sq) !== -1;
            })) return false;
        if (fl === 'profitable' && !g.items.some(function(p) { return p.margin > 20; })) return false;
        if (fl === 'unprofitable' && !g.items.some(function(p) { return p.margin < 0; })) return false;
        if (fl === 'deficit' && !g.items.some(function(p) { return p.io < 0.2; })) return false;
        if (fl === 'lowMargin' && !g.items.some(function(p) { return p.margin > 0 && p.margin <= 20; })) return false;
        return true;
    });

    if (keys.length === 0) {
        c.innerHTML = '<div class="card" style="text-align:center;padding:20px;">Ничего не найдено</div>';
        return;
    }

    function getCategoryIcon(category) {
        var icons = {
            'Костюмы': '👔',
            'Платья': '👗',
            'Жакеты': '🧥',
            'Брюки': '👖',
            'Свитеры': '🧶',
            'Товар': '📦'
        };
        return icons[category] || '📦';
    }

    var h = '';
    keys.forEach(function(k) {
        var g = grps[k];
        var icon = getCategoryIcon(g.category);
        var margins = g.items.map(function(p) { return p.margin; });
        var am = parseFloat((margins.reduce(function(a, b) { return a + b; }, 0) / margins.length).toFixed(1));
        var tio = calculateIO(g.totalStock, g.totalSales30);
        var ioI = getIOStatus(tio);
        var hp = g.items.some(function(p) {
            return p.ioLevel === 'critical' || p.stock < 5 || p.margin < 0;
        });

        h += '<div class="product-group">';
        h += '<div class="product-group-header" onclick="toggleGroup(this)">';
        h += '<span class="product-group-icon">' + icon + '</span>';
        h += '<div class="product-group-info">';
        h += '<div class="product-group-name">' + g.baseArticle + (hp ? ' ⚠️' : '') + '</div>';
        h += '<div class="product-group-category">' + g.category + ' · ' + g.items.length + ' вар.</div>';
        h += '</div>';
        h += '<div class="product-group-metrics">';
        h += '<div class="product-group-metric"><div class="product-group-metric-label">Маржа</div><div class="product-group-metric-value" style="color:' + (am > 20 ? '#10B981' : am > 0 ? '#F59E0B' : '#EF4444') + ';">' + am + '%</div></div>';
        h += '<div class="product-group-metric"><div class="product-group-metric-label">Остаток</div><div class="product-group-metric-value" style="color:' + (g.totalStock < 10 ? '#EF4444' : '#10B981') + ';">' + g.totalStock + '</div></div>';
        h += '<div class="product-group-metric"><div class="product-group-metric-label">ИО</div><div class="product-group-metric-value" style="color:' + ioI.color + ';">' + tio.toFixed(2) + '</div></div>';
        h += '</div>';
        h += '<span class="product-group-arrow">▶</span>';
        h += '</div>';

        h += '<div class="product-group-items">';
        g.items.forEach(function(p) {
            var mC = p.margin > 20 ? '#10B981' : p.margin > 0 ? '#F59E0B' : '#EF4444';
            var sC = p.stock < 5 ? '#EF4444' : p.stock < 20 ? '#F59E0B' : '#10B981';
            var si = p.ioLevel === 'critical' || p.stock < 5 ? '🔴' : p.margin < 0 ? '🟡' : '';
            h += '<div class="product-group-item" onclick="openProductCard(\'' + p.article + '\')">';
            h += '<span class="product-group-item-name">' + p.article + '</span>';
            h += '<span class="product-group-item-price">' + (p.price > 0 ? p.price.toLocaleString('ru-RU') + ' ₽' : '—') + '</span>';
            h += '<span class="product-group-item-margin" style="color:' + mC + ';">' + p.margin + '%</span>';
            h += '<span class="product-group-item-stock" style="color:' + sC + ';">' + p.stock + ' шт</span>';
            h += '<span class="product-group-item-io" style="color:' + p.ioColor + ';">' + p.io.toFixed(2) + '</span>';
            h += '<span class="product-group-item-status">' + si + '</span>';
            h += '</div>';
        });
        h += '</div></div>';
    });

    c.innerHTML = h;
}

function toggleGroup(hdr) {
    var arr = hdr.querySelector('.product-group-arrow');
    var items = hdr.nextElementSibling;
    if (items.classList.contains('open')) {
        items.classList.remove('open');
        arr.classList.remove('open');
    } else {
        items.classList.add('open');
        arr.classList.add('open');
    }
}

function refreshProductTable() {
    Promise.all([dbGetAll('sales'), dbGetAll('stock'), dbGetAll('products')]).then(function(r) {
        renderGroupedProducts(r[0], r[1], r[2]);
    });
}

// ============================================================
// ЗАКАЗЫ
// ============================================================

function updateOrdersPage() {
    Promise.all([dbGetAll('sales'), dbGetAll('stock'), dbGetAll('products')]).then(function(r) {
        var sales = r[0],
            stock = r[1],
            products = r[2];
        if (sales.length === 0 && stock.length === 0 && products.length === 0) {
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
    var periodSelect = document.getElementById('ordersPeriodSelect');
    var searchInput = document.getElementById('ordersSearch');
    var filterSelect = document.getElementById('ordersFilter');

    if (!periodSelect || !searchInput || !filterSelect) {
        return;
    }

    var sq = searchInput.value.toLowerCase();
    var fl = filterSelect.value;
    var period = parseInt(periodSelect.value) || 30;

    Promise.all([dbGetAll('sales'), dbGetAll('stock'), dbGetAll('products'), loadAppSettings()]).then(function(r) {
        var sales = r[0],
            stock = r[1],
            products = r[2],
            settings = r[3];

        var productMap = {};
        products.forEach(function(p) {
            productMap[p.article] = p;
        });

        var articles = {};
        sales.forEach(function(s) { articles[s.article] = true; });
        stock.forEach(function(s) { articles[s.article] = true; });

        var prods = [];
        Object.keys(articles).forEach(function(article) {
            var info = productMap[article] || null;
            var ts = getTotalStock(article, stock);
            var s30 = getSales30(article, sales);
            var a30 = s30 / 30;
            var io = calculateIO(ts, s30);
            var ioI = getIOStatus(io);
            var dl = calculateDaysLeft(ts, s30);
            var m = info ? calculateMargin(info.price || 0, info.cost || 0) : 0;
            var ro = Math.max(0, Math.round((a30 * (parseInt(settings.targetStockDays) || 60)) - ts));

            var urg;
            if (dl <= 7) urg = 'critical';
            else if (dl <= 14) urg = 'soon';
            else urg = 'normal';

            prods.push({
                article: article,
                category: info ? info.category || 'Товар' : 'Товар',
                model: info ? info.baseArticle || article : article,
                stock: {
                    wb: ts,
                    inTransit: 0,
                    ownWarehouse: 0,
                    total: ts
                },
                sales: {
                    last30days: s30
                },
                metrics: {
                    margin: m,
                    io: io,
                    ioStatus: ioI.status,
                    ioColor: ioI.color
                },
                forecast: {
                    dailyDemand: a30,
                    daysUntilStockout: dl,
                    recommendedOrder: ro,
                    urgency: urg
                },
                sellingPrice: info ? info.price || 0 : 0,
                costPrice: info ? info.cost || 0 : 0
            });
        });

        var filt = prods.filter(function(p) {
            if (sq && p.article.toLowerCase().indexOf(sq) === -1) return false;
            if (fl === 'critical' && p.forecast.urgency !== 'critical') return false;
            if (fl === 'soon' && p.forecast.urgency !== 'soon') return false;
            if (fl === 'normal' && p.forecast.urgency !== 'normal') return false;
            return true;
        });

        filt.sort(function(a, b) {
            return a.forecast.daysUntilStockout - b.forecast.daysUntilStockout;
        });

        renderOrdersSummary(filt);
        renderOrdersList(filt);
    });
}

function renderOrdersSummary(prods) {
    var cr = prods.filter(function(p) { return p.forecast.urgency === 'critical'; }).length;
    var sn = prods.filter(function(p) { return p.forecast.urgency === 'soon'; }).length;
    var no = prods.filter(function(p) { return p.forecast.urgency === 'normal'; }).length;

    var summaryEl = document.getElementById('ordersSummary');
    if (!summaryEl) return;
    summaryEl.innerHTML =
        '<div style="display:flex;gap:14px;">' +
        '<div class="orders-summary-card critical"><div class="orders-summary-value" style="color:#EF4444;">' + cr + '</div><div class="orders-summary-label">🔴 Срочно</div></div>' +
        '<div class="orders-summary-card soon"><div class="orders-summary-value" style="color:#F59E0B;">' + sn + '</div><div class="orders-summary-label">🟡 Скоро</div></div>' +
        '<div class="orders-summary-card normal"><div class="orders-summary-value" style="color:#10B981;">' + no + '</div><div class="orders-summary-label">🟢 Норма</div></div>' +
        '</div>';
}

function renderOrdersList(prods) {
    var c = document.getElementById('ordersList');
    if (!c) return;
    var h = '';

    prods.forEach(function(p) {
        var uc = p.forecast.urgency === 'critical' ? '#EF4444' : p.forecast.urgency === 'soon' ? '#F59E0B' : '#10B981';
        var ul = p.forecast.urgency === 'critical' ? '🔴 Срочно' : p.forecast.urgency === 'soon' ? '🟡 Скоро' : '🟢 Норма';

        h += '<div class="product-group">';
        h += '<div class="product-group-header" onclick="toggleGroup(this)">';
        h += '<span class="product-group-icon">📦</span>';
        h += '<div class="product-group-info">';
        h += '<div class="product-group-name">' + p.article + '</div>';
        h += '<div class="product-group-category">' + p.category + ' · ' + p.model + '</div>';
        h += '</div>';
        h += '<div class="product-group-metrics">';
        h += '<div class="product-group-metric"><div class="product-group-metric-label">Остаток</div><div class="product-group-metric-value">' + p.stock.total + '</div></div>';
        h += '<div class="product-group-metric"><div class="product-group-metric-label">Продаж/д</div><div class="product-group-metric-value">' + p.forecast.dailyDemand.toFixed(1) + '</div></div>';
        h += '<div class="product-group-metric"><div class="product-group-metric-label">Дней</div><div class="product-group-metric-value" style="color:' + uc + ';">' + p.forecast.daysUntilStockout + '</div></div>';
        h += '<div class="product-group-metric"><div class="product-group-metric-label">Заказ</div><div class="product-group-metric-value">' + p.forecast.recommendedOrder + ' шт</div></div>';
        h += '</div>';
        h += '<span class="product-group-arrow">▶</span>';
        h += '</div>';

        h += '<div class="product-group-items">';
        h += '<div style="padding:12px 16px;font-size:12px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">';
        h += '<div>WB: <strong>' + p.stock.wb + '</strong></div>';
        h += '<div>В пути: <strong>' + p.stock.inTransit + '</strong></div>';
        h += '<div>Склад: <strong>' + p.stock.ownWarehouse + '</strong></div>';
        h += '<div>Продажи 30д: <strong>' + p.sales.last30days + '</strong></div>';
        h += '<div>Маржа: <strong>' + p.metrics.margin + '%</strong></div>';
        h += '<div>Цена: <strong>' + (p.sellingPrice || 0).toLocaleString('ru-RU') + ' ₽</strong></div>';
        h += '<div style="color:' + uc + ';" colspan="3">' + ul + '</div>';
        h += '</div></div></div>';
    });

    c.innerHTML = h || '<div class="card" style="text-align:center;padding:20px;">Нет данных</div>';
}

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

function refreshAds() {
    renderAds();
}

function recalculateAdsROI() {
    return Promise.all([dbGetAll('ads'), dbGetAll('products'), loadAppSettings()]).then(function(r) {
        var ads = r[0];
        var products = r[1];
        var settings = r[2];

        var productMap = {};
        products.forEach(function(p) {
            productMap[p.article] = p;
        });

        var promises = [];
        ads.forEach(function(ad) {
            if (!ad.linkedArticle) {
                ad._roi = 0;
                ad._drr = 0;
                ad._cpc = ad.cpc || 0;
                ad._cpm = 0;
                ad._trend = ad._trend || 0;
                promises.push(dbSave('ads', ad));
                return;
            }

            var prod = productMap[ad.linkedArticle] || null;
            if (!prod) {
                ad._roi = 0;
                ad._drr = 0;
                ad._cpc = ad.cpc || 0;
                ad._cpm = 0;
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
            ad._cpc = ad.cpc || 0;
            ad._cpm = ad.impressions > 0 ? Math.round((spent / ad.impressions) * 1000) : 0;
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
        Promise.all([dbGetAll('ads'), dbGetAll('products')]).then(function(r) {
            var ads = r[0];
            var products = r[1];

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

            filt.sort(function(a, b) {
                switch (sort) {
                    case 'roi_asc':
                        return (a._roi || 0) - (b._roi || 0);
                    case 'spent_desc':
                        return (b.spent || 0) - (a.spent || 0);
                    case 'orders_desc':
                        return (b.orders_from_ad || 0) - (a.orders_from_ad || 0);
                    case 'ctr_desc':
                        return (b.ctr || 0) - (a.ctr || 0);
                    default:
                        return (b._roi || 0) - (a._roi || 0);
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

    var summaryEl = document.getElementById('adsSummary');
    if (summaryEl) summaryEl.innerHTML = h;
}

function renderAdsTable(ads) {
    var start = (adsCurrentPage - 1) * adsPerPage;
    var end = Math.min(start + adsPerPage, ads.length);
    var pageAds = ads.slice(start, end);
    var tbody = document.getElementById('adsTableBody');
    if (!tbody) return;

    if (pageAds.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align:center;padding:20px;color:#9CA3AF;">Нет кампаний</td></tr>';
        return;
    }

    var h = '';
    pageAds.forEach(function(a) {
        var roi = a._roi || 0;
        var drr = a._drr || 0;
        var cpc = a._cpc || a.cpc || 0;
        var roiColor = roi > 50 ? '#10B981' : roi > 0 ? '#F59E0B' : '#EF4444';
        var statusText = a.status === 'active' ? '🟢 Активна' : '⏸️ Приостановлена';
        var statusClass = a.status === 'active' ? 'status-active' : 'status-paused';

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
        h += '<td>' + cpc.toFixed(2) + ' ₽</td>';
        h += '<td>' + trendHtml + '</td>';
        h += '<td style="white-space:nowrap;">';
        h += '<button class="btn btn-xs btn-secondary" onclick="editCampaign(' + a.id + ')" title="Редактировать">✏️</button> ';
        h += '<button class="btn btn-xs ' + (a.status === 'active' ? 'btn-warning' : 'btn-success') + '" onclick="toggleCampaignStatus(' + a.id + ')" title="' + (a.status === 'active' ? 'Приостановить' : 'Запустить') + '">' + (a.status === 'active' ? '⏸️' : '▶️') + '</button> ';
        h += '<button class="btn btn-xs btn-danger" onclick="deleteCampaign(' + a.id + ')" title="Удалить">🗑️</button>';
        h += '</td>';
        h += '</tr>';
    });
    tbody.innerHTML = h;

    var showingEl = document.getElementById('adsShowing');
    var totalEl = document.getElementById('adsTotal');
    var pageInfoEl = document.getElementById('adsPageInfo');
    if (showingEl) showingEl.textContent = pageAds.length;
    if (totalEl) totalEl.textContent = ads.length;
    var totalPages = Math.ceil(ads.length / adsPerPage) || 1;
    if (pageInfoEl) pageInfoEl.textContent = adsCurrentPage + ' / ' + totalPages;
}

function renderAdsPagination(total) {
    var totalPages = Math.ceil(total / adsPerPage) || 1;
    if (adsCurrentPage > totalPages) adsCurrentPage = totalPages;
    var pageInfoEl = document.getElementById('adsPageInfo');
    var showingEl = document.getElementById('adsShowing');
    var totalEl = document.getElementById('adsTotal');
    if (pageInfoEl) pageInfoEl.textContent = adsCurrentPage + ' / ' + totalPages;
    if (showingEl) showingEl.textContent = Math.min(adsPerPage, total - (adsCurrentPage - 1) * adsPerPage);
    if (totalEl) totalEl.textContent = total;
}

function adsPrevPage() {
    if (adsCurrentPage > 1) {
        adsCurrentPage--;
        renderAds();
    }
}

function adsNextPage() {
    var total = adsDataCache.length;
    var totalPages = Math.ceil(total / adsPerPage) || 1;
    if (adsCurrentPage < totalPages) {
        adsCurrentPage++;
        renderAds();
    }
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
        ads.forEach(function(a) {
            if (a.id === id) ad = a;
        });
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
    if (!name) {
        showToast('❌ Введите название кампании', 'error');
        return;
    }

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
        _cpc: cpc,
        _cpm: 0,
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
        ads.forEach(function(a) {
            if (a.id === id) ad = a;
        });
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
    if (!name) {
        showToast('❌ Введите название', 'error');
        return;
    }

    var status = document.getElementById('editCampaignStatus').value;
    var cpc = parseFloat(document.getElementById('editCampaignCpc').value) || 0;
    var budget = parseFloat(document.getElementById('editCampaignBudget').value) || 0;
    var dailyLimit = parseFloat(document.getElementById('editCampaignDailyLimit').value) || 0;

    dbGetAll('ads').then(function(ads) {
        var ad = null;
        ads.forEach(function(a) {
            if (a.id === editCampaignId) ad = a;
        });
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
// РЕКЛАМА — ПРИВЯЗКА ТОВАРА
// ============================================================

function filterArticleSuggestions(inputId, listId) {
    var input = document.getElementById(inputId);
    var list = document.getElementById(listId || inputId + '_list');
    if (!input || !list) return;

    var q = input.value.toLowerCase();
    if (q.length < 1) {
        list.style.display = 'none';
        return;
    }

    dbGetAll('products').then(function(products) {
        var matches = products.filter(function(p) {
            return p.article.toLowerCase().indexOf(q) !== -1;
        }).slice(0, 8);

        if (matches.length === 0) {
            list.style.display = 'none';
            return;
        }

        var h = '';
        matches.forEach(function(m) {
            h += '<div onclick="document.getElementById(\'' + inputId + '\').value=\'' + m.article + '\';document.getElementById(\'' + (listId || inputId + '_list') + '\').style.display=\'none\';">' + m.article + '</div>';
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
        list.style.background = '#FFFFFF';
        list.style.border = '1px solid var(--border)';
        list.style.borderRadius = '6px';
        list.style.zIndex = '100';
        list.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        list.style.color = 'var(--text-primary)';
    });
}

function linkAdToArticle(adId) {
    var input = document.getElementById('adLink_' + adId);
    if (!input) return;

    var article = input.value.trim();
    if (!article) {
        showToast('❌ Введите артикул', 'error');
        return;
    }

    dbGetAll('ads').then(function(ads) {
        var ad = null;
        ads.forEach(function(a) {
            if (a.id === adId) ad = a;
        });
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
// ИМПОРТ ДАННЫХ
// ============================================================

function downloadTemplate(type) {
    var hd, ex, fn;

    if (type === 'sales') {
        hd = ['Артикул продавца', 'Дата', 'Заказано', 'Выкуплено', 'Сумма заказов', 'Возвраты'];
        ex = ['21_К_Вельвет_голубой_40', '23.07.2026', '5', '4', '16000', '0'];
        fn = 'StockFlow_Шаблон_Продажи.xlsx';
    } else if (type === 'stock') {
        hd = ['Артикул продавца', 'Размер', 'Склад', 'Всего на складе', 'В пути', 'Возвраты'];
        ex = ['21_К_Вельвет_голубой_40', '40', 'Коледино', '50', '10', '2'];
        fn = 'StockFlow_Шаблон_Остатки.xlsx';
    } else if (type === 'ads') {
        hd = ['Раздел', 'Тип Ставки', 'ID', 'Кампания', 'Бренд', 'Старт', 'Финиш', 'Показы', 'Частота', 'Клики', 'CPC', 'CPM', 'CTR(%)', 'Место', 'Длительность', 'CR(%)', 'Затраты', 'Заказанные товары, шт', 'Добавления в корзину', 'Валюта'];
        ex = ['Аукцион', 'Единая Ставка', '36386799', 'Кампания от 06.05.2025', '', '2026-05-06', '2026-07-27', '1', '1', '0', '0', '350', '0', '', '1972:01:47', '0', '0,35', '0', '0', 'RUB'];
        fn = 'StockFlow_Шаблон_Реклама.xlsx';
    } else if (type === 'costs') {
        hd = ['Артикул продавца', 'Себестоимость'];
        ex = ['21_К_Вельвет_голубой_40', '960'];
        fn = 'StockFlow_Шаблон_Себестоимость.xlsx';
    } else {
        return;
    }

    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.aoa_to_sheet([hd, ex]);
    ws['!cols'] = hd.map(function() { return { wch: 20 }; });
    XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
    XLSX.writeFile(wb, fn);
}

function setupImportDropZone(dzId, fiId, type) {
    var dz = document.getElementById(dzId);
    var fi = document.getElementById(fiId);
    if (!dz || !fi) return;

    dz.addEventListener('click', function() { fi.click(); });

    dz.addEventListener('dragover', function(e) {
        e.preventDefault();
        dz.classList.add('dragover');
    });

    dz.addEventListener('dragleave', function() {
        dz.classList.remove('dragover');
    });

    dz.addEventListener('drop', function(e) {
        e.preventDefault();
        dz.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            processImportFile(e.dataTransfer.files[0], type);
        }
    });

    fi.addEventListener('change', function() {
        if (fi.files.length > 0) {
            processImportFile(fi.files[0], type);
            fi.value = '';
        }
    });
}

function processImportFile(file, type) {
    var se = document.getElementById(type + 'ImportStatus');
    if (se) se.innerHTML = '<span style="color:#F59E0B;">⏳ Обработка...</span>';

    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var wb = XLSX.read(e.target.result, { type: 'array' });
            var sh = wb.Sheets[wb.SheetNames[0]];
            var data = XLSX.utils.sheet_to_json(sh, { defval: '' });

            if (data.length === 0) {
                if (se) se.innerHTML = '<span style="color:#EF4444;">❌ Файл пуст</span>';
                return;
            }

            var mapped = [];
            var errs = [];

            if (type === 'sales') mapped = mapSalesData(data, errs);
            else if (type === 'stock') mapped = mapStockData(data, errs);
            else if (type === 'ads') mapped = mapAdsData(data);
            else if (type === 'costs') mapped = mapCostsData(data);

            if (mapped.length === 0) {
                if (se) se.innerHTML = '<span style="color:#EF4444;">❌ Нет данных для импорта</span>';
                return;
            }

            var sn = type === 'sales' ? 'sales' :
                type === 'stock' ? 'stock' :
                type === 'ads' ? 'ads' :
                'products';

            dbClear(sn).then(function() {
                return Promise.all(mapped.map(function(x) {
                    return dbSave(sn, x);
                }));
            }).then(function() {
                var msg = '✅ Импортировано ' + mapped.length + ' записей';
                if (se) se.innerHTML = '<span style="color:#10B981;">' + msg + '</span>';
                showToast(msg, 'success');

                if (type === 'ads') {
                    recalculateAdsROI().then(function() {
                        updateAdsPage();
                    });
                } else if (type === 'costs') {
                    updateProductList();
                    updateDashboard();
                } else {
                    updateDashboard();
                    updateProductList();
                    updateOrdersPage();
                }

                updateDBStats();
            }).catch(function(err) {
                if (se) se.innerHTML = '<span style="color:#EF4444;">❌ Ошибка: ' + err.message + '</span>';
            });
        } catch (err) {
            if (se) se.innerHTML = '<span style="color:#EF4444;">❌ Ошибка: ' + err.message + '</span>';
        }
    };

    reader.onerror = function() {
        if (se) se.innerHTML = '<span style="color:#EF4444;">❌ Ошибка чтения файла</span>';
    };

    reader.readAsArrayBuffer(file);
}

// ============================================================
// МАППЕРЫ ДАННЫХ
// ============================================================

function mapSalesData(data, errs) {
    var keys = Object.keys(data[0]);
    var gk = function(p) {
        return keys.find(function(k) {
            return p.some(function(x) { return k.toLowerCase().indexOf(x) !== -1; });
        });
    };

    var kA = gk(['артикул', 'article']) || keys[0];
    var kD = gk(['дата', 'date']) || keys[1];
    var kO = gk(['заказано', 'orders']) || keys[2];
    var kDel = gk(['выкуплено', 'delivered']) || keys[3];
    var kAm = gk(['сумма', 'amount']) || keys[4];
    var kR = gk(['возврат', 'returns']) || keys[5];

    var mapped = [];
    data.forEach(function(r, i) {
        var a = String(r[kA] || '').trim();
        if (!a) {
            errs.push({ row: i + 1, error: 'Пустой артикул' });
            return;
        }

        mapped.push({
            id: Date.now() + Math.random(),
            article: a,
            date: String(r[kD] || '').trim() || getYesterdayStr(),
            orders: parseInt(r[kO]) || 0,
            delivered: parseInt(r[kDel]) || 0,
            returns: parseInt(r[kR]) || 0,
            amount: parseFloat(String(r[kAm] || '0').replace(',', '.').replace(/\s/g, '')) || 0
        });
    });

    return mapped;
}

function mapStockData(data, errs) {
    var keys = Object.keys(data[0]);
    var gk = function(p) {
        return keys.find(function(k) {
            return p.some(function(x) { return k.toLowerCase().indexOf(x) !== -1; });
        });
    };

    var kA = gk(['артикул', 'article']) || keys[0];
    var kS = gk(['размер', 'size']) || keys[1];
    var kW = gk(['склад', 'warehouse']) || keys[2];
    var kAv = gk(['всего', 'available']) || keys[3];
    var kT = gk(['пути', 'transit']) || keys[4];
    var kR = gk(['возврат', 'returns']) || keys[5];

    var mapped = [];
    data.forEach(function(r, i) {
        var a = String(r[kA] || '').trim();
        if (!a) {
            errs.push({ row: i + 1, error: 'Пустой артикул' });
            return;
        }

        mapped.push({
            id: Date.now() + Math.random(),
            article: a,
            size: String(r[kS] || '').trim(),
            warehouse: String(r[kW] || 'Склад').trim(),
            available: parseInt(r[kAv]) || 0,
            inTransit: parseInt(r[kT]) || 0,
            returns: parseInt(r[kR]) || 0
        });
    });

    return mapped;
}

function mapAdsData(data) {
    var keys = Object.keys(data[0]);
    var gk = function(p) {
        return keys.find(function(k) {
            return p.some(function(x) { return k.toLowerCase().indexOf(x) !== -1; });
        });
    };

    var kCamp = gk(['кампания', 'campaign']) || keys[3];
    var kType = gk(['тип ставки', 'тип']) || keys[1];
    var kId = gk(['id']) || keys[2];
    var kImpr = gk(['показы', 'impressions']) || keys[7];
    var kClicks = gk(['клики', 'clicks']) || keys[9];
    var kCpc = gk(['cpc']) || keys[10];
    var kCtr = gk(['ctr']) || keys[12];
    var kCr = gk(['cr']) || keys[15];
    var kSpent = gk(['затраты', 'spent']) || keys[16];
    var kOrders = gk(['заказанные', 'orders']) || keys[17];

    var mapped = [];
    data.forEach(function(r) {
        var camp = String(r[kCamp] || '').trim();
        if (!camp) return;

        mapped.push({
            id: Date.now() + Math.random(),
            campaign: camp,
            type: String(r[kType] || '').trim(),
            wbId: String(r[kId] || '').trim(),
            impressions: parseInt(r[kImpr]) || 0,
            clicks: parseInt(r[kClicks]) || 0,
            cpc: parseFloat(String(r[kCpc] || '0').replace(',', '.')) || 0,
            ctr: parseFloat(String(r[kCtr] || '0').replace(',', '.')) || 0,
            cr: parseFloat(String(r[kCr] || '0').replace(',', '.')) || 0,
            spent: parseFloat(String(r[kSpent] || '0').replace(',', '.')) || 0,
            orders_from_ad: parseInt(r[kOrders]) || 0,
            linkedArticle: null,
            status: 'active',
            budget: 0,
            dailyLimit: 0,
            _roi: 0,
            _drr: 0,
            _cpc: 0,
            _cpm: 0,
            _trend: 0,
            created: getYesterdayStr()
        });
    });

    return mapped;
}

function mapCostsData(data) {
    var keys = Object.keys(data[0]);
    var kArticle = keys.find(function(k) {
        return k.toLowerCase().indexOf('артикул') !== -1 ||
            k.toLowerCase().indexOf('article') !== -1;
    }) || keys[0];

    var kCost = keys.find(function(k) {
        return k.toLowerCase().indexOf('себестоим') !== -1 ||
            k.toLowerCase().indexOf('cost') !== -1;
    }) || keys[1];

    var mapped = [];
    data.forEach(function(row) {
        var article = String(row[kArticle] || '').trim();
        if (!article) return;

        var cost = parseFloat(String(row[kCost] || '0').replace(',', '.')) || 0;

        mapped.push({
            id: Date.now() + Math.random(),
            article: article,
            cost: cost,
            baseArticle: article.split('_').slice(0, -2).join('_'),
            category: 'Товар',
            price: 0,
            color: '',
            size: article.split('_').pop(),
            barcode: ''
        });
    });

    return mapped;
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

    var bc = document.getElementById('backContext');
    var cp = '';
    document.querySelectorAll('.nav-item.active').forEach(function(x) {
        cp = x.getAttribute('data-page');
    });

    if (cp === 'orders') bc.textContent = 'из Заказов';
    else if (cp === 'supplies') bc.textContent = 'из Поставок';
    else if (cp === 'warehouse') bc.textContent = 'из Склада';
    else if (cp === 'ads') bc.textContent = 'из Рекламы';
    else bc.textContent = 'из Товаров';

    Promise.all([dbGetAll('sales'), dbGetAll('stock'), dbGetAll('products'), loadAppSettings()]).then(function(r) {
        var sales = r[0],
            stock = r[1],
            products = r[2],
            settings = r[3];

        var info = null;
        products.forEach(function(p) {
            if (p.article === article) info = p;
        });

        if (!info) {
            info = {
                article: article,
                baseArticle: article.split('_').slice(0, -2).join('_'),
                category: 'Товар',
                price: 0,
                cost: 0,
                color: '',
                size: article.split('_').pop(),
                barcode: ''
            };
        }

        var aSales = sales.filter(function(s) { return s.article === article; });
        var aStock = stock.filter(function(s) { return s.article === article; });

        var ts = getTotalStock(article, aStock);
        var s30 = getSales30(article, sales);
        var io = calculateIO(ts, s30);
        var ioI = getIOStatus(io);
        var m = calculateMargin(info.price || 0, info.cost || 0);
        var dl = calculateDaysLeft(ts, s30);

        function getCategoryIcon(category) {
            var icons = {
                'Костюмы': '👔',
                'Платья': '👗',
                'Жакеты': '🧥',
                'Брюки': '👖',
                'Свитеры': '🧶',
                'Товар': '📦'
            };
            return icons[category] || '📦';
        }

        document.getElementById('cardCategoryIcon').textContent = getCategoryIcon(info.category);
        document.getElementById('cardTitle').textContent = article;
        document.getElementById('cardSubtitle').textContent = (info.category || 'Товар') + ' · FBO';

        var st = '🟢 Стабильно';
        var sbg = 'rgba(16,185,129,0.15)';
        var sc = '#10B981';

        if (ioI.level === 'critical' || ts < 5) {
            st = '🔴 Проблема';
            sbg = 'rgba(239,68,68,0.15)';
            sc = '#EF4444';
        } else if (ioI.level === 'warning' || m < 0) {
            st = '🟡 Внимание';
            sbg = 'rgba(245,158,11,0.15)';
            sc = '#F59E0B';
        }

        var badge = document.getElementById('cardStatusBadge');
        badge.textContent = st;
        badge.style.background = sbg;
        badge.style.color = sc;

        document.getElementById('cardKpiPrice').textContent = (info.price || 0).toLocaleString('ru-RU') + ' ₽';

        var me = document.getElementById('cardKpiMargin');
        me.textContent = m + '%';
        me.style.color = m > 20 ? '#10B981' : m > 0 ? '#F59E0B' : '#EF4444';

        var se = document.getElementById('cardKpiStock');
        se.textContent = ts + ' шт';
        se.style.color = ts < 5 ? '#EF4444' : ts < 20 ? '#F59E0B' : '#10B981';

        var ie = document.getElementById('cardKpiIO');
        ie.textContent = io.toFixed(2);
        ie.style.color = ioI.color;

        renderCardChart(aSales, 7);
        renderCardSalesTab(aSales);
        renderCardStockTab(aStock, ts, dl, s30);
        renderCardEconomicsTab(info, ts, s30, settings);
    });
}

function closeProductCard() {
    currentCardArticle = null;
    if (cardChart) {
        cardChart.destroy();
        cardChart = null;
    }

    var bc = document.getElementById('backContext');
    if (bc.textContent.indexOf('Заказов') !== -1) navigateTo('orders');
    else if (bc.textContent.indexOf('Поставок') !== -1) navigateTo('supplies');
    else if (bc.textContent.indexOf('Склада') !== -1) navigateTo('warehouse');
    else if (bc.textContent.indexOf('Рекламы') !== -1) navigateTo('ads');
    else navigateTo('products');
}

function renderCardChart(sales, days) {
    var cv = document.getElementById('cardSalesChart');
    if (!cv) return;
    if (cardChart) {
        cardChart.destroy();
        cardChart = null;
    }

    var today = new Date();
    var lbs = [],
        od = [],
        dd = [];

    for (var i = days - 1; i >= 0; i--) {
        var d = new Date(today);
        d.setDate(d.getDate() - i);
        var ds = String(d.getDate()).padStart(2, '0') + '.' +
            String(d.getMonth() + 1).padStart(2, '0') + '.' +
            d.getFullYear();
        lbs.push(ds);

        var oo = 0,
            dv = 0;
        sales.forEach(function(s) {
            if (s.date === ds) {
                oo += s.orders || 0;
                dv += s.delivered || 0;
            }
        });
        od.push(oo);
        dd.push(dv);
    }

    cardChart = new Chart(cv.getContext('2d'), {
        type: 'line',
        data: {
            labels: lbs,
            datasets: [{
                label: 'Заказы',
                data: od,
                borderColor: '#7C3AED',
                backgroundColor: 'rgba(124,58,237,0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 2
            }, {
                label: 'Выкупы',
                data: dd,
                borderColor: '#10B981',
                borderWidth: 2,
                borderDash: [4, 3],
                fill: false,
                tension: 0.3,
                pointRadius: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#6B7280',
                        usePointStyle: true,
                        padding: 15,
                        font: { size: 11 }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: { color: '#6B7280', font: { size: 10 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#6B7280', font: { size: 9 }, maxTicksLimit: 10 }
                }
            }
        }
    });
}

function renderCardSalesTab(sales) {
    var srt = sales.slice().sort(function(a, b) {
        return b.date.localeCompare(a.date);
    });
    var tb = document.getElementById('cardSalesHistory');

    if (srt.length === 0) {
        tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Нет данных</td></tr>';
    } else {
        var h = '';
        srt.slice(0, 30).forEach(function(s) {
            h += '<tr><td>' + s.date + '</td><td>' + s.orders + '</td><td>' + s.delivered + '</td><td>' + (s.returns || 0) + '</td><td>' + (s.orders > 0 ? Math.round((s.delivered / s.orders) * 100) : 0) + '%</td></tr>';
        });
        tb.innerHTML = h;
    }

    var today = new Date();
    var wa = new Date(today);
    var twa = new Date(today);
    wa.setDate(wa.getDate() - 7);
    twa.setDate(twa.getDate() - 14);

    var tw = 0,
        pw = 0;
    sales.forEach(function(s) {
        var p = s.date.split('.');
        var sd = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
        if (sd >= wa) tw += s.orders || 0;
        else if (sd >= twa && sd < wa) pw += s.orders || 0;
    });

    var ce = document.getElementById('cardSalesCompare');
    if (pw > 0) {
        var ch = Math.round(((tw - pw) / pw) * 100);
        ce.innerHTML = 'Эта неделя: <strong>' + tw + '</strong> заказов <span style="color:' + (ch > 0 ? '#10B981' : '#EF4444') + ';">' + (ch > 0 ? '▲' : '▼') + ' ' + Math.abs(ch) + '%</span> к прошлой';
    } else {
        ce.textContent = 'Эта неделя: ' + tw + ' заказов';
    }
}

function renderCardStockTab(stock, ts, dl, s30) {
    var tb = document.getElementById('cardStockTable');

    if (stock.length === 0) {
        tb.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Нет данных</td></tr>';
    } else {
        var h = '';
        stock.forEach(function(s) {
            h += '<tr><td>' + (s.warehouse || '—') + '</td><td style="font-weight:600;">' + (s.available || 0) + '</td><td>' + (s.inTransit || 0) + '</td><td>' + (s.returns || 0) + '</td><td>' + (s.available < 5 ? '🔴 Мало' : '🟡 Норма') + '</td></tr>';
        });
        tb.innerHTML = h;
    }

    var fe = document.getElementById('cardStockForecast');
    var ds = s30 / 30;
    if (ts === 0) {
        fe.innerHTML = '<span style="color:#EF4444;">❌ Товар отсутствует</span>';
    } else if (dl <= 3) {
        fe.innerHTML = '<span style="color:#EF4444;">⚠️ Остатка на <strong>' + dl + ' дн</strong></span>';
    } else if (dl <= 7) {
        fe.innerHTML = '<span style="color:#F59E0B;">🟡 Остатка на <strong>' + dl + ' дн</strong></span>';
    } else {
        fe.innerHTML = '<span style="color:#10B981;">✅ Остатка на <strong>' + dl + ' дн</strong></span>';
    }
}

function renderCardEconomicsTab(info, ts, s30, settings) {
    var p = info.price || 0;
    var cst = info.cost || 0;

    var comm = Math.round(p * (settings.fboCommission || 15) / 100);
    var log = 150;
    var stor = Math.round((settings.storageBaseRate || 0.07) * (settings.volumePerUnit || 5) * 30);
    var ret = Math.round(p * 0.05);
    var prof = p - comm - log - stor - cst - ret;
    var tax = Math.round(p * 0.06);
    var np = prof - tax;
    var tm = parseFloat(((np / p) * 100).toFixed(1));

    var be = document.getElementById('cardEconomicsBreakdown');
    var bars = [
        { l: 'Комиссия WB', v: comm, c: 'commission' },
        { l: 'Логистика', v: log, c: 'logistics' },
        { l: 'Хранение (мес)', v: stor, c: 'storage' },
        { l: 'Себестоимость', v: cst, c: 'cost' },
        { l: 'Возвраты', v: ret, c: 'returns' },
        { l: 'Налог', v: tax, c: 'tax' }
    ];

    var mx = Math.max(comm, log, stor, cst, ret, tax);

    var h = '<div style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:12px;">Цена: ' + p.toLocaleString('ru-RU') + ' ₽</div>';
    h += '<div style="border-top:1px solid var(--border);margin-bottom:8px;"></div>';

    bars.forEach(function(b) {
        var w = mx > 0 ? Math.round((b.v / mx) * 100) : 0;
        h += '<div class="econ-bar">';
        h += '<span class="econ-bar-label">' + b.l + '</span>';
        h += '<div class="econ-bar-track"><div class="econ-bar-fill ' + b.c + '" style="width:' + w + '%;"></div></div>';
        h += '<span class="econ-bar-value" style="color:#EF4444;">−' + b.v.toLocaleString('ru-RU') + ' ₽</span>';
        h += '</div>';
    });

    h += '<div style="border-top:1px solid var(--border);margin:8px 0;"></div>';
    h += '<div class="econ-bar"><span class="econ-bar-label" style="font-weight:600;">Прибыль</span><div class="econ-bar-track"></div><span class="econ-bar-value" style="color:#10B981;">' + prof.toLocaleString('ru-RU') + ' ₽</span></div>';
    h += '<div class="econ-bar"><span class="econ-bar-label" style="font-weight:600;">ЧИСТАЯ ПРИБЫЛЬ</span><div class="econ-bar-track"></div><span class="econ-bar-value" style="color:#10B981;font-size:16px;">' + np.toLocaleString('ru-RU') + ' ₽</span></div>';
    h += '<div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">Маржа: <span style="color:' + (tm > 20 ? '#10B981' : '#F59E0B') + ';">' + tm + '%</span></div>';

    be.innerHTML = h;

    document.getElementById('cardEconomicsTotal').innerHTML =
        '<div style="font-size:12px;color:var(--text-secondary);">📊 Итого за 30 дней</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px;">' +
        '<div>Продано<div style="font-weight:600;">' + s30 + ' шт</div></div>' +
        '<div>Выручка<div style="font-weight:600;">' + (s30 * p).toLocaleString('ru-RU') + ' ₽</div></div>' +
        '<div>Прибыль<div style="font-weight:600;color:#10B981;">' + (s30 * np).toLocaleString('ru-RU') + ' ₽</div></div>' +
        '</div>';
}

// ============================================================
// ПОСТАВКИ
// ============================================================

function updateSuppliesPage() {
    renderSupplyCart();
    renderSupplyHistory();
}

function addToSupplyCart() {
    var a = document.getElementById('supplyArticle').value.trim();
    var s = document.getElementById('supplySize').value.trim();
    var q = parseInt(document.getElementById('supplyQty').value) || 1;
    var p = document.getElementById('supplyPallet').value.trim();

    if (!a) {
        showToast('❌ Введите артикул', 'error');
        return;
    }

    supplyCart.push({
        article: a,
        size: s,
        quantity: q,
        pallet: p || 'Без паллеты'
    });

    document.getElementById('supplyArticle').value = '';
    document.getElementById('supplySize').value = '';
    document.getElementById('supplyQty').value = '1';
    document.getElementById('supplyPallet').value = '';

    renderSupplyCart();
    showToast('✅ Товар добавлен', 'success');
}

function removeFromSupplyCart(i) {
    supplyCart.splice(i, 1);
    renderSupplyCart();
}

function renderSupplyCart() {
    var c = document.getElementById('supplyCart');
    var tp = 0;
    supplyCart.forEach(function(x) { tp += x.quantity; });

    document.getElementById('supplyPlaces').textContent = tp;
    document.getElementById('supplyWeight').textContent = (tp * 0.5).toFixed(1) + ' кг';
    document.getElementById('supplyVolume').textContent = (tp * 5) + ' л';

    if (supplyCart.length === 0) {
        c.innerHTML = '<div style="text-align:center;color:var(--text-secondary);padding:20px;">Корзина пуста</div>';
        return;
    }

    var h = '';
    supplyCart.forEach(function(x, i) {
        h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;">';
        h += '<span style="flex:1;">' + x.article + '</span>';
        h += '<span style="width:50px;text-align:center;">' + (x.size || '—') + '</span>';
        h += '<span style="width:50px;text-align:center;">' + x.quantity + '</span>';
        h += '<span style="width:80px;text-align:center;font-size:10px;">' + x.pallet + '</span>';
        h += '<button class="btn btn-danger btn-sm" onclick="removeFromSupplyCart(' + i + ')" style="padding:2px 6px;font-size:10px;">✕</button>';
        h += '</div>';
    });
    c.innerHTML = h;
}

function createSupply() {
    if (supplyCart.length === 0) {
        showToast('❌ Корзина пуста', 'error');
        return;
    }

    var tp = 0;
    supplyCart.forEach(function(x) { tp += x.quantity; });

    var s = {
        id: Date.now(),
        name: 'Поставка #' + new Date().toISOString().slice(0, 10).replace(/-/g, ''),
        date: getYesterdayStr(),
        items: supplyCart.length,
        places: tp,
        weight: tp * 0.5,
        volume: tp * 5,
        status: 'planned',
        cart: JSON.parse(JSON.stringify(supplyCart))
    };

    dbSave('shipments', s).then(function() {
        supplyCart = [];
        renderSupplyCart();
        renderSupplyHistory();
        showToast('✅ Поставка создана', 'success');
    });
}

function updateSupplyStatus(id, ns) {
    dbGetAll('shipments').then(function(ss) {
        var s = null;
        ss.forEach(function(x) {
            if (x.id === id) s = x;
        });
        if (!s) return;
        s.status = ns;
        return dbSave('shipments', s);
    }).then(function() {
        renderSupplyHistory();
        showToast('✅ Статус обновлён', 'success');
    });
}

function renderSupplyHistory() {
    var tb = document.getElementById('supplyHistoryBody');
    dbGetAll('shipments').then(function(ss) {
        if (ss.length === 0) {
            tb.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;">Нет поставок</td></tr>';
            return;
        }

        ss.sort(function(a, b) { return b.id - a.id; });

        var sl = {
            'planned': '📋 Запланировано',
            'in_transit': '🚛 В пути',
            'accepted': '✅ Принято',
            'archive': '📦 Архив'
        };

        var h = '';
        ss.forEach(function(s) {
            h += '<tr>';
            h += '<td>' + (s.date || '—') + '</td>';
            h += '<td>' + s.name + '</td>';
            h += '<td>' + s.items + '</td>';
            h += '<td>' + s.places + '</td>';
            h += '<td>' + (sl[s.status] || s.status) + '</td>';
            h += '<td>';
            if (s.status === 'planned') {
                h += '<button class="btn btn-primary btn-sm" onclick="updateSupplyStatus(' + s.id + ',\'in_transit\')" style="font-size:10px;padding:2px 8px;">🚛 В путь</button> ';
            }
            if (s.status === 'in_transit') {
                h += '<button class="btn btn-success btn-sm" onclick="updateSupplyStatus(' + s.id + ',\'accepted\')" style="font-size:10px;padding:2px 8px;">✅ Принято</button> ';
            }
            if (s.status === 'accepted') {
                h += '<button class="btn btn-secondary btn-sm" onclick="updateSupplyStatus(' + s.id + ',\'archive\')" style="font-size:10px;padding:2px 8px;">📦 Архив</button>';
            }
            h += '</td>';
            h += '</tr>';
        });
        tb.innerHTML = h;
    });
}

function exportSupplyForWB() {
    if (supplyCart.length === 0) {
        showToast('❌ Корзина пуста', 'error');
        return;
    }

    var data = supplyCart.map(function(x) {
        return {
            'Артикул продавца': x.article,
            'Размер': x.size || '',
            'Количество': x.quantity,
            'Номер палеты': x.pallet || 'Без паллеты'
        };
    });

    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Поставка_WB');
    XLSX.writeFile(wb, 'StockFlow_Поставка_WB_' + getYesterdayStr().replace(/\./g, '_') + '.xlsx');
    showToast('✅ Файл для WB готов', 'success');
}

function exportSupplyPackingList() {
    if (supplyCart.length === 0) {
        showToast('❌ Корзина пуста', 'error');
        return;
    }

    var grp = {};
    supplyCart.forEach(function(x) {
        var p = x.pallet || 'Без паллеты';
        if (!grp[p]) grp[p] = [];
        grp[p].push(x);
    });

    var data = [];
    Object.keys(grp).sort().forEach(function(p) {
        data.push({ 'Паллета': p, 'Артикул': '', 'Размер': '', 'Количество': '', 'Проклеить?': '' });
        grp[p].forEach(function(x) {
            data.push({ 'Паллета': '', 'Артикул': x.article, 'Размер': x.size || '', 'Количество': x.quantity, 'Проклеить?': '☐' });
        });
        data.push({ 'Паллета': '', 'Артикул': '', 'Размер': '', 'Количество': '', 'Проклеить?': '' });
    });

    var wb = XLSX.utils.book_new();
    var ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{ wch: 18 }, { wch: 30 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Сборочный_лист');
    XLSX.writeFile(wb, 'StockFlow_Сборочный_лист_' + getYesterdayStr().replace(/\./g, '_') + '.xlsx');
    showToast('✅ Сборочный лист готов', 'success');
}

function addFromWarehouseToSupply() {
    dbGetAll('warehouse').then(function(items) {
        var active = items.filter(function(i) {
            return i.type === 'item' && i.status === 'active' && i.warehouse === currentWarehouse;
        });

        if (active.length === 0) {
            showToast('❌ Нет товаров на складе', 'error');
            return;
        }

        var msg = 'Товары на складе (' + currentWarehouse + '):\n\n';
        var grouped = {};
        active.forEach(function(i) {
            var key = i.article + ' | ' + i.color + ' | ' + i.size;
            if (!grouped[key]) {
                grouped[key] = {
                    article: i.article,
                    color: i.color,
                    size: i.size,
                    qty: 0,
                    pallet: i.pallet,
                    box: i.box
                };
            }
            grouped[key].qty += i.quantity || 0;
        });

        Object.keys(grouped).forEach(function(k, idx) {
            var g = grouped[k];
            msg += (idx + 1) + '. ' + g.article + ' ' + g.color + ' ' + g.size + ' — ' + g.qty + ' шт (пал.' + g.pallet + ', ' + g.box + ')\n';
        });

        msg += '\nВведите номер товара и количество через запятую (например: 1,20):';
        var input = prompt(msg);
        if (!input) return;

        var parts = input.split(',');
        var idx = parseInt(parts[0]) - 1;
        var qty = parseInt(parts[1]) || 1;

        if (idx < 0 || idx >= Object.keys(grouped).length) {
            showToast('❌ Неверный номер', 'error');
            return;
        }

        var g = grouped[Object.keys(grouped)[idx]];
        supplyCart.push({
            article: g.article,
            size: g.size,
            quantity: qty,
            pallet: 'Склад ' + g.pallet
        });
        renderSupplyCart();
        showToast('✅ Добавлено: ' + g.article + ' x' + qty, 'success');
    });
}

// ============================================================
// МОЙ СКЛАД
// ============================================================

function updateWarehousePage() {
    renderWarehouse();
}

function switchWarehouse(name) {
    currentWarehouse = name;
    document.querySelectorAll('.wh-tab').forEach(function(t) {
        t.classList.remove('active');
    });
    document.querySelector('.wh-tab[data-warehouse="' + name + '"]').classList.add('active');
    renderWarehouse();
}

function createPallet() {
    var n = document.getElementById('newPalletNumber').value.trim();
    if (!n) {
        showToast('❌ Введите номер палеты', 'error');
        return;
    }

    dbGetAll('warehouse').then(function(items) {
        if (items.some(function(i) {
                return i.type === 'pallet' && i.warehouse === currentWarehouse && i.pallet === n;
            })) {
            showToast('❌ Паллета №' + n + ' уже существует', 'error');
            return;
        }

        return dbSave('warehouse', {
            id: Date.now(),
            type: 'pallet',
            warehouse: currentWarehouse,
            pallet: n,
            created: getYesterdayStr()
        });
    }).then(function() {
        renderWarehouse();
        showToast('✅ Паллета создана', 'success');
    });
}

function deletePallet(pn) {
    if (!confirm('Удалить палету №' + pn + ' и всё содержимое?')) return;

    dbGetAll('warehouse').then(function(items) {
        return Promise.all(items.filter(function(i) {
            return i.pallet === pn && i.warehouse === currentWarehouse;
        }).map(function(i) {
            return dbDelete('warehouse', i.id);
        }));
    }).then(function() {
        renderWarehouse();
        showToast('✅ Паллета удалена', 'success');
    });
}

function addBoxToPallet(pn, side) {
    var bl = prompt('Этикетка коробки:');
    if (!bl) return;

    dbSave('warehouse', {
        id: Date.now(),
        type: 'box',
        warehouse: currentWarehouse,
        pallet: pn,
        side: side,
        box: bl.trim(),
        created: getYesterdayStr()
    }).then(function() {
        renderWarehouse();
        showToast('✅ Коробка добавлена', 'success');
    });
}

function deleteBox(bl, pn) {
    if (!confirm('Удалить коробку ' + bl + ' с палеты №' + pn + '?')) return;

    dbGetAll('warehouse').then(function(items) {
        return Promise.all(items.filter(function(i) {
            return i.box === bl && i.pallet === pn && i.warehouse === currentWarehouse;
        }).map(function(i) {
            return dbDelete('warehouse', i.id);
        }));
    }).then(function() {
        renderWarehouse();
        showToast('✅ Коробка удалена', 'success');
    });
}

function moveBox(bl, fp) {
    var np = prompt('Переместить коробку ' + bl + ' с палеты №' + fp + ' на палету №:');
    if (!np || np === fp) return;

    dbGetAll('warehouse').then(function(items) {
        if (!items.some(function(i) {
                return i.type === 'pallet' && i.warehouse === currentWarehouse && i.pallet === np;
            })) {
            showToast('❌ Паллета №' + np + ' не найдена', 'error');
            return;
        }

        var bis = items.filter(function(i) {
            return i.box === bl && i.pallet === fp && i.warehouse === currentWarehouse;
        });

        return Promise.all(bis.map(function(i) {
            i.pallet = np;
            if (!i.history) i.history = [];
            i.history.push(getYesterdayStr() + ': пал.' + fp + ' → пал.' + np);
            return dbSave('warehouse', i);
        }));
    }).then(function() {
        renderWarehouse();
        showToast('✅ Коробка перемещена', 'success');
    });
}

function addItemToBox(bid, pn, side) {
    var a = prompt('Артикул:');
    var c = prompt('Цвет:') || '';
    var s = prompt('Размер:') || '';
    var q = parseInt(prompt('Кол-во:') || '1') || 1;

    if (!a || q <= 0) return;

    dbSave('warehouse', {
        id: Date.now(),
        type: 'item',
        warehouse: currentWarehouse,
        pallet: pn,
        side: side,
        box: bid,
        article: a,
        color: c,
        size: s,
        quantity: q,
        status: 'active',
        created: getYesterdayStr(),
        history: []
    }).then(function() {
        renderWarehouse();
        showToast('✅ Товар добавлен', 'success');
    });
}

function removeWarehouseItem(id) {
    if (!confirm('Удалить элемент?')) return;
    dbDelete('warehouse', id).then(function() {
        renderWarehouse();
        showToast('✅ Удалено', 'success');
    });
}

function renderWarehouse() {
    var c = document.getElementById('warehouseContent');
    dbGetAll('warehouse').then(function(items) {
        var pallets = items.filter(function(i) {
            return i.type === 'pallet' && i.warehouse === currentWarehouse;
        });

        if (pallets.length === 0) {
            c.innerHTML = '<div class="card" style="text-align:center;padding:30px;">📦<br>Склад пуст<br>Создайте первую палету</div>';
            return;
        }

        var h = '';
        pallets.sort(function(a, b) { return a.pallet.localeCompare(b.pallet); }).forEach(function(pallet) {
            var boxes = items.filter(function(i) {
                return i.type === 'box' && i.pallet === pallet.pallet && i.warehouse === currentWarehouse;
            });

            var itemsAll = items.filter(function(i) {
                return i.type === 'item' && i.pallet === pallet.pallet && i.warehouse === currentWarehouse && i.status === 'active';
            });

            var tq = itemsAll.reduce(function(s, i) { return s + (i.quantity || 0); }, 0);

            h += '<div class="product-group">';
            h += '<div class="product-group-header" onclick="toggleGroup(this)">';
            h += '<span class="product-group-icon">📦</span>';
            h += '<div class="product-group-info">';
            h += '<div class="product-group-name">Паллета №' + pallet.pallet + '</div>';
            h += '<div class="product-group-category">' + currentWarehouse + ' · ' + boxes.length + ' кор. · ' + tq + ' ед.</div>';
            h += '</div>';
            h += '<span class="product-group-arrow">▶</span>';
            h += '</div>';

            h += '<div class="product-group-items">';
            h += '<div style="padding:8px 16px;display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--border);">';
            h += '<button class="btn btn-secondary btn-sm" onclick="addBoxToPallet(\'' + pallet.pallet + '\',\'лицевая\')">➕ Коробка (лицо)</button>';
            h += '<button class="btn btn-secondary btn-sm" onclick="addBoxToPallet(\'' + pallet.pallet + '\',\'обратная\')">➕ Коробка (оборот)</button>';
            h += '<button class="btn btn-danger btn-sm" onclick="deletePallet(\'' + pallet.pallet + '\')" style="margin-left:auto;">🗑️ Удалить палету</button>';
            h += '</div>';

            boxes.forEach(function(box) {
                var bis = itemsAll.filter(function(i) { return i.box === box.box; });
                var bq = bis.reduce(function(s, i) { return s + (i.quantity || 0); }, 0);

                h += '<div style="padding:6px 16px 6px 24px;border-bottom:1px solid var(--border);">';
                h += '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;">';
                h += '<span><strong>' + box.box + '</strong> (' + box.side + ') — ' + bq + ' ед.</span>';
                h += '<div style="display:flex;gap:4px;">';
                h += '<button class="btn btn-primary btn-sm" onclick="addItemToBox(\'' + box.box + '\',\'' + pallet.pallet + '\',\'' + box.side + '\')" style="font-size:10px;padding:2px 8px;">➕ Товар</button>';
                h += '<button class="btn btn-secondary btn-sm" onclick="moveBox(\'' + box.box + '\',\'' + pallet.pallet + '\')" style="font-size:10px;padding:2px 8px;">↔</button>';
                h += '<button class="btn btn-danger btn-sm" onclick="deleteBox(\'' + box.box + '\',\'' + pallet.pallet + '\')" style="font-size:10px;padding:2px 8px;">🗑️</button>';
                h += '</div></div>';

                if (bis.length > 0) {
                    h += '<div style="margin-top:4px;font-size:11px;color:var(--text-secondary);">';
                    bis.forEach(function(item) {
                        h += '<div style="padding:2px 0;">' + item.article + ' ' + item.color + ' ' + item.size + ' — ' + item.quantity + ' шт ';
                        h += '<button class="btn btn-danger btn-sm" onclick="removeWarehouseItem(' + item.id + ')" style="font-size:9px;padding:1px 6px;">✕</button>';
                        h += '</div>';
                    });
                    h += '</div>';
                }
                h += '</div>';
            });

            h += '</div></div>';
        });

        c.innerHTML = h;
    });
}

// ============================================================
// ОЧИСТКА ДАННЫХ
// ============================================================

function clearAllData() {
    if (!confirm('⚠️ ВНИМАНИЕ! Это действие удалит ВСЕ данные:\n\n' +
            '• Продажи\n' +
            '• Остатки\n' +
            '• Рекламу\n' +
            '• Товары\n' +
            '• Поставки\n' +
            '• Склад\n\n' +
            'Вы уверены, что хотите продолжить?')) return;

    var promises = STORES.map(function(store) {
        return dbClear(store);
    });

    Promise.all(promises).then(function() {
        supplyCart = [];
        selectedAds = [];
        adsCurrentPage = 1;

        updateDashboard();
        updateProductList();
        updateOrdersPage();
        updateSuppliesPage();
        updateWarehousePage();
        updateAdsPage();
        updateDBStats();

        showToast('✅ Все данные очищены', 'success');
    }).catch(function(err) {
        showToast('❌ Ошибка: ' + err.message, 'error');
    });
}

function clearCache() {
    if (!confirm('Очистить кеш приложения? Это перезагрузит страницу.')) return;

    localStorage.clear();
    window.location.reload();
}

// ============================================================
// ЗАПУСК ПРИЛОЖЕНИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    // Навигация по вкладкам
    document.querySelectorAll('.nav-item').forEach(function(item) {
        item.addEventListener('click', function() {
            navigateTo(this.getAttribute('data-page'));
        });
    });

    // Логотип → Главная
    document.getElementById('sidebarLogo').addEventListener('click', function() {
        navigateTo('dashboard');
    });

    // Кнопка профиля (заглушка)
    document.getElementById('profileBtn').addEventListener('click', function() {
        showToast('👤 Личный кабинет в разработке', 'success');
    });

    // Проверка БД
    checkDatabase();

    // Кнопки на Главной
    document.getElementById('refreshDashboardBtn').addEventListener('click', updateDashboard);

    // Настройки
    loadSettings();
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
    document.getElementById('taxSystem').addEventListener('change', togglePatentField);

    // Товары
    document.getElementById('productSearch').addEventListener('input', refreshProductTable);
    document.getElementById('productFilter').addEventListener('change', refreshProductTable);
    document.getElementById('clearFilterBtn').addEventListener('click', function() {
        document.getElementById('productSearch').value = '';
        document.getElementById('productFilter').value = 'all';
        refreshProductTable();
    });

    // Заказы
    var periodSelect = document.getElementById('ordersPeriodSelect');
    if (periodSelect) periodSelect.addEventListener('change', renderOrders);
    document.getElementById('ordersSearch').addEventListener('input', renderOrders);
    document.getElementById('ordersFilter').addEventListener('change', renderOrders);
    document.getElementById('clearOrdersFilterBtn').addEventListener('click', function() {
        document.getElementById('ordersSearch').value = '';
        document.getElementById('ordersFilter').value = 'all';
        renderOrders();
    });
    document.getElementById('exportOrdersBtn').addEventListener('click', function() {
        showToast('📤 Экспорт в разработке', 'success');
    });

    // Поставки
    document.getElementById('addToSupplyBtn').addEventListener('click', addToSupplyCart);
    document.getElementById('createSupplyBtn').addEventListener('click', createSupply);
    document.getElementById('addFromWarehouseBtn').addEventListener('click', addFromWarehouseToSupply);

    // Карточка
    document.getElementById('backToProductsBtn').addEventListener('click', closeProductCard);

    // График
    document.querySelectorAll('.card-chart-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.card-chart-btn').forEach(function(b) {
                b.classList.remove('active');
            });
            this.classList.add('active');

            if (currentCardArticle) {
                dbGetAll('sales').then(function(sales) {
                    renderCardChart(
                        sales.filter(function(s) { return s.article === currentCardArticle; }),
                        parseInt(this.getAttribute('data-card-period'))
                    );
                }.bind(this));
            }
        });
    });

    // Вкладки в карточке
    document.querySelectorAll('.card-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.card-tab').forEach(function(t) {
                t.classList.remove('active');
            });
            this.classList.add('active');

            var tn = this.getAttribute('data-card-tab');
            document.querySelectorAll('.card-tab-content').forEach(function(c) {
                c.style.display = 'none';
            });

            var ct = document.getElementById('cardTab' + tn.charAt(0).toUpperCase() + tn.slice(1));
            if (ct) ct.style.display = 'block';
        });
    });

    // Импорт
    document.getElementById('downloadSalesTemplateBtn').addEventListener('click', function() {
        downloadTemplate('sales');
    });
    document.getElementById('downloadStockTemplateBtn').addEventListener('click', function() {
        downloadTemplate('stock');
    });
    document.getElementById('downloadAdsTemplateBtn').addEventListener('click', function() {
        downloadTemplate('ads');
    });
    document.getElementById('downloadCostsTemplateBtn').addEventListener('click', function() {
        downloadTemplate('costs');
    });

    setupImportDropZone('salesDropZone', 'salesFileInput', 'sales');
    setupImportDropZone('stockDropZone', 'stockFileInput', 'stock');
    setupImportDropZone('adsDropZone', 'adsFileInput', 'ads');
    setupImportDropZone('costsDropZone', 'costsFileInput', 'costs');

    // Склад
    document.getElementById('createPalletBtn').addEventListener('click', createPallet);
    document.querySelectorAll('.wh-tab').forEach(function(tab) {
        tab.addEventListener('click', function() {
            switchWarehouse(this.getAttribute('data-warehouse'));
        });
    });

    // Модалки
    document.getElementById('campaignModal').addEventListener('click', function(e) {
        if (e.target === this) closeCampaignModal();
    });
    document.getElementById('editCampaignModal').addEventListener('click', function(e) {
        if (e.target === this) closeEditCampaignModal();
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeCampaignModal();
            closeEditCampaignModal();
        }
    });

    document.getElementById('adsPerPage').addEventListener('change', function() {
        adsPerPage = parseInt(this.value) || 25;
        adsCurrentPage = 1;
        renderAds();
    });

    document.getElementById('clearAllDataBtn').addEventListener('click', clearAllData);
    document.getElementById('clearCacheBtn').addEventListener('click', clearCache);

    updateDashboard();
});

function refreshProductTable() {
    Promise.all([dbGetAll('sales'), dbGetAll('stock'), dbGetAll('products')]).then(function(r) {
        renderGroupedProducts(r[0], r[1], r[2]);
    });
}
