// ============================================================
// UI: SALES ANALYTICS — АНАЛИТИКА ПРОДАЖ
// ============================================================

import SalesService from '../services/SalesService.js';
import ProductService from '../services/ProductService.js';

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let currentPeriod = 30; // 7, 14, 30
let salesChartInstance = null;

// ============================================================
// ПОЛУЧЕНИЕ ДАННЫХ
// ============================================================

async function getSalesAnalytics(period) {
    console.log('🔍 Загрузка аналитики продаж за', period, 'дней');
    
    // Получаем все продажи
    const allSales = await SalesService.getAll();
    console.log('📊 Всего продаж в базе:', allSales.length);
    
    if (allSales.length === 0) {
        return {
            chartData: [],
            topProducts: [],
            summary: { revenue: 0, orders: 0, delivered: 0, avgOrderValue: 0 },
            totalRecords: 0
        };
    }

    // Получаем товары для сопоставления артикулов
    const products = await ProductService.getAll();
    const productMap = {};
    products.forEach(p => {
        productMap[p.id] = p.article;
    });

    // Фильтруем по периоду
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - period);
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = today.toISOString().split('T')[0];

    console.log('📅 Период:', startStr, '—', endStr);

    const filtered = allSales.filter(s => s.date >= startStr && s.date <= endStr);
    console.log('📊 Продаж за период:', filtered.length);

    if (filtered.length === 0) {
        return {
            chartData: [],
            topProducts: [],
            summary: { revenue: 0, orders: 0, delivered: 0, avgOrderValue: 0 },
            totalRecords: 0
        };
    }

    // Агрегируем по дням
    const dailyData = {};
    filtered.forEach(s => {
        if (!dailyData[s.date]) {
            dailyData[s.date] = { revenue: 0, orders: 0, delivered: 0, count: 0 };
        }
        dailyData[s.date].revenue += s.amount || 0;
        dailyData[s.date].orders += s.orders || 0;
        dailyData[s.date].delivered += s.delivered || 0;
        dailyData[s.date].count += 1;
    });

    // Сортируем по датам
    const sortedDates = Object.keys(dailyData).sort();
    const chartData = sortedDates.map(date => {
        // Форматируем дату для отображения (DD.MM)
        const parts = date.split('-');
        const day = parts[2];
        const month = parts[1];
        const displayDate = `${day}.${month}`;
        return {
            date: displayDate,
            dateFull: date,
            revenue: dailyData[date].revenue,
            orders: dailyData[date].orders,
            delivered: dailyData[date].delivered
        };
    });

    // Топ-5 товаров по выручке
    const productSales = {};
    filtered.forEach(s => {
        // ✅ Используем article из записи, если есть
        let article = s.article || productMap[s.productId] || s.productId;
        // ✅ Убираем суффикс |nosize|nocolor если есть
        article = article.replace(/\|nosize\|nocolor$/i, '');
        
        if (!productSales[article]) {
            productSales[article] = { revenue: 0, orders: 0 };
        }
        productSales[article].revenue += s.amount || 0;
        productSales[article].orders += s.orders || 0;
    });

    const topProducts = Object.keys(productSales)
        .map(article => ({
            article,
            revenue: productSales[article].revenue,
            orders: productSales[article].orders
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    // Итоговые показатели
    const totalRevenue = filtered.reduce((sum, s) => sum + (s.amount || 0), 0);
    const totalOrders = filtered.reduce((sum, s) => sum + (s.orders || 0), 0);
    const totalDelivered = filtered.reduce((sum, s) => sum + (s.delivered || 0), 0);
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    console.log('📊 Итоги:', {
        revenue: totalRevenue,
        orders: totalOrders,
        delivered: totalDelivered,
        avgOrderValue
    });

    return {
        chartData,
        topProducts,
        summary: {
            revenue: totalRevenue,
            orders: totalOrders,
            delivered: totalDelivered,
            avgOrderValue
        },
        totalRecords: filtered.length
    };
}

// ============================================================
// ОТРИСОВКА
// ============================================================

export async function renderSalesAnalytics() {
    console.log('📊 Рендеринг аналитики продаж...');

    const container = document.getElementById('salesAnalyticsContent');
    if (!container) {
        console.warn('⚠️ Контейнер salesAnalyticsContent не найден');
        return;
    }

    try {
        const data = await getSalesAnalytics(currentPeriod);

        if (data.totalRecords === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:40px;">
                    <div style="font-size:48px;margin-bottom:12px;">📊</div>
                    <div style="font-size:18px;font-weight:600;margin-bottom:6px;">Нет данных</div>
                    <div style="font-size:14px;color:var(--text-secondary);">
                        Импортируйте продажи в разделе «Импорт»
                    </div>
                    <button class="btn btn-primary" onclick="navigateTo('import')" style="margin-top:12px;">
                        📥 Перейти к импорту
                    </button>
                </div>
            `;
            return;
        }

        // Строим HTML
        let html = '';

        // 1. Выбор периода
        html += `
            <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
                <button class="btn ${currentPeriod === 7 ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.setSalesPeriod(7)">7 дней</button>
                <button class="btn ${currentPeriod === 14 ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.setSalesPeriod(14)">14 дней</button>
                <button class="btn ${currentPeriod === 30 ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.setSalesPeriod(30)">30 дней</button>
                <span style="flex:1;"></span>
                <span style="font-size:12px;color:var(--text-secondary);padding:6px 0;">
                    Период: ${currentPeriod} дней
                </span>
            </div>
        `;

        // 2. Итоговые показатели
        html += `
            <div class="grid-4" style="margin-bottom:16px;">
                <div class="kpi-card">
                    <div class="kpi-icon">💰</div>
                    <div class="kpi-info">
                        <span class="kpi-label">Выручка</span>
                        <span class="kpi-value">${data.summary.revenue.toLocaleString()} ₽</span>
                    </div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon">🛒</div>
                    <div class="kpi-info">
                        <span class="kpi-label">Заказы</span>
                        <span class="kpi-value">${data.summary.orders}</span>
                    </div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon">✅</div>
                    <div class="kpi-info">
                        <span class="kpi-label">Выкупы</span>
                        <span class="kpi-value">${data.summary.delivered}</span>
                    </div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon">📊</div>
                    <div class="kpi-info">
                        <span class="kpi-label">Средний чек</span>
                        <span class="kpi-value">${Math.round(data.summary.avgOrderValue).toLocaleString()} ₽</span>
                    </div>
                </div>
            </div>
        `;

        // 3. График
        html += `
            <div class="card" style="margin-bottom:16px;">
                <div class="card-title">📈 Динамика продаж</div>
                <div style="height:250px;">
                    <canvas id="salesAnalyticsChart"></canvas>
                </div>
            </div>
        `;

        // 4. Топ-5 товаров
        html += `
            <div class="card">
                <div class="card-title">🏆 Топ-5 товаров по выручке</div>
                <div style="overflow-x:auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Артикул</th>
                                <th>Заказы</th>
                                <th>Выручка</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.topProducts.map((p, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td><strong>${p.article}</strong></td>
                                    <td>${p.orders}</td>
                                    <td style="font-weight:600;color:#10B981;">${p.revenue.toLocaleString()} ₽</td>
                                </tr>
                            `).join('')}
                            ${data.topProducts.length === 0 ? `
                                <tr><td colspan="4" style="text-align:center;padding:20px;">Нет данных</td></tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Рисуем график после рендеринга
        setTimeout(() => renderSalesChart(data.chartData), 100);

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        container.innerHTML = `
            <div class="card" style="text-align:center;padding:30px;color:#EF4444;">
                <div style="font-size:48px;margin-bottom:12px;">❌</div>
                <div style="font-size:15px;font-weight:600;margin-bottom:6px;">Ошибка загрузки</div>
                <div style="font-size:13px;color:var(--text-secondary);">${error.message}</div>
            </div>
        `;
    }
}

// ============================================================
// ГРАФИК
// ============================================================

function renderSalesChart(chartData) {
    const canvas = document.getElementById('salesAnalyticsChart');
    if (!canvas) return;

    if (salesChartInstance) {
        salesChartInstance.destroy();
        salesChartInstance = null;
    }

    if (!chartData || chartData.length === 0) {
        console.warn('⚠️ Нет данных для графика');
        return;
    }

    const ctx = canvas.getContext('2d');
    const labels = chartData.map(d => d.date);
    const revenueData = chartData.map(d => d.revenue);
    const ordersData = chartData.map(d => d.orders);

    salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Выручка',
                    data: revenueData,
                    borderColor: '#7C3AED',
                    backgroundColor: 'rgba(124,58,237,0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 2,
                    yAxisID: 'y'
                },
                {
                    label: 'Заказы',
                    data: ordersData,
                    borderColor: '#EC4899',
                    borderDash: [4, 3],
                    fill: false,
                    tension: 0.3,
                    pointRadius: 2,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#6B7280',
                        usePointStyle: true,
                        font: { size: 10 }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(0,0,0,0.05)' },
                    ticks: {
                        color: '#6B7280',
                        font: { size: 9 },
                        callback: function(value) {
                            if (value >= 1000) return (value / 1000).toFixed(1) + 'k';
                            return value;
                        }
                    }
                },
                y1: {
                    position: 'right',
                    beginAtZero: true,
                    grid: { display: false },
                    ticks: {
                        color: '#6B7280',
                        font: { size: 9 }
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#6B7280', font: { size: 9 }, maxTicksLimit: 20 }
                }
            }
        }
    });
}

// ============================================================
// УПРАВЛЕНИЕ ПЕРИОДОМ
// ============================================================

window.setSalesPeriod = function(period) {
    currentPeriod = period;
    renderSalesAnalytics();
};

// ============================================================
// ЭКСПОРТ
// ============================================================

export default renderSalesAnalytics;
