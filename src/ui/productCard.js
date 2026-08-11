// ============================================================
// PRODUCT CARD — BELTANEE
// Одна карточка = одно изделие. Все показатели строятся из канонических сервисов.
// ============================================================

import ProductService from '../services/ProductService.js';
import SalesService from '../services/SalesService.js';
import StockService from '../services/StockService.js';

let chartInstance = null;
const money = value => `${Math.round(Number(value) || 0).toLocaleString('ru-RU')} ₽`;
const qty = value => Math.round(Number(value) || 0).toLocaleString('ru-RU');
const norm = value => String(value ?? '').trim().toLowerCase();
const esc = value => String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

function sortSizes(values) {
    return [...values].sort((a,b) => {
        const na = Number(a), nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        return String(a).localeCompare(String(b), 'ru');
    });
}

function statusFor(stock, sales) {
    if (stock <= 0) return ['Нет остатков','#6B7280'];
    if (sales <= 0) return ['Нет продаж','#6B7280'];
    const io = stock / sales;
    if (io < .2) return ['Дефицит','#EF4444'];
    if (io < .5) return ['Недостаток','#F59E0B'];
    if (io > 2) return ['Избыток','#3B82F6'];
    return ['Норма','#10B981'];
}

function aggregateVariants(variants, salesByGroup, stockByVariant) {
    let totalStock = 0;
    const stockByWarehouse = {};
    for (const variant of variants) {
        const key = norm(variant.articleKey || variant.article);
        const stock = stockByVariant[key];
        if (!stock) continue;
        totalStock += Number(stock.available) || 0;
        for (const [warehouse, row] of Object.entries(stock.byWarehouse || {})) {
            stockByWarehouse[warehouse] = (stockByWarehouse[warehouse] || 0) + (Number(row.available) || 0);
        }
    }
    const sales = salesByGroup || { orders:0, delivered:0, returns:0, revenue:0, records:0, chart:[] };
    return { totalStock, stockByWarehouse, sales };
}

async function loadProductData(groupKey) {
    const variants = await ProductService.getByProductGroup(groupKey);
    if (!variants.length) return { error: 'Изделие не найдено', products: [] };

    const [allStock, sales30] = await Promise.all([
        StockService.getAllAggregated(),
        SalesService.getAllAggregated(30)
    ]);

    const stockByVariant = {};
    for (const [key, value] of Object.entries(allStock || {})) stockByVariant[norm(key)] = value;

    // Продажи берём только из группового агрегатора. Старое сопоставление по baseArticle
    // намеренно не используется: оно могло объединять похожие артикулы.
    const groupSales = sales30[norm(groupKey)] || null;
    const sales = groupSales ? {
        orders: Number(groupSales.orders) || 0,
        delivered: Number(groupSales.delivered) || 0,
        returns: Number(groupSales.returns) || 0,
        revenue: Number(groupSales.revenue) || 0,
        records: Number(groupSales.records) || 0
    } : { orders:0, delivered:0, returns:0, revenue:0, records:0 };

    const aggregate = aggregateVariants(variants, sales, stockByVariant);
    const prices = variants.map(p => Number(p.price)).filter(v => v > 0);
    const purchasePrices = variants.map(p => Number(p.purchasePrice)).filter(v => v > 0);
    const avgPrice = prices.length ? prices.reduce((a,b)=>a+b,0)/prices.length : 0;
    const avgPurchase = purchasePrices.length ? purchasePrices.reduce((a,b)=>a+b,0)/purchasePrices.length : 0;
    const margin = avgPrice && avgPurchase ? ((avgPrice-avgPurchase)/avgPrice)*100 : null;
    const status = statusFor(aggregate.totalStock, sales.orders);

    // Источник для аудита цифр. Это данные, на которых построены KPI.
    const source = {
        salesPeriodDays: 30,
        salesRecords: sales.records,
        salesSource: 'SalesService.getAllAggregated(30)',
        stockSource: 'StockService.getAllAggregated()',
        stockIncludesAggregateWarehouse: false,
        variantCount: variants.length,
        productGroupKey: groupKey
    };

    return {
        products: variants,
        groupKey,
        name: variants.find(p => p.name)?.name || groupKey,
        totalStock: aggregate.totalStock,
        sales,
        avgPrice,
        avgPurchase,
        margin,
        stockByWarehouse: aggregate.stockByWarehouse,
        sizes: sortSizes(new Set(variants.map(p => p.size).filter(Boolean))),
        colors: [...new Set(variants.map(p => p.color).filter(Boolean))],
        status,
        source
    };
}

function renderVariantTable(variants, stockByVariant) {
    return `<div class="card" style="margin-bottom:20px;"><div class="card-title">🎨 Варианты изделия</div><div style="overflow-x:auto;"><table><thead><tr><th>Цвет</th><th>Размер</th><th>Артикул</th><th>Штрихкод</th><th>Цена</th><th>Остаток</th></tr></thead><tbody>${variants.map(p => {
        const stock = stockByVariant[norm(p.articleKey || p.article)];
        return `<tr><td>${esc(p.color || '—')}</td><td><strong>${esc(p.size || '—')}</strong></td><td><code>${esc(p.originalArticle || p.article)}</code></td><td>${esc(p.barcode || '—')}</td><td>${p.price ? money(p.price) : '—'}</td><td>${stock ? qty(stock.available) : '0'} шт</td></tr>`;
    }).join('')}</tbody></table></div></div>`;
}

function renderChart(sales) {
    const canvas = document.getElementById('productCardChart');
    if (!canvas || typeof Chart === 'undefined') return;
    if (chartInstance) chartInstance.destroy();
    // Для графика запрашиваем реальные записи группы, а не генерируем данные из итогового KPI.
    SalesService.getAll().then(records => {
        const dates = {};
        for (const row of records) {
            if (norm(row.productGroupKey) !== norm(window._selectedProductGroupKey)) continue;
            if (!row.date) continue;
            if (!dates[row.date]) dates[row.date] = 0;
            dates[row.date] += Number(row.orders) || 0;
        }
        const ordered = Object.entries(dates).sort(([a],[b])=>a.localeCompare(b)).slice(-30);
        chartInstance = new Chart(canvas.getContext('2d'), { type:'line', data:{ labels:ordered.map(([d])=>d.slice(5).split('-').reverse().join('.')), datasets:[{label:'Заказы',data:ordered.map(([,v])=>v),borderWidth:2,tension:.25,fill:false}] }, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{precision:0}}}} });
    });
}

export async function renderProductCard() {
    const container = document.getElementById('productCardContent');
    if (!container) return;
    const groupKey = window._selectedProductGroupKey || window._selectedBaseModel;
    if (!groupKey) { container.innerHTML='<div class="card" style="text-align:center;padding:60px;">Изделие не выбрано</div>'; return; }
    container.innerHTML='<div class="card" style="text-align:center;padding:60px;">⏳ Загружаем изделие…</div>';
    try {
        const data = await loadProductData(groupKey);
        if (data.error) throw new Error(data.error);
        const allStock = await StockService.getAllAggregated();
        const stockByVariant = Object.fromEntries(Object.entries(allStock || {}).map(([k,v])=>[norm(k),v]));
        const [statusText,statusColor] = data.status;
        const io = data.sales.orders > 0 ? data.totalStock / data.sales.orders : null;
        container.innerHTML=`<div style="margin-bottom:20px;"><button class="btn btn-ghost" onclick="window.navigateTo('products')">← Назад к товарам</button></div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:20px;"><div><h1 style="font-size:24px;font-weight:700;margin:0 0 6px;">${esc(data.name)}</h1><div style="color:var(--text-secondary);font-size:13px;">Изделие ${esc(data.groupKey)} · ${data.colors.length} цветов · ${data.sizes.length} размеров · ${data.products.length} вариантов</div></div><span style="padding:6px 14px;border-radius:12px;background:${statusColor}20;color:${statusColor};font-weight:600;">${statusText}</span></div>
        <div class="grid-4" style="margin-bottom:20px;"><div class="kpi-card"><div class="kpi-icon">💰</div><div class="kpi-info"><span class="kpi-label">Средняя цена</span><span class="kpi-value">${money(data.avgPrice)}</span></div></div><div class="kpi-card"><div class="kpi-icon">📦</div><div class="kpi-info"><span class="kpi-label">Остаток</span><span class="kpi-value">${qty(data.totalStock)} шт</span></div></div><div class="kpi-card"><div class="kpi-icon">🛒</div><div class="kpi-info"><span class="kpi-label">Заказы · 30 дней</span><span class="kpi-value">${qty(data.sales.orders)} шт</span></div></div><div class="kpi-card"><div class="kpi-icon">📊</div><div class="kpi-info"><span class="kpi-label">ИО</span><span class="kpi-value">${io === null ? '—' : io.toFixed(2)}</span></div></div></div>
        <div class="card" style="margin-bottom:20px;"><div class="card-title">📈 Продажи · 30 дней</div><div style="height:260px;"><canvas id="productCardChart"></canvas></div></div>
        ${renderVariantTable(data.products, stockByVariant)}
        <div class="card" style="margin-bottom:20px;"><div class="card-title">🏪 Остатки по складам</div><div style="overflow-x:auto;"><table><thead><tr><th>Склад</th><th>Доступно</th></tr></thead><tbody>${Object.entries(data.stockByWarehouse).sort((a,b)=>b[1]-a[1]).map(([w,v])=>`<tr><td>${esc(w)}</td><td>${qty(v)} шт</td></tr>`).join('') || '<tr><td colspan="2">Нет данных</td></tr>'}</tbody></table></div></div>
        <details class="card" style="margin-bottom:20px;"><summary style="cursor:pointer;font-weight:600;">🔎 Источник показателей</summary><div style="padding-top:14px;font-size:13px;color:var(--text-secondary);line-height:1.7;">Продажи: ${data.source.salesSource}<br>Период: последние ${data.source.salesPeriodDays} дней<br>Учтено записей продаж: ${data.source.salesRecords}<br>Остатки: ${data.source.stockSource}<br>Агрегатные строки складов: исключены<br>Вариантов изделия: ${data.source.variantCount}<br>Группа: ${esc(data.source.productGroupKey)}</div></details>`;
        renderChart(data.sales);
    } catch(error) {
        console.error('[ProductCard]',error);
        container.innerHTML=`<div class="card" style="text-align:center;padding:60px;"><div style="font-weight:600;color:#EF4444;">Не удалось загрузить карточку</div><div style="margin-top:8px;color:var(--text-secondary);">${esc(error.message)}</div></div>`;
    }
}

export default renderProductCard;
