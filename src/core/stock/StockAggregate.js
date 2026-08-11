// ============================================================
// STOCK AGGREGATE — ОСТАТКИ
// ============================================================

import StockRecord from './StockRecord.js';
import { Database } from '../../infrastructure/db.js';

const NON_WAREHOUSE_COLUMNS = new Set([
    'всего на складах', 'всего находится на складах', 'итого на складах', 'остаток всего', 'всего',
    'артикул продавца', 'артикул', 'название', 'название карточки', 'размер', 'размер вещи',
    'цвет', 'размер и цвет', 'в пути до получателей', 'в пути возвраты на склад wb', 'в пути возвраты',
    'баркод', 'штрихкод', 'nm id', 'nmid', 'vendorcode', 'артикул wb', 'предмет', 'категория'
]);

function warehouseKey(name) {
    return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function isRealWarehouse(name) {
    const value = warehouseKey(name);
    return Boolean(value) && !NON_WAREHOUSE_COLUMNS.has(value);
}

function variantKey(record) {
    return [record.warehouseName, record.size, record.color, record.barcode].map(value => String(value || '').trim().toLowerCase()).join('|');
}

function latestByWarehouseAndVariant(records) {
    const latest = {};
    for (const raw of records || []) {
        const record = raw instanceof StockRecord ? raw : new StockRecord(raw);
        if (!isRealWarehouse(record.warehouseName)) continue;
        const key = variantKey(record);
        const current = latest[key];
        if (!current || String(record.date) > String(current.date) ||
            (String(record.date) === String(current.date) && String(record.createdAt) > String(current.createdAt))) {
            latest[key] = record;
        }
    }
    return Object.values(latest);
}

class StockAggregate {
    static async create(data) {
        const record = StockRecord.createFromImport(data);
        if (!isRealWarehouse(record.warehouseName)) throw new Error(`Недопустимое имя склада: ${record.warehouseName}`);
        await Database.save(Database.STORES.STOCK, record);
        return record;
    }

    static async createMany(items) {
        const records = [], errors = [];
        for (const item of items || []) {
            try { records.push(await this.create(item)); }
            catch (error) { errors.push({ data: item, error: error.message }); }
        }
        return { results: records, errors };
    }

    static async getByProduct(productId) {
        const all = await Database.getAll(Database.STORES.STOCK);
        return all.filter(r => r.productId === productId && isRealWarehouse(r.warehouseName)).map(r => new StockRecord(r));
    }

    static async getCurrent(productId) { return latestByWarehouseAndVariant(await this.getByProduct(productId)); }
    static async getAggregated(productId) { return StockRecord.aggregate(await this.getCurrent(productId)); }

    static async getAllAggregated() {
        const all = (await Database.getAll(Database.STORES.STOCK)).map(r => new StockRecord(r)).filter(r => isRealWarehouse(r.warehouseName));
        const groups = {};
        for (const record of all) {
            if (!groups[record.productId]) groups[record.productId] = [];
            groups[record.productId].push(record);
        }
        const result = {};
        for (const [productId, records] of Object.entries(groups)) {
            result[productId] = StockRecord.aggregate(latestByWarehouseAndVariant(records));
        }
        return result;
    }

    static async getWarehouses() {
        const all = await Database.getAll(Database.STORES.STOCK);
        const names = new Map();
        for (const record of all) {
            if (!isRealWarehouse(record.warehouseName)) continue;
            const key = warehouseKey(record.warehouseName);
            if (!names.has(key)) names.set(key, String(record.warehouseName).trim());
        }
        return [...names.values()].sort((a, b) => a.localeCompare(b, 'ru'));
    }

    static async clearAll() { await Database.clear(Database.STORES.STOCK); }
}

export default StockAggregate;
