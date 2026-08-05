// ============================================================
// UI: DASHBOARD — ГЛАВНАЯ СТРАНИЦА
// ============================================================

import ProductService from '../services/ProductService.js';
import SalesService from '../services/SalesService.js';
import StockService from '../services/StockService.js';

// ============================================================
// ПОЛУЧЕНИЕ ДАННЫХ ДЛЯ ДАШБОРДА
// ============================================================

async function getDashboardData() {
    console.log('🔍 Загрузка данных для дашборда...');
    
    const [products, allSales] = await Promise.all([
        ProductService.getAll(),
        SalesService.getAll()
    ]);

    const totalProducts = products.length;

    // Получаем вчерашнюю дату
    const yesterday = getYesterdayStr();
    console.log('📅 Вчера:', yesterday);

    // Продажи за вчера
    const yesterdaySales = allSales.filter(s => s.date === yesterday);
    const yesterdayRevenue = yesterdaySales.reduce((sum, s) => sum + (s.amount || 0), 0);
    const yesterdayOrders = yesterdaySales.reduce((sum, s) => sum + (s.orders || 0), 0);
    const yesterdayDelivered = yesterdaySales.reduce((sum, s) => sum + (s.delivered || 0), 0);

    // Продажи за 7 дней (для графика)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const daySales = allSales.filter(s => s.date === dateStr);
        const revenue = daySales.reduce((sum, s) => sum + (s.amount || 0), 0);
        const orders = daySales.reduce((sum, s) => sum + (s.orders || 0), 0);
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const displayDate = `${day}.${month}`;
        
        last7Days.push({
            date: displayDate,
            dateFull: dateStr,
            revenue,
            orders
        });
    }

    // Проблемные товары (пока заглушка)
    const criticalProducts = [];

    console.log('📊 Данные для дашборда:', {
        totalProducts,
        yesterdayRevenue,
        yesterdayOrders,
        yesterdayDelivered,
        last7Days
    });

    return {
        totalProducts,
        yesterdayRevenue,
        yesterdayOrders,
        yesterdayDelivered,
        avgMargin: 0,
        criticalProducts,
        last7Days
    };
}

// ============================================================
// ОТРИСОВКА ДАШБОРДА
// ============================================================

export async function renderDashboard() {
    console.log('🏠 Рендеринг главной страницы...');

    const emptyContainer = document.getElementById('dashboardEmpty');
    const contentContainer = document.getElementById('dashboardContent');

    try {
        const data = await getDashboardData();

        if (data.totalProducts === 0) {
            if (emptyContainer) emptyContainer.style.display = 'block';
            if (contentContainer) contentContainer.style.display = 'none';
            return;
        }

        if (emptyContainer) emptyContainer.style.display = 'none';
        if (contentContainer) contentContainer.style.display = 'block';

        renderKPIs(data);
        renderAttentionBlock(data.criticalProducts);
        renderMiniChart(data.last7Days);

    } catch (error) {
        console.error('❌ Ошибка при загрузке дашборда:', error.message);
        if (emptyContainer) {
            emptyContainer.style.display = 'block';
            emptyContainer.innerHTML = `
                <div style="font-size:48px;margin-bottom:12px;">❌</div>
                <div style="font-size:18px;font-weight:600;margin-bottom:6px;">Ошибка загрузки</div>
                <div style="font-size:14px;color:var(--text-secondary);">${error.message}</div>
            `;
        }
    }
}

// ============================================================
// KPI
// ============================================================

function renderKPIs(data) {
    const el = document.getElementById('kpiProducts');
    if (el) el.textContent = data.totalProducts;
    
    const elOrders = document.getElementById('kpiOrders');
    if (elOrders) elOrders.textContent = data.yesterdayOrders;
    
    const elDelivered = document.getElementById('kpiDelivered');
    if (elDelivered) elDelivered.textContent = data.yesterdayDelivered;
    
    const elMargin = document.getElementById('kpiAvgMargin');
    if (elMargin) elMargin.textContent = data.avgMargin + '%';
}

// ============================================================
// ПРОБЛЕМЫ
// ============================================================

function renderAttentionBlock(criticalProducts) {
    const container = document.getElementById('attentionBlock');
    if (!container) return;

    if (criticalProducts.length === 0) {
        container.innerHTML = `
            <div style="color:#10B981;font-size:13px;padding:4px 0;">
                ✅ Все товары в норме
            </div>
        `;
        return;
    }

    let html = '';
    criticalProducts.forEach(p => {
        html += `
            <div style="padding:8px 12px;background:#FEF2F2;border-left:3px solid #EF4444;margin-bottom:6px;border-radius:6px;font-size:13px;display:flex;justify-content:space-between;align-items:center;">
                <span>
                    <span style="margin-right:6px;">🔴</span>
                    <strong>${p.product?.article || p.article}</strong>
                    — остаток ${p.stock} шт, ИО ${p.io.toFixed(2)}
                </span>
                <button class="btn btn-xs btn-danger" onclick="navigateTo('products')" style="font-size:10px;">Перейти</button>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ============================================================
// МИНИ-ГРАФИК (7 дней)
// ============================================================

function renderMiniChart(last7Days) {
    const canvas = document.getElementById('dashboardChart');
    if (!canvas) {
        console.warn('⚠️ Canvas dashboardChart не найден');
        return;
    }

    // Безопасное уничтожение старого графика
    if (window.dashboardChart) {
        try {
            if (typeof window.dashboardChart.destroy === 'function') {
                window.dashboardChart.destroy();
            }
        } catch (e) {
            console.warn('⚠️ Не удалось уничтожить старый график:', e.message);
        }
        window.dashboardChart = null;
    }

    if (!last7Days || last7Days.length === 0) {
        console.warn('⚠️ Нет данных для графика');
        return;
    }

    const ctx = canvas.getContext('2d');
    const labels = last7Days.map(d => d.date);
    const revenueData = last7Days.map(d => d.revenue);
    const orderData = last7Days.map(d => d.orders);

    try {
        window.dashboardChart = new Chart(ctx, {
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
                        data: orderData,
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
                        ticks: { color: '#6B7280', font: { size: 9 }, maxTicksLimit: 10 }
                    }
                }
            }
        });
        console.log('✅ График создан');
    } catch (error) {
        console.error('❌ Ошибка создания графика:', error.message);
    }
}

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

function getYesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================================
// ЭКСПОРТ
// ============================================================

export default renderDashboard;
