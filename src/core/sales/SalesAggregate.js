// ============================================================
// SALES AGGREGATE — АГРЕГАТ ДЛЯ ПРОДАЖ
// Управляет правилами и инвариантами продаж
// ============================================================

import SalesRecord from './SalesRecord.js';
import { Database } from '../../infrastructure/db.js';

class SalesAggregate {
    
    // ============================================================
    // СОЗДАНИЕ
    // ============================================================

    static async create(data) {
        const record = SalesRecord.createFromImport(data);
        await Database.save(Database.STORES.SALES, record);
        return record;
    }

    // Создать несколько записей (пакетный импорт)
    static async createMany(items) {
        const results = [];
        const errors = [];

        for (const item of items) {
            try {
                const record = await this.create(item);
                results.push(record);
            } catch (error) {
                errors.push({ data: item, error: error.message });
            }
        }

        return { results, errors };
    }

    // ============================================================
    // ЧТЕНИЕ
    // ============================================================

    static async getById(id) {
        const data = await Database.getById(Database.STORES.SALES, id);
        if (!data) return null;
        return new SalesRecord(data);
    }

    // Получить все продажи по товару
    static async getByProduct(productId) {
        const all = await Database.getAll(Database.STORES.SALES);
        return all
            .filter(r => r.productId === productId)
            .map(r => new SalesRecord(r));
    }

    // Получить продажи по товару за период
    static async getByProductAndPeriod(productId, startDate, endDate) {
        const records = await this.getByProduct(productId);
        return SalesRecord.filterByPeriod(records, startDate, endDate);
    }

    // Получить продажи за последние N дней по товару
    static async getLastDays(productId, days) {
        const records = await this.getByProduct(productId);
        return SalesRecord.filterLastDays(records, days);
    }

    // Получить все продажи (для отчётов)
    static async getAll() {
        const all = await Database.getAll(Database.STORES.SALES);
        return all.map(r => new SalesRecord(r));
    }

    // Агрегировать продажи по товару за период
    static async aggregateByProduct(productId, startDate, endDate) {
        const records = await this.getByProductAndPeriod(productId, startDate, endDate);
        return SalesRecord.aggregate(records);
    }

    // Получить общую выручку за период
    static async getTotalRevenue(startDate, endDate) {
        const all = await this.getAll();
        const filtered = SalesRecord.filterByPeriod(all, startDate, endDate);
        return filtered.reduce((sum, r) => sum + r.amount, 0);
    }

    // ============================================================
    // ПОИСК
    // ============================================================

    // Найти товары с продажами в период (для отчёта)
    static async getProductsWithSales(startDate, endDate) {
        const all = await this.getAll();
        const filtered = SalesRecord.filterByPeriod(all, startDate, endDate);
        const productIds = new Set();
        filtered.forEach(r => productIds.add(r.productId));
        return Array.from(productIds);
    }

    // ============================================================
    // ОЧИСТКА
    // ============================================================

    static async clearAll() {
        await Database.clear(Database.STORES.SALES);
    }

    // ============================================================
    // УДАЛЕНИЕ (запрещено)
    // ============================================================

    static async delete() {
        throw new Error('Продажи нельзя удалять по отдельности. Используйте clearAll() для очистки.');
    }
}

export default SalesAggregate;
