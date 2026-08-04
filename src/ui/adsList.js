// ============================================================
// UI: ADS LIST — СТРАНИЦА "РЕКЛАМА"
// ============================================================

import AdvertisingService from '../services/AdvertisingService.js';
import ProductService from '../services/ProductService.js';

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let adsData = [];
let adsMetrics = {};

// ============================================================
// ОТРИСОВКА
// ============================================================

export async function renderAdsList() {
    console.log('📢 Рендеринг страницы "Реклама"...');

    const container = document.getElementById('adsListContainer');
    const summaryContainer = document.getElementById('adsSummary');
    const emptyContainer = document.getElementById('adsEmpty');
    const contentContainer = document.getElementById('adsContent');

    if (!container) {
        console.warn('⚠️ Контейнер adsListContainer не найден');
        return;
    }

    try {
        // Загружаем данные
        const [campaigns, metrics] = await Promise.all([
            AdvertisingService.getAll(),
            AdvertisingService.calculateAllMetrics()
        ]);

        adsData = campaigns;
        adsMetrics = metrics;

        if (campaigns.length === 0) {
            if (emptyContainer) emptyContainer.style.display = 'block';
            if (contentContainer) contentContainer.style.display = 'none';
            return;
        }

        if (emptyContainer) emptyContainer.style.display = 'none';
        if (contentContainer) contentContainer.style.display = 'block';

        // 1. Сводка
        renderSummary(campaigns, metrics);

        // 2. Таблица
        renderTable(campaigns, metrics);

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
// СВОДКА
// ============================================================

function renderSummary(campaigns, metrics) {
    const container = document.getElementById('adsSummary');
    if (!container) return;

    let totalSpent = 0;
    let totalOrders = 0;
    let totalRoi = 0;
    let activeCount = 0;
    let pausedCount = 0;

    campaigns.forEach(c => {
        const m = metrics[c.id] || {};
        totalSpent += m.spent || 0;
        totalOrders += m.orders || 0;
        totalRoi += m.roi || 0;
        if (c.isActive()) activeCount++;
        if (c.isPaused()) pausedCount++;
    });

    const avgRoi = campaigns.length > 0 ? Math.round(totalRoi / campaigns.length) : 0;

    container.innerHTML = `
        <div class="ads-summary-grid">
            <div class="ads-summary-item">
                <div class="value">${campaigns.length}</div>
                <div class="label">Всего кампаний</div>
            </div>
            <div class="ads-summary-item">
                <div class="value">${totalSpent.toLocaleString()} ₽</div>
                <div class="label">Общие затраты</div>
            </div>
            <div class="ads-summary-item">
                <div class="value">${totalOrders}</div>
                <div class="label">Всего заказов</div>
            </div>
            <div class="ads-summary-item">
                <div class="value" style="color:${avgRoi > 0 ? '#10B981' : '#EF4444'};">${avgRoi}%</div>
                <div class="label">Средний ROI</div>
            </div>
            <div class="ads-summary-item">
                <div class="value">🟢 ${activeCount} ⏸️ ${pausedCount}</div>
                <div class="label">Активные / Приостановлены</div>
            </div>
        </div>
    `;
}

// ============================================================
// ТАБЛИЦА
// ============================================================

function renderTable(campaigns, metrics) {
    const container = document.getElementById('adsListContainer');
    if (!container) return;

    let html = `
        <div class="card" style="overflow-x:auto;padding:0;">
            <table>
                <thead>
                    <tr>
                        <th>Кампания</th>
                        <th>Тип</th>
                        <th>Статус</th>
                        <th>Затраты</th>
                        <th>Показы</th>
                        <th>Клики</th>
                        <th>CTR</th>
                        <th>CR</th>
                        <th>Заказы</th>
                        <th>CPC</th>
                        <th>ROI</th>
                        <th>ДРР</th>
                        <th>Товар</th>
                        <th style="width:100px;">Действия</th>
                    </tr>
                </thead>
                <tbody>
    `;

    campaigns.forEach(c => {
        const m = metrics[c.id] || {};
        const statusLabel = c.isActive() ? '🟢 Активна' : c.isPaused() ? '⏸️ Приостановлена' : '📦 Архив';
        const statusClass = c.isActive() ? 'status-active' : c.isPaused() ? 'status-paused' : 'status-archived';
        const roiColor = m.roi > 50 ? '#10B981' : m.roi > 0 ? '#F59E0B' : '#EF4444';

        html += `
            <tr>
                <td><strong>${c.name || 'Без названия'}</strong></td>
                <td>${c.type || '—'}</td>
                <td class="${statusClass}">${statusLabel}</td>
                <td>${(m.spent || 0).toLocaleString()} ₽</td>
                <td>${(m.impressions || 0).toLocaleString()}</td>
                <td>${m.clicks || 0}</td>
                <td>${m.ctr || 0}%</td>
                <td>${m.cr || 0}%</td>
                <td>${m.orders || 0}</td>
                <td>${m.cpc || 0} ₽</td>
                <td style="color:${roiColor};font-weight:600;">${m.roi || 0}%</td>
                <td>${m.drr || 0}%</td>
                <td>${c.linkedArticle || '—'}</td>
                <td style="white-space:nowrap;">
                    ${c.isActive() ? 
                        `<button class="btn btn-xs btn-warning" onclick="window.pauseCampaign('${c.id}')">⏸️</button>` : 
                        c.isPaused() ? 
                        `<button class="btn btn-xs btn-success" onclick="window.resumeCampaign('${c.id}')">▶️</button>` :
                        ''
                    }
                    <button class="btn btn-xs btn-secondary" onclick="window.editCampaign('${c.id}')">✏️</button>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
}

// ============================================================
// УПРАВЛЕНИЕ КАМПАНИЯМИ (ГЛОБАЛЬНЫЕ ФУНКЦИИ)
// ============================================================

window.pauseCampaign = async function(id) {
    if (!confirm('Приостановить кампанию?')) return;
    try {
        await AdvertisingService.pause(id);
        renderAdsList();
        showToast('⏸️ Кампания приостановлена', 'success');
    } catch (error) {
        showToast('❌ Ошибка: ' + error.message, 'error');
    }
};

window.resumeCampaign = async function(id) {
    if (!confirm('Запустить кампанию?')) return;
    try {
        await AdvertisingService.resume(id);
        renderAdsList();
        showToast('▶️ Кампания запущена', 'success');
    } catch (error) {
        showToast('❌ Ошибка: ' + error.message, 'error');
    }
};

window.editCampaign = async function(id) {
    try {
        const campaign = await AdvertisingService.getById(id);
        if (!campaign) {
            showToast('❌ Кампания не найдена', 'error');
            return;
        }
        
        const newCpc = prompt('Введите новую CPC ставку (₽):', campaign.cpc || 0);
        if (newCpc === null) return;
        
        const parsed = parseFloat(newCpc);
        if (isNaN(parsed) || parsed < 0) {
            showToast('❌ Введите корректное число', 'error');
            return;
        }
        
        await AdvertisingService.updateSettings(id, { cpc: parsed });
        renderAdsList();
        showToast('✅ CPC обновлена', 'success');
    } catch (error) {
        showToast('❌ Ошибка: ' + error.message, 'error');
    }
};

// ============================================================
// ЭКСПОРТ
// ============================================================

export default renderAdsList;
