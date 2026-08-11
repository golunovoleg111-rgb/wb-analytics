// ============================================================
// SALES AGGREGATE — BELTANEE
// Единая точка расчёта продаж. Никаких двойных суммирований.
// ============================================================

import SalesRecord from './SalesRecord.js';
import { Database } from '../../infrastructure/db.js';

function clean(value) { return String(value ?? '').trim(); }
function dateOnly(value) {
    const text = clean(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

class SalesAggregate {
    static async create(data) {
        const record = SalesRecord.createFromImport(data);
        const validation = SalesRecord.validate(record);
        if (!validation.valid) throw new Error(validation.errors.join('; '));
        await Database.save(Database.STORES.SALES, record);
        return record;
    }

    static async createMany(items = []) {
        const results = [], errors = [];
        const unique = new Map();
        for (const item of items) {
            try {
                const record = SalesRecord.createFromImport(item);
                const validation = SalesRecord.validate(record);
                if (!validation.valid) throw new Error(validation.errors.join('; '));
                unique.set(record.id, record);
            } catch (error) { errors.push({ data: item, error: error.message }); }
        }
        const records = Array.from(unique.values());
        if (records.length) await Database.saveMany(Database.STORES.SALES, records);
        return { results: records, errors, skippedDuplicates: Math.max(0, items.length - records.length - errors.length) };
    }

    static async getById(id) {
        const data = await Database.getById(Database.STORES.SALES, id);
        return data ? new SalesRecord(data) : null;
    }

    static async getAll() {
        return (await Database.getAll(Database.STORES.SALES)).map(record => new SalesRecord(record));
    }

    static async getByProduct(productId) {
        const key = clean(productId);
        return (await this.getAll()).filter(record => record.productId === key || record.articleKey === key);
    }

    static async getByProductGroup(productGroupKey) {
        const key = clean(productGroupKey);
        return (await this.getAll()).filter(record => record.productGroupKey === key);
    }

    static async getByProductAndPeriod(productId, startDate, endDate) {
        return SalesRecord.filterByPeriod(await this.getByProduct(productId), startDate, endDate);
    }

    static async getLastDays(productId, days = 30) {
        return SalesRecord.filterLastDays(await this.getByProduct(productId), days);
    }

    static async aggregateRecords(records) {
        return SalesRecord.aggregate(records);
    }

    static async aggregateByProduct(productId, startDate, endDate) {
        return SalesRecord.aggregate(await this.getByProductAndPeriod(productId, startDate, endDate));
    }

    static async aggregateByProductGroup(productGroupKey, startDate, endDate) {
        return SalesRecord.aggregate(SalesRecord.filterByPeriod(await this.getByProductGroup(productGroupKey), startDate, endDate));
    }

    static async aggregateLastDaysByProduct(productId, days = 30) {
        return SalesRecord.aggregate(await this.getLastDays(productId, days));
    }

    static async getTrustedPeriodSummary(startDate, endDate) {
        const start = dateOnly(startDate), end = dateOnly(endDate);
        if (!start || !end || start > end) throw new Error('Некорректный период продаж');
        const records = SalesRecord.filterByPeriod(await this.getAll(), start, end);
        const summary = SalesRecord.aggregate(records);
        const warnings = [];
        const dates = new Set(records.map(record => record.date));
        if (!records.length) warnings.push('Нет продаж за выбранный период');
        if (records.some(record => record.delivered > record.orders && record.orders > 0)) warnings.push('Есть записи, где выкупы превышают заказы');
        return { startDate: start, endDate: end, days: Math.floor((new Date(end) - new Date(start)) / 86400000) + 1, records: summary.recordCount, ...summary, warnings, trusted: warnings.length === 0 };
    }

    static async getTotalRevenue(startDate, endDate) {
        return (await this.getTrustedPeriodSummary(startDate, endDate)).totalAmount;
    }

    static async getProductsWithSales(startDate, endDate) {
        const records = SalesRecord.filterByPeriod(await this.getAll(), startDate, endDate);
        return Array.from(new Set(records.map(record => record.productGroupKey || record.productId)));
    }

    static async clearAll() { await Database.clear(Database.STORES.SALES); }

    static async delete() { throw new Error('Продажи нельзя удалять по отдельности. Используйте clearAll() для очистки.'); }
}

export default SalesAggregate;
