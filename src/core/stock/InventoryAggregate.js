// ============================================================
// INVENTORY AGGREGATE — РАСЧЁТЫ ПО ОСТАТКАМ
// ============================================================

import StockAggregate from './StockAggregate.js';
import SalesService from '../../services/SalesService.js';

class InventoryAggregate {
    
    // ============================================================
    // РАСЧЁТ ИНДЕКСА ОСТАТКА (ИО)
    // ============================================================

    /**
     * IO = (Остаток на WB / (Продажи за 30 дней / 30))
     */
    static calculateIO(stock, sales30) {
        if (sales30 === 0) {
            return stock > 0 ? 999 : 0;
        }
        const dailySales = sales30 / 30;
        return parseFloat((stock / dailySales).toFixed(2));
    }

    /**
     * Получить статус ИО
     */
    static getIOStatus(io) {
        if (io < 0.2) {
            return { status: 'Дефицит', color: '#EF4444', level: 'critical' };
        }
        if (io < 0.5) {
            return { status: 'Недостаток', color: '#F59E0B', level: 'warning' };
        }
        if (io < 1.0) {
            return { status: 'Норма', color: '#10B981', level: 'normal' };
        }
        if (io < 2.0) {
            return { status: 'Избыток', color: '#3B82F6', level: 'excess' };
        }
        return { status: 'Сильный избыток', color: '#8B5CF6', level: 'excess' };
    }

    // ============================================================
    // РАСЧЁТ ИНДЕКСА ЛОКАЛИЗАЦИИ
    // ============================================================

    /**
     * Индекс локализации = (Продажи из наличия / Общие продажи) * 100%
     * Продажи из наличия — это продажи товаров, которые уже есть на складах WB
     */
    static calculateLocalizationIndex(salesByWarehouse, totalSales) {
        if (totalSales === 0) return 0;
        
        // Суммируем продажи по складам WB (где есть остатки)
        const salesFromStock = Object.values(salesByWarehouse).reduce((sum, val) => sum + val, 0);
        return parseFloat(((salesFromStock / totalSales) * 100).toFixed(1));
    }

    // ============================================================
    // ПОЛНЫЙ РАСЧЁТ ПО ТОВАРУ
    // ============================================================

    static async calculateProductMetrics(productId) {
        // 1. Получаем остатки
        const stock = await StockAggregate.getAggregated(productId);
        const wbStock = stock.available || 0;

        // 2. Получаем продажи за 30 дней
        const sales = await SalesService.getAggregated(productId, 30);
        const sales30 = sales.totalOrders || 0;

        // 3. Рассчитываем ИО
        const io = this.calculateIO(wbStock, sales30);
        const ioStatus = this.getIOStatus(io);

        // 4. Получаем продажи по складам (пока заглушка, потом из SalesEngine)
        const salesByWarehouse = {
            'Коледино': Math.floor(sales30 * 0.6),
            'Казань': Math.floor(sales30 * 0.3),
            'Новосибирск': Math.floor(sales30 * 0.1)
        };

        // 5. Рассчитываем индекс локализации
        const localizationIndex = this.calculateLocalizationIndex(salesByWarehouse, sales30);

        return {
            productId,
            stock: {
                total: stock.total || 0,
                available: stock.available || 0,
                byWarehouse: stock.byWarehouse || {}
            },
            sales30,
            io,
            ioStatus,
            localizationIndex,
            salesByWarehouse,
            daysToStockout: this.calculateIO(wbStock, sales30) * 30 // упрощённо
        };
    }

    // ============================================================
    // РАСЧЁТ ПО ВСЕМ ТОВАРАМ
    // ============================================================

    static async calculateAllMetrics(productIds) {
        const results = {};
        for (const productId of productIds) {
            try {
                results[productId] = await this.calculateProductMetrics(productId);
            } catch (error) {
                console.error(`[InventoryAggregate] Error for ${productId}:`, error.message);
                results[productId] = {
                    productId,
                    error: error.message
                };
            }
        }
        return results;
    }

    // ============================================================
    // ПОИСК КРИТИЧЕСКИХ ТОВАРОВ
    // ============================================================

    static async getCriticalProducts(productIds) {
        const metrics = await this.calculateAllMetrics(productIds);
        const critical = [];

        Object.keys(metrics).forEach(productId => {
            const m = metrics[productId];
            if (m.io && m.io < 0.5) {
                critical.push({
                    productId,
                    io: m.io,
                    status: m.ioStatus,
                    stock: m.stock.available,
                    sales30: m.sales30,
                    daysToStockout: m.daysToStockout
                });
            }
        });

        critical.sort((a, b) => a.io - b.io);
        return critical;
    }
}

export default InventoryAggregate;
