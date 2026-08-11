// ============================================================
// STOCK RECORD — BELTANEE
// Остаток = вариант + склад + дата. Агрегатные строки не являются складом.
// ============================================================

function clean(value) { return String(value ?? '').trim(); }
function warehouseKey(value) { return clean(value).toLowerCase().replace(/\s+/g, ' '); }
function number(value) {
    const n = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}

const AGGREGATE_WAREHOUSE_NAMES = new Set([
    'всего на складах', 'всего', 'total', 'итого', 'остаток', 'остатки'
]);

class StockRecord {
    constructor(data = {}) {
        this.productId = clean(data.productId || data.articleKey || data.article);
        this.articleKey = clean(data.articleKey || this.productId);
        this.productGroupKey = clean(data.productGroupKey);
        this.article = clean(data.article || this.productId);
        this.warehouseName = clean(data.warehouseName || data.warehouse);
        this.warehouseType = clean(data.warehouseType) || 'wb';
        this.size = clean(data.size || data.sizeName || data['размер']);
        this.color = clean(data.color || data.colorName || data['цвет']);
        this.barcode = clean(data.barcode || data.barCode || data['штрихкод']);
        this.date = clean(data.date) || new Date().toISOString().slice(0, 10);
        this.quantity = Math.max(0, number(data.quantity));
        this.reserved = Math.max(0, number(data.reserved));
        this.available = Math.max(0, this.quantity - this.reserved);
        this.inTransitTo = Math.max(0, number(data.inTransitTo));
        this.inTransitFrom = Math.max(0, number(data.inTransitFrom));
        this.source = clean(data.source) || 'stock_current';
        this.isAggregate = Boolean(data.isAggregate) || AGGREGATE_WAREHOUSE_NAMES.has(warehouseKey(this.warehouseName));
        this.importBatchId = clean(data.importBatchId) || null;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.id = clean(data.id) || StockRecord.makeId(this.articleKey, this.warehouseName, this.size, this.color, this.barcode, this.date);
    }

    static makeId(productId, warehouseName, size = '', color = '', barcode = '', date = '') {
        return [clean(productId), warehouseKey(warehouseName), clean(size), clean(color), clean(barcode), clean(date)].join('|');
    }

    static createFromImport(data) {
        const record = new StockRecord(data);
        if (!record.productId) throw new Error('Не указан идентификатор товара');
        if (!record.warehouseName) throw new Error('Не указан склад');
        return record;
    }

    getAvailable() { return Math.max(0, this.quantity - this.reserved); }
    hasStock() { return this.getAvailable() > 0; }
    isRealWarehouse() { return !this.isAggregate; }

    static aggregate(records, options = {}) {
        const includeAggregate = Boolean(options.includeAggregate);
        const latest = new Map();
        for (const raw of records || []) {
            const record = raw instanceof StockRecord ? raw : new StockRecord(raw);
            if (!includeAggregate && record.isAggregate) continue;
            const key = record.id || StockRecord.makeId(record.articleKey, record.warehouseName, record.size, record.color, record.barcode, record.date);
            const previous = latest.get(key);
            // Один вариант/склад/дата учитывается только один раз.
            if (!previous || String(record.createdAt) > String(previous.createdAt)) latest.set(key, record);
        }

        const byWarehouse = {};
        let total = 0, totalReserved = 0, inTransitTo = 0, inTransitFrom = 0;
        for (const record of latest.values()) {
            const displayName = clean(record.warehouseName) || 'Не указан';
            const key = warehouseKey(displayName) || 'не указан';
            if (!byWarehouse[key]) byWarehouse[key] = { name: displayName, quantity: 0, reserved: 0, available: 0, inTransitTo: 0, inTransitFrom: 0, variants: 0 };
            const quantity = record.quantity;
            const reserved = record.reserved;
            byWarehouse[key].quantity += quantity;
            byWarehouse[key].reserved += reserved;
            byWarehouse[key].available += Math.max(0, quantity - reserved);
            byWarehouse[key].inTransitTo += record.inTransitTo;
            byWarehouse[key].inTransitFrom += record.inTransitFrom;
            byWarehouse[key].variants += 1;
            total += quantity;
            totalReserved += reserved;
            inTransitTo += record.inTransitTo;
            inTransitFrom += record.inTransitFrom;
        }

        return {
            total,
            reserved: totalReserved,
            available: Math.max(0, total - totalReserved),
            inTransitTo,
            inTransitFrom,
            variantRecords: latest.size,
            byWarehouse: Object.fromEntries(Object.values(byWarehouse).map(item => [item.name, item]))
        };
    }
}

export default StockRecord;
