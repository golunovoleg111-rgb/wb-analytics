// ============================================================
// UI: SETTINGS — СТРАНИЦА НАСТРОЕК
// ============================================================

import SettingsService from '../services/SettingsService.js';

// ============================================================
// СОСТОЯНИЕ
// ============================================================

let currentSettings = {};

// ============================================================
// ЗАГРУЗКА И ОТРИСОВКА
// ============================================================

export async function renderSettings() {
    console.log('⚙️ Рендеринг страницы "Настройки"...');

    const container = document.getElementById('settingsContent');
    if (!container) {
        console.warn('⚠️ Контейнер settingsContent не найден');
        return;
    }

    try {
        const settings = await SettingsService.getAsObject();
        currentSettings = settings;

        let html = '';

        // ============================================================
        // 1. ТАРИФЫ WB
        // ============================================================

        html += `
            <div class="card">
                <div class="card-title">📦 Тарифы Wildberries</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div>
                        <label style="font-size:11px;font-weight:500;display:block;margin-bottom:3px;">Комиссия FBO (%)</label>
                        <input type="number" id="fboCommission" value="${settings.fboCommission || 15}" min="1" max="50" step="1" style="width:100%;">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:500;display:block;margin-bottom:3px;">Комиссия FBS (%)</label>
                        <input type="number" id="fbsCommission" value="${settings.fbsCommission || 10}" min="1" max="50" step="1" style="width:100%;">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:500;display:block;margin-bottom:3px;">Ставка хранения (₽/л/день)</label>
                        <input type="number" id="storageBaseRate" value="${settings.storageBaseRate || 0.07}" step="0.01" style="width:100%;">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:500;display:block;margin-bottom:3px;">Ставка хранения повыш. (₽/л/день)</label>
                        <input type="number" id="storageOverRate" value="${settings.storageOverRate || 0.15}" step="0.01" style="width:100%;">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:500;display:block;margin-bottom:3px;">Объём единицы (литров)</label>
                        <input type="number" id="volumePerUnit" value="${settings.volumePerUnit || 5}" step="0.5" style="width:100%;">
                    </div>
                </div>
            </div>
        `;

        // ============================================================
        // 2. ПЛАНИРОВАНИЕ
        // ============================================================

        html += `
            <div class="card">
                <div class="card-title">📋 Планирование заказов</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div>
                        <label style="font-size:11px;font-weight:500;display:block;margin-bottom:3px;">Целевой запас (дней)</label>
                        <input type="number" id="targetStockDays" value="${settings.targetStockDays || 60}" min="1" style="width:100%;">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:500;display:block;margin-bottom:3px;">Страховой запас (дней)</label>
                        <input type="number" id="safetyStockDays" value="${settings.safetyStockDays || 30}" min="1" style="width:100%;">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:500;display:block;margin-bottom:3px;">Срок производства (дней)</label>
                        <input type="number" id="productionDays" value="${settings.productionDays || 14}" min="1" style="width:100%;">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:500;display:block;margin-bottom:3px;">Срок доставки до WB (дней)</label>
                        <input type="number" id="deliveryDays" value="${settings.deliveryDays || 7}" min="1" style="width:100%;">
                    </div>
                </div>
            </div>
        `;

        // ============================================================
        // 3. НАЛОГИ
        // ============================================================

        const taxSystem = settings.taxSystem || 'usn6';
        const patentCost = settings.patentCost || 30000;

        html += `
            <div class="card">
                <div class="card-title">🧾 Налоги</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div>
                        <label style="font-size:11px;font-weight:500;display:block;margin-bottom:3px;">Система налогообложения</label>
                        <select id="taxSystem" style="width:100%;">
                            <option value="usn6" ${taxSystem === 'usn6' ? 'selected' : ''}>УСН 6% (доходы)</option>
                            <option value="usn15" ${taxSystem === 'usn15' ? 'selected' : ''}>УСН 15% (доходы − расходы)</option>
                            <option value="patent" ${taxSystem === 'patent' ? 'selected' : ''}>Патент</option>
                        </select>
                    </div>
                    <div id="patentBlock" style="${taxSystem === 'patent' ? 'display:block;' : 'display:none;'}">
                        <label style="font-size:11px;font-weight:500;display:block;margin-bottom:3px;">Стоимость патента в год (₽)</label>
                        <input type="number" id="patentCost" value="${patentCost}" step="1000" style="width:100%;">
                    </div>
                </div>
            </div>
        `;

        // ============================================================
        // 4. API КЛЮЧИ
        // ============================================================

        html += `
            <div class="card" style="border:2px solid var(--primary-light);">
                <div class="card-title">🔑 API ключи</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div>
                        <label style="font-size:11px;font-weight:500;display:block;margin-bottom:3px;">Wildberries API ключ</label>
                        <input type="password" id="wbApiKey" placeholder="Введите API ключ WB" style="width:100%;" value="${settings.wbApiKey || ''}">
                    </div>
                    <div>
                        <label style="font-size:11px;font-weight:500;display:block;margin-bottom:3px;">Ozon API ключ</label>
                        <input type="password" id="ozonApiKey" placeholder="Введите API ключ Ozon" style="width:100%;" value="${settings.ozonApiKey || ''}">
                    </div>
                </div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:6px;">
                    🔒 Ключи хранятся только в вашем браузере и не передаются на сервер
                </div>
            </div>
        `;

        // ============================================================
        // 5. УПРАВЛЕНИЕ ДАННЫМИ
        // ============================================================

        html += `
            <div class="card" style="border:2px solid #EF4444;">
                <div class="card-title">⚠️ Управление данными</div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                    <button class="btn btn-danger" id="clearAllDataBtn">🗑️ Очистить все данные</button>
                    <button class="btn btn-secondary" id="clearCacheBtn">🔄 Очистить кеш</button>
                </div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:6px;">
                    ⚠️ Очистка всех данных удалит все импортированные файлы. Очистка кеша перезагрузит приложение.
                </div>
            </div>
        `;

        // ============================================================
        // 6. КНОПКА СОХРАНЕНИЯ
        // ============================================================

        html += `
            <button class="btn btn-primary" id="saveSettingsBtn" style="width:100%;padding:10px;font-size:14px;margin-top:14px;">
                💾 Сохранить настройки
            </button>
            <div id="saveStatus" style="text-align:center;margin-top:8px;font-size:12px;"></div>
        `;

        container.innerHTML = html;

        // ============================================================
        // 7. НАВЕШИВАЕМ ОБРАБОТЧИКИ
        // ============================================================

        // Показываем/скрываем поле патента
        document.getElementById('taxSystem').addEventListener('change', function() {
            const patentBlock = document.getElementById('patentBlock');
            if (this.value === 'patent') {
                patentBlock.style.display = 'block';
            } else {
                patentBlock.style.display = 'none';
            }
        });

        // Сохранение
        document.getElementById('saveSettingsBtn').addEventListener('click', async function() {
            const statusEl = document.getElementById('saveStatus');
            statusEl.textContent = '⏳ Сохранение...';
            statusEl.style.color = '#F59E0B';

            try {
                const settings = {
                    fboCommission: parseFloat(document.getElementById('fboCommission').value) || 15,
                    fbsCommission: parseFloat(document.getElementById('fbsCommission').value) || 10,
                    storageBaseRate: parseFloat(document.getElementById('storageBaseRate').value) || 0.07,
                    storageOverRate: parseFloat(document.getElementById('storageOverRate').value) || 0.15,
                    volumePerUnit: parseFloat(document.getElementById('volumePerUnit').value) || 5,
                    targetStockDays: parseInt(document.getElementById('targetStockDays').value) || 60,
                    safetyStockDays: parseInt(document.getElementById('safetyStockDays').value) || 30,
                    productionDays: parseInt(document.getElementById('productionDays').value) || 14,
                    deliveryDays: parseInt(document.getElementById('deliveryDays').value) || 7,
                    taxSystem: document.getElementById('taxSystem').value || 'usn6',
                    patentCost: parseFloat(document.getElementById('patentCost').value) || 30000,
                    wbApiKey: document.getElementById('wbApiKey').value || '',
                    ozonApiKey: document.getElementById('ozonApiKey').value || ''
                };

                await SettingsService.setMany(settings);
                
                statusEl.textContent = '✅ Настройки сохранены';
                statusEl.style.color = '#10B981';
                showToast('✅ Настройки сохранены', 'success');
            } catch (error) {
                statusEl.textContent = '❌ Ошибка: ' + error.message;
                statusEl.style.color = '#EF4444';
                showToast('❌ Ошибка: ' + error.message, 'error');
            }
        });

        // Очистка данных
        const clearBtn = document.getElementById('clearAllDataBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                if (confirm('⚠️ Удалить все данные? Это действие необратимо.')) {
                    clearAllData();
                }
            });
        }

        // Очистка кеша
        const cacheBtn = document.getElementById('clearCacheBtn');
        if (cacheBtn) {
            cacheBtn.addEventListener('click', function() {
                if (confirm('Очистить кеш и перезагрузить страницу?')) {
                    localStorage.clear();
                    location.reload();
                }
            });
        }

    } catch (error) {
        console.error('❌ Ошибка загрузки настроек:', error.message);
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
// ОЧИСТКА ВСЕХ ДАННЫХ
// ============================================================

async function clearAllData() {
    try {
        const stores = ['products', 'sales', 'stock', 'supply', 'warehouse', 'ads', 'settings'];
        const { Database } = await import('../infrastructure/db.js');
        
        for (const store of stores) {
            await Database.clear(store);
        }
        
        showToast('✅ Все данные очищены', 'success');
        
        // Перезагружаем страницу
        setTimeout(() => location.reload(), 1500);
    } catch (error) {
        showToast('❌ Ошибка: ' + error.message, 'error');
    }
}

// ============================================================
// ЭКСПОРТ
// ============================================================

export default renderSettings;
