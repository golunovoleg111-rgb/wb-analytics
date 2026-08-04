// ============================================================
// ADVERTISING SERVICE — СЕРВИС ДЛЯ UI
// ============================================================

import CampaignAggregate from '../core/advertising/CampaignAggregate.js';
import InventoryAggregate from '../core/stock/InventoryAggregate.js';
import ProductService from './ProductService.js';
import SalesService from './SalesService.js';
import StockService from './StockService.js';

class AdvertisingService {
    
    // ============================================================
    // СОЗДАНИЕ
    // ============================================================

    static async createManual(data) {
        try {
            const campaign = await CampaignAggregate.createManual(data);
            this._emitEvent('CampaignCreated', { campaignId: campaign.id });
            return campaign;
        } catch (error) {
            console.error('[AdvertisingService] create error:', error.message);
            throw error;
        }
    }

    // ============================================================
    // ЧТЕНИЕ
    // ============================================================

    static async getAll() {
        return await CampaignAggregate.getAll();
    }

    static async getActive() {
        return await CampaignAggregate.getActive();
    }

    static async getById(id) {
        return await CampaignAggregate.getById(id);
    }

    // ============================================================
    // РАСЧЁТ МЕТРИК (ROI, ДРР, CPC, CPM, CTR, CR)
    // ============================================================

    static async calculateMetrics(campaign) {
        // Базовая статистика из кампании
        const stats = campaign.stats || {};
        const impressions = stats.impressions || 0;
        const clicks = stats.clicks || 0;
        const spent = stats.spent || 0;
        const orders = stats.orders || 0;

        // Если есть привязка к товару — считаем ROI с учётом маржинальности
        let roi = 0;
        let drr = 0;
        let cpc = 0;
        let cpm = 0;
        let ctr = 0;
        let cr = 0;

        if (campaign.linkedArticle) {
            try {
                // Получаем информацию о товаре
                const product = await ProductService.findByArticle(campaign.linkedArticle);
                if (product) {
                    // Получаем продажи и остатки для расчёта маржинальности
                    const sales = await SalesService.getAggregated(product.id, 30);
                    const stock = await StockService.getAggregated(product.id);
                    
                    // Рассчитываем маржинальность (упрощённо)
                    const price = product.price || 0;
                    const purchasePrice = product.purchasePrice || 0;
                    const margin = price > 0 ? ((price - purchasePrice) / price * 100) : 0;
                    
                    // ROI = (Выручка от рекламы * Маржинальность - Затраты) / Затраты
                    const revenue = orders * price;
                    const profit = revenue * (margin / 100);
                    roi = spent > 0 ? Math.round((profit - spent) / spent * 100) : 0;
                    
                    // ДРР = Затраты / Выручка * 100
                    drr = revenue > 0 ? Math.round(spent / revenue * 100) : 0;
                }
            } catch (error) {
                console.warn(`[AdvertisingService] Не удалось рассчитать ROI для кампании ${campaign.id}:`, error.message);
            }
        }

        // CPC = Затраты / Клики
        cpc = clicks > 0 ? Math.round(spent / clicks * 100) / 100 : 0;
        
        // CPM = (Затраты / Показы) * 1000
        cpm = impressions > 0 ? Math.round(spent / impressions * 1000) : 0;
        
        // CTR = Клики / Показы * 100
        ctr = impressions > 0 ? Math.round(clicks / impressions * 10000) / 100 : 0;
        
        // CR = Заказы / Клики * 100
        cr = clicks > 0 ? Math.round(orders / clicks * 10000) / 100 : 0;

        return {
            roi,
            drr,
            cpc,
            cpm,
            ctr,
            cr,
            impressions,
            clicks,
            spent,
            orders
        };
    }

    // ============================================================
    // РАСЧЁТ МЕТРИК ДЛЯ ВСЕХ КАМПАНИЙ
    // ============================================================

    static async calculateAllMetrics() {
        const campaigns = await this.getAll();
        const results = {};
        for (const campaign of campaigns) {
            results[campaign.id] = await this.calculateMetrics(campaign);
        }
        return results;
    }

    // ============================================================
    // УПРАВЛЕНИЕ
    // ============================================================

    static async pause(id) {
        const campaign = await CampaignAggregate.pause(id);
        this._emitEvent('CampaignPaused', { campaignId: id });
        return campaign;
    }

    static async resume(id) {
        const campaign = await CampaignAggregate.resume(id);
        this._emitEvent('CampaignResumed', { campaignId: id });
        return campaign;
    }

    static async archive(id) {
        const campaign = await CampaignAggregate.archive(id);
        this._emitEvent('CampaignArchived', { campaignId: id });
        return campaign;
    }

    static async linkProduct(id, article) {
        const campaign = await CampaignAggregate.linkProduct(id, article);
        this._emitEvent('CampaignLinked', { campaignId: id, article });
        return campaign;
    }

    static async updateSettings(id, data) {
        const campaign = await CampaignAggregate.update(id, data);
        this._emitEvent('CampaignUpdated', { campaignId: id });
        return campaign;
    }

    // ============================================================
    // ОЧИСТКА
    // ============================================================

    static async clearAll() {
        await CampaignAggregate.clearAll();
    }

    // ============================================================
    // СОБЫТИЯ
    // ============================================================

    static _eventListeners = {};

    static on(eventName, callback) {
        if (!this._eventListeners[eventName]) {
            this._eventListeners[eventName] = [];
        }
        this._eventListeners[eventName].push(callback);
    }

    static _emitEvent(eventName, data) {
        const listeners = this._eventListeners[eventName] || [];
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`[AdvertisingService] Event listener error for ${eventName}:`, error);
            }
        });
    }
}

export default AdvertisingService;
