// ============================================================
// SETTINGS SERVICE — УПРАВЛЕНИЕ НАСТРОЙКАМИ СИСТЕМЫ
// ============================================================

import { Database } from '../infrastructure/db.js';

// ============================================================
// НАСТРОЙКИ ПО УМОЛЧАНИЮ
// ============================================================

const DEFAULT_SETTINGS = {
    // Тарифы WB
    fboCommission: 15,
    fbsCommission: 10,
    storageBaseRate: 0.07,
    storageOverRate: 0.15,
    volumePerUnit: 5,

    // Планирование
    targetStockDays: 60,
    safetyStockDays: 30,
    productionDays: 14,
    deliveryDays: 7,

    // Налоги
    taxSystem: 'usn6', // usn6 | usn15 | patent
    patentCost: 30000,

    // API
    wbApiKey: '',
    ozonApiKey: ''
};

class SettingsService {
    
    // ============================================================
    // ПОЛУЧИТЬ ВСЕ НАСТРОЙКИ
    // ============================================================

    static async getAll() {
        const settings = await Database.getAll(Database.STORES.SETTINGS);
        if (settings.length === 0) {
            // Если настроек нет — сохраняем значения по умолчанию
            await this.resetToDefaults();
            return await Database.getAll(Database.STORES.SETTINGS);
        }
        return settings;
    }

    // ============================================================
    // ПОЛУЧИТЬ ОДНУ НАСТРОЙКУ
    // ============================================================

    static async get(key) {
        const settings = await this.getAll();
        const found = settings.find(s => s.key === key);
        return found ? found.value : null;
    }

    // ============================================================
    // ПОЛУЧИТЬ ВСЕ НАСТРОЙКИ КАК ОБЪЕКТ
    // ============================================================

    static async getAsObject() {
        const settings = await this.getAll();
        const result = {};
        settings.forEach(s => {
            result[s.key] = s.value;
        });
        return result;
    }

    // ============================================================
    // СОХРАНИТЬ НАСТРОЙКУ
    // ============================================================

    static async set(key, value) {
        // Проверяем, есть ли уже такая настройка
        const all = await Database.getAll(Database.STORES.SETTINGS);
        const existing = all.find(s => s.key === key);
        
        if (existing) {
            existing.value = value;
            await Database.save(Database.STORES.SETTINGS, existing);
        } else {
            await Database.save(Database.STORES.SETTINGS, {
                id: Date.now().toString(36) + Math.random().toString(36).substring(2),
                key: key,
                value: value
            });
        }
    }

    // ============================================================
    // СОХРАНИТЬ НЕСКОЛЬКО НАСТРОЕК
    // ============================================================

    static async setMany(settings) {
        for (const [key, value] of Object.entries(settings)) {
            await this.set(key, value);
        }
    }

    // ============================================================
    // СБРОСИТЬ К НАСТРОЙКАМ ПО УМОЛЧАНИЮ
    // ============================================================

    static async resetToDefaults() {
        await Database.clear(Database.STORES.SETTINGS);
        for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
            await Database.save(Database.STORES.SETTINGS, {
                id: Date.now().toString(36) + Math.random().toString(36).substring(2),
                key: key,
                value: value
            });
        }
    }

    // ============================================================
    // ПОЛУЧИТЬ НАСТРОЙКИ ПО ГРУППЕ
    // ============================================================

    static async getByCategory(category) {
        const all = await this.getAll();
        const categories = {
            tariffs: ['fboCommission', 'fbsCommission', 'storageBaseRate', 'storageOverRate', 'volumePerUnit'],
            planning: ['targetStockDays', 'safetyStockDays', 'productionDays', 'deliveryDays'],
            taxes: ['taxSystem', 'patentCost'],
            api: ['wbApiKey', 'ozonApiKey']
        };
        
        const keys = categories[category] || [];
        return all.filter(s => keys.includes(s.key));
    }
}

export default SettingsService;
