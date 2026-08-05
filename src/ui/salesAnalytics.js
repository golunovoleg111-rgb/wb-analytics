// ============================================================
// UI: SALES ANALYTICS — АНАЛИТИКА ПРОДАЖ
// ============================================================

import SalesService from '../services/SalesService.js';
import ProductService from '../services/ProductService.js';

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let salesChartInstance = null;

// ============================================================
// ПОЛУЧЕНИЕ ДАННЫХ
// ============================================================

async function getSalesAnalytics(startDate, endDate) {
    console.log('🔍 Загрузка аналитики продаж с', startDate, 'по', endDate);
    
    // Получаем все продажи
    const allSales = await SalesService.getAll();
    console.log('📊 Всего продаж в базе:', allSales.length);
    
    if (allSales.length === 0) {
        return {
            chartData: [],
            topProducts: [],
            summary: { revenue: 0, orders: 0, delivered: 0, avgOrderValue: 0 },
            changes: { revenue: 0, orders: 0 },
            totalRecords: 0,
            period: { start: startDate, end: endDate }
        };
    }

    // Фильтруем по периоду
    const filtered = allSales.filter(s => s.date >= startDate && s.date <= endDate);
    console.log('📊 Продаж за период:', filtered.length);

    if (filtered.length === 0) {
        return {
            chartData: [],
            topProducts: [],
            summary: { revenue: 0, orders: 0, delivered: 0, avgOrderValue: 0 },
            changes: { revenue: 0, orders: 0 },
            totalRecords: 0,
            period: { start: startDate, end: endDate }
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
        let article = s.article || s.productId || '';
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

    // ============================================================
    // РАСЧЁТ ИЗМЕНЕНИЙ (сравнение с предыдущим периодом)
    // ============================================================
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const periodDays = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24));
    
    // Предыдущий период такой же длины
    const prevStartDate = new Date(startDateObj);
    prevStartDate.setDate(prevStartDate.getDate() - periodDays - 1);
    const prevEndDate = new Date(startDateObj);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    
    const prevStartStr = prevStartDate.toISOString().split('T')[0];
    const prevEndStr = prevEndDate.toISOString().split('T')[0];
    
    const prevSales = allSales.filter(s => s.date >= prevStartStr && s.date <= prevEndStr);
    const prevRevenue = prevSales.reduce((sum, s) => sum + (s.amount || 0), 0);
    const prevOrders = prevSales.reduce((sum, s) => sum + (s.orders || 0), 0);
    
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue * 100) : 0;
    const ordersChange = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders * 100) : 0;

    console.log('📊 Итоги:', {
        revenue: totalRevenue,
        orders: totalOrders,
        delivered: totalDelivered,
        avgOrderValue,
        prevRevenue,
        prevOrders,
        revenueChange,
        ordersChange
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
        changes: {
            revenue: revenueChange,
            orders: ordersChange
        },
        totalRecords: filtered.length,
        period: { start: startDate, end: endDate }
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
        // Получаем даты из полей ввода (или используем по умолчанию)
        const startInput = document.getElementById('salesStartDate');
        const endInput = document.getElementById('salesEndDate');
        
        let startDate, endDate;
        if (startInput && endInput && startInput.value && endInput.value) {
            startDate = startInput.value;
            endDate = endInput.value;
        } else {
            // По умолчанию: последние 30 дней
            const today = new Date();
            const start = new Date(today);
            start.setDate(start.getDate() - 30);
            startDate = start.toISOString().split('T')[0];
            endDate = today.toISOString().split('T')[0];
        }

        const data = await getSalesAnalytics(startDate, endDate);

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

        // 1. КАЛЕНДАРЬ для выбора периода
        html += `
            <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;align-items:center;background:var(--bg-hover);padding:10px 14px;border-radius:var(--radius-sm);">
                <div style="display:flex;align-items:center;gap:6px;">
                    <label style="font-size:12px;font-weight:500;color:var(--text-secondary);">С</label>
                    <input type="date" id="salesStartDate" value="${data.period.start}" 
                           style="padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:12px;background:var(--bg-card);">
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                    <label style="font-size:12px;font-weight:500;color:var(--text-secondary);">По</label>
                    <input type="date" id="salesEndDate" value="${data.period.end}" 
                           style="padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius-xs);font-size:12px;background:var(--bg-card);">
                </div>
                <button class="btn btn-primary btn-sm" id="applyDateRangeBtn">📊 Применить</button>
                <button class="btn btn-secondary btn-sm" id="resetDateRangeBtn">↺ Сбросить</button>
                <span style="flex:1;"></span>
                <span style="font-size:11px;color:var(--text-secondary);">
                    ${data.period.start} — ${data.period.end}
                </span>
            </div>
        `;

        // 2. Итоговые показатели с изменением
        const revenueChange = data.changes?.revenue || 0;
        const ordersChange = data.changes?.orders || 0;
        
        html += `
            <div class="grid-4" style="margin-bottom:16px;">
                <div class="kpi-card">
                    <div class="kpi-icon">💰</div>
                    <div class="kpi-info">
                        <span class="kpi-label">Выручка</span>
                        <span class="kpi-value">${data.summary.revenue.toLocaleString()} ₽</span>
                        <span style="font-size:11px;color:${revenueChange >= 0 ? '#10B981' : '#EF4444'};">
                            ${revenueChange >= 0 ? '↑' : '↓'} ${Math.abs(revenueChange).toFixed(1)}%
                        </span>
                    </div>
                </div>
                <div class="kpi-card">
                    <div class="kpi-icon">🛒</div>
                    <div class="kpi-info">
                        <span class="kpi-label">Заказы</span>
                        <span class="kpi-value">${data.summary.orders}</span>
                        <span style="font-size:11px;color:${ordersChange >= 0 ? '#10B981' : '#EF4444'};">
                            ${ordersChange >= 0 ? '↑' : '↓'} ${Math.abs(ordersChange).toFixed(1)}%
                        </span>
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

        // Навешиваем обработчики на календарь
        document.getElementById('applyDateRangeBtn')?.addEventListener('click', () => {
            renderSalesAnalytics();
        });
        document.getElementById('resetDateRangeBtn')?.addEventListener('click', () => {
            const today = new Date();
            const start = new Date(today);
            start.setDate(start.getDate() - 30);
            document.getElementById('salesStartDate').value = start.toISOString().split('T')[0];
            document.getElementById('salesEndDate').value = today.toISOString().split('T')[0];
            renderSalesAnalytics();
        });

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
// ЭКСПОРТ
// ============================================================

export default renderSalesAnalytics;
