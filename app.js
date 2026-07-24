// ============================================================
// КОНСТАНТЫ ПРИЛОЖЕНИЯ
// ============================================================

var APP_VERSION = '5.0.0';
var APP_STAGE = 'Alpha';

var DB_NAME = 'BeltaneeDB_v5';
var DB_VERSION = 1;
var STORES = ['sales', 'stock', 'settings'];

// Текущий открытый товар в карточке
var currentCardArticle = null;
// Объект графика карточки
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
            category: p.category,
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
        var ioDisplay = p.io.toFixed(2);

        html += '<tr style="cursor: pointer;" onclick="openProductCard(\'' + p.article + '\')">';
        html += '<td style="font-weight: 500;">' + p.article + '</td>';
        html += '<td>' + p.price.toLocaleString('ru-RU') + ' ₽</td>';
        html += '<td style="color: ' + marginColor + '; font-weight: 600;">' + p.margin + '%</td>';
        html += '<td style="color: ' + stockColor + '; font-weight: 600;">' + p.stock + ' шт</td>';
        html += '<td style="color: ' + p.ioColor + '; font-weight: 600;">' + ioDisplay + '</td>';
        html += '<td>' + p.sales30 + '</td>';
        html += '<td>' + (p.daysLeft === 999 ? '—' : p.daysLeft) + '</td>';
        html += '</tr>';
    });

    tbody.innerHTML = html;
}

// ============================================================
// КАРТОЧКА ТОВАРА
// ============================================================

function openProductCard(article) {
    currentCardArticle = article;

    // Скрываем все страницы, показываем карточку
    document.querySelectorAll('.page').forEach(function(p) {
        p.classList.remove('active');
    });
    document.getElementById('page-product-card').classList.add('active');

    // Загружаем данные
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

        // Шапка
        var categoryIcons = {
            'Костюмы': '👔', 'Платья': '👗', 'Жакеты': '🧥',
            'Брюки': '👖', 'Свитеры': '🧶', 'Товар': '📦'
        };
        document.getElementById('cardCategoryIcon').textContent = categoryIcons[productInfo.category] || '📦';
        document.getElementById('cardTitle').textContent = article;
        document.getElementById('cardSubtitle').textContent = productInfo.category + ' · FBO';

        // Статус
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

        // KPI
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

        // График
        renderCardChart(articleSales, 7);

        // Вкладка Продажи
        renderCardSalesTab(articleSales);

        // Вкладка Остатки
        renderCardStockTab(articleStock, totalStock, daysLeft, sales30);

        // Вкладка Экономика
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

// График в карточке
function renderCardChart(sales, days) {
    var canvas = document.getElementById('cardSalesChart');
    if (!canvas) return;

    if (cardChart) {
        cardChart.destroy();
        cardChart = null;
    }

    // Готовим данные за последние N дней
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

// Вкладка Продажи
function renderCardSalesTab(sales) {
    // Таблица истории
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

    // Сравнение недель
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

// Вкладка Остатки
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

    // Прогноз
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

// Вкладка Экономика
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

    var html = '<div style="font-size: 16px; font-weight: 700; color: #F0F0FF; margin-bottom: 12px;">Цена продажи: ' + price.toLocaleString('ru-RU') + ' ₽</div>';
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
    html += '<span class="econ-bar-label" style="font-weight: 700;">Прибыль с единицы</span>';
    html += '<div class="econ-bar-track"></div>';
    html += '<span class="econ-bar-value" style="color: #10B981; font-size: 14px;">' + profit.toLocaleString('ru-RU') + ' ₽</span>';
    html += '</div>';
    html += '<div class="econ-bar">';
    html += '<span class="econ-bar-label" style="font-weight: 700;">ЧИСТАЯ ПРИБЫЛЬ</span>';
    html += '<div class="econ-bar-track"></div>';
    html += '<span class="econ-bar-value" style="color: #10B981; font-size: 16px; font-weight: 700;">' + netProfit.toLocaleString('ru-RU') + ' ₽</span>';
    html += '</div>';
    html += '<div style="font-size: 13px; color: #9CA3AF; margin-top: 4px;">Маржинальность: <span style="color: ' + (totalMargin > 20 ? '#10B981' : '#F59E0B') + '; font-weight: 700;">' + totalMargin + '%</span></div>';
    breakdownEl.innerHTML = html;

    // Итого за 30 дней
    var monthlyRevenue = sales30 * price;
    var monthlyCosts = sales30 * (commission + logistics + storageCost + cost + returnsLoss + tax);
    var monthlyProfit = monthlyRevenue - monthlyCosts;
    document.getElementById('cardEconomicsTotal').innerHTML =
        '<div style="font-size: 12px; color: #9CA3AF;">📊 Итого за 30 дней</div>' +
        '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-top: 6px;">' +
        '<div><span style="color: #9CA3AF; font-size: 10px;">Продано</span><div style="font-weight: 700; color: #F0F0FF;">' + sales30 + ' шт</div></div>' +
        '<div><span style="color: #9CA3AF; font-size: 10px;">Выручка</span><div style="font-weight: 700; color: #F0F0FF;">' + monthlyRevenue.toLocaleString('ru-RU') + ' ₽</div></div>' +
        '<div><span style="color: #9CA3AF; font-size: 10px;">Чистая прибыль</span><div style="font-weight: 700; color: #10B981;">' + monthlyProfit.toLocaleString('ru-RU') + ' ₽</div></div>' +
        '</div>';
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

    // Кнопка "Назад к списку" в карточке товара
    document.getElementById('backToProductsBtn').addEventListener('click', closeProductCard);

    // Кнопки периода графика
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

    // Вкладки карточки
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

    // Обновляем главную при старте
    updateDashboard();
});

function refreshProductTable() {
    Promise.all([dbGetAll('sales'), dbGetAll('stock')]).then(function(results) {
        var products = buildProductList(results[0], results[1]);
        renderProductTable(products);
    });
}
