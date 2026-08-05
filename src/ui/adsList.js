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
    let totalImpressions = 0;
    let totalClicks = 0;
    let activeCount = 0;
    let pausedCount = 0;

    campaigns.forEach(c => {
        const m = metrics[c.id] || {};
        totalSpent += m.spent || 0;
        totalOrders += m.orders || 0;
        totalImpressions += m.impressions || 0;
        totalClicks += m.clicks || 0;
        if (c.isActive()) activeCount++;
        if (c.isPaused()) pausedCount++;
    });

    const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
    const avgCpc = totalClicks > 0 ? (totalSpent / totalClicks).toFixed(2) : 0;

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
                <div class="value">${totalImpressions.toLocaleString()}</div>
                <div class="label">Показы</div>
            </div>
            <div class="ads-summary-item">
                <div class="value">${totalClicks}</div>
                <div class="label">Клики</div>
            </div>
            <div class="ads-summary-item">
                <div class="value">${avgCtr}%</div>
                <div class="label">Средний CTR</div>
            </div>
            <div class="ads-summary-item">
                <div class="value">${avgCpc} ₽</div>
                <div class="label">Средний CPC</div>
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
                        <th style="min-width:200px;">Кампания</th>
                        <th>Показы</th>
                        <th>Клики</th>
                        <th>CTR</th>
                        <th>CPC</th>
                        <th>Затраты</th>
                        <th>Заказы</th>
                        <th>CR</th>
                        <th>Товар</th>
                        <th style="min-width:120px;">Действия</th>
                    </tr>
                </thead>
                <tbody>
    `;

    campaigns.forEach(c => {
        const m = metrics[c.id] || {};
        const statusLabel = c.isActive() ? '🟢 Активна' : c.isPaused() ? '⏸️ Приостановлена' : '📦 Архив';
        const statusClass = c.isActive() ? 'status-active' : c.isPaused() ? 'status-paused' : 'status-archived';
        
        // Отображаем привязанный артикул или кнопку "Привязать"
        const linkedDisplay = c.linkedArticle 
            ? `<span style="font-size:11px;font-weight:600;color:var(--primary);">${c.linkedArticle}</span>`
            : `<button class="btn btn-xs btn-secondary" onclick="window.linkArticleToCampaign('${c.id}')">🔗 Привязать</button>`;

        html += `
            <tr>
                <td>
                    <div style="font-weight:600;font-size:12px;">${c.campaign || c.name || 'Без названия'}</div>
                    <div style="font-size:10px;color:var(--text-muted);">${c.startDate ? c.startDate.slice(0,10) : '—'}</div>
                </td>
                <td>${(m.impressions || 0).toLocaleString()}</td>
                <td>${m.clicks || 0}</td>
                <td>${m.ctr || 0}%</td>
                <td>${m.cpc || 0} ₽</td>
                <td>${(m.spent || 0).toLocaleString()} ₽</td>
                <td>${m.orders || 0}</td>
                <td>${m.cr || 0}%</td>
                <td>${linkedDisplay}</td>
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
// ПРИВЯЗКА АРТИКУЛА К КАМПАНИИ
// ============================================================

window.linkArticleToCampaign = async function(campaignId) {
    try {
        const campaigns = await AdvertisingService.getAll();
        const campaign = campaigns.find(c => c.id === campaignId);
        if (!campaign) {
            showToast('❌ Кампания не найдена', 'error');
            return;
        }
        
        // Получаем список товаров для выбора
        const products = await ProductService.getAll();
        const productOptions = products.map(p => 
            `<option value="${p.article}">${p.article}</option>`
        ).join('');
        
        // Создаём модалку для выбора артикула
        const modalHtml = `
            <div id="linkArticleModal" class="modal" style="display:flex;align-items:center;justify-content:center;">
                <div class="modal-overlay" onclick="window.closeLinkModal()"></div>
                <div class="modal-content" style="max-width:500px;">
                    <div class="modal-header">
                        <h2>🔗 Привязка артикула</h2>
                        <button class="modal-close" onclick="window.closeLinkModal()">✕</button>
                    </div>
                    <div class="modal-body">
                        <div style="margin-bottom:12px;">
                            <label style="font-size:12px;font-weight:500;color:var(--text-secondary);">Кампания</label>
                            <div style="font-size:14px;font-weight:600;word-break:break-word;">${campaign.campaign || campaign.name}</div>
                        </div>
                        <div class="form-group">
                            <label>Выберите артикул</label>
                            <select id="campaignArticleSelect" style="width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:12px;background:var(--bg-input);">
                                <option value="">— Без привязки —</option>
                                ${productOptions}
                            </select>
                        </div>
                        <div style="font-size:11px;color:var(--text-secondary);margin-top:8px;">
                            💡 Привязка поможет рассчитать ROI и ДРР для кампании
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="window.closeLinkModal()">Отмена</button>
                        <button class="btn btn-primary" onclick="window.saveLinkArticle('${campaignId}')">💾 Сохранить</button>
                    </div>
                </div>
            </div>
        `;
        
        // Добавляем модалку в DOM
        const existingModal = document.getElementById('linkArticleModal');
        if (existingModal) existingModal.remove();
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
    } catch (error) {
        showToast('❌ Ошибка: ' + error.message, 'error');
    }
};

window.closeLinkModal = function() {
    const modal = document.getElementById('linkArticleModal');
    if (modal) modal.remove();
};

window.saveLinkArticle = async function(campaignId) {
    const select = document.getElementById('campaignArticleSelect');
    const article = select.value;
    
    try {
        await AdvertisingService.linkProduct(campaignId, article || null);
        showToast('✅ Артикул привязан', 'success');
        window.closeLinkModal();
        renderAdsList();
    } catch (error) {
        showToast('❌ Ошибка: ' + error.message, 'error');
    }
};

// ============================================================
// УПРАВЛЕНИЕ КАМПАНИЯМИ
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
