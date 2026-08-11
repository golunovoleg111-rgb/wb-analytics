// ============================================================
// STOCK AGGREGATE — ОСТАТКИ
// ============================================================

import StockRecord from './StockRecord.js';
import { Database } from '../../infrastructure/db.js';

const NON_WAREHOUSE_COLUMNS = new Set(['всего на складах','всего находится на складах','итого на складах','остаток всего','всего','артикул продавца','артикул','название','название карточки','размер','размер вещи','цвет','размер и цвет','в пути до получателей','в пути возвраты на склад wb','в пути возвраты','баркод','штрихкод','nm id','nmid','vendorcode','артикул wb','предмет','категория']);
function warehouseKey(name) { return String(name || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function groupKey(record) {
    if (record.productGroupKey) return String(record.productGroupKey).trim().toLowerCase();
    const article = String(record.article || record.productId || '').trim();
    const match = article.match(/^(\d{2,3})(?:_|$)/);
    return match ? match[1] : String(record.productId || article).trim().toLowerCase();
}
function isRealWarehouse(name) { const value = warehouseKey(name); return Boolean(value) && !NON_WAREHOUSE_COLUMNS.has(value); }
function variantKey(record) { return [record.articleKey || record.productId, record.warehouseName, record.size, record.color, record.barcode].map(value => String(value || '').trim().toLowerCase()).join('|'); }
function latestByWarehouseAndVariant(records) {
    const latest = new Map();
    for (const raw of records || []) {
        const record = raw instanceof StockRecord ? raw : new StockRecord(raw);
        if (!isRealWarehouse(record.warehouseName)) continue;
        const key = variantKey(record), current = latest.get(key);
        if (!current || String(record.date) > String(current.date) || (String(record.date) === String(current.date) && String(record.createdAt) > String(current.createdAt))) latest.set(key, record);
    }
    return [...latest.values()];
}
class StockAggregate {
    static async create(data) { const record = StockRecord.createFromImport(data); if (!isRealWarehouse(record.warehouseName)) throw new Error(`Недопустимое имя склада: ${record.warehouseName}`); await Database.save(Database.STORES.STOCK, record); return record; }
    static async createMany(items) {
        const records = [], errors = [], seen = new Set();
        for (const item of items || []) { try { const record = StockRecord.createFromImport(item); if (!isRealWarehouse(record.warehouseName)) throw new Error(`Недопустимое имя склада: ${record.warehouseName}`); const key = record.id || variantKey(record); if (seen.has(key)) continue; seen.add(key); await Database.save(Database.STORES.STOCK, record); records.push(record); } catch (error) { errors.push({ data: item, error: error.message }); } }
        return { results: records, errors, skippedDuplicates: Math.max(0, (items || []).length - records.length - errors.length) };
    }
    static async getByProduct(productId) { const key = String(productId || '').trim(); return (await Database.getAll(Database.STORES.STOCK)).filter(r => (r.productId === key || r.articleKey === key || r.productGroupKey === key || groupKey(r) === key.toLowerCase()) && isRealWarehouse(r.warehouseName)).map(r => new StockRecord(r)); }
    static async getCurrent(productId) { return latestByWarehouseAndVariant(await this.getByProduct(productId)); }
    static async getAggregated(productId) { return StockRecord.aggregate(await this.getCurrent(productId)); }
    static async getAllAggregated() {
        const all = (await Database.getAll(Database.STORES.STOCK)).map(r => new StockRecord(r)).filter(r => isRealWarehouse(r.warehouseName));
        const groups = new Map();
        for (const record of all) { const key = groupKey(record); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(record); }
        return Object.fromEntries([...groups.entries()].map(([key, records]) => [key, StockRecord.aggregate(latestByWarehouseAndVariant(records))]));
    }
    static async getWarehouses() { const names = new Map(); for (const record of await Database.getAll(Database.STORES.STOCK)) { if (!isRealWarehouse(record.warehouseName)) continue; const key = warehouseKey(record.warehouseName); if (!names.has(key)) names.set(key, String(record.warehouseName).trim()); } return [...names.values()].sort((a,b) => a.localeCompare(b,'ru')); }
    static async clearAll() { await Database.clear(Database.STORES.STOCK); }
}
export default StockAggregate;
