// ============================================================
// STOCK RECORD — ОСТАТОК ПО ТОВАРУ И СКЛАДУ
// ============================================================

function clean(value) {
    return String(value ?? '').trim();
}

function number(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

class StockRecord {
    constructor(data = {}) {
        this.productId = clean(data.productId || data.articleKey || data.article);
        this.articleKey = clean(data.articleKey);
        this.article = clean(data.article || this.productId);
        this.warehouseName = clean(data.warehouseName || data.warehouse) || 'Не указан';
        this.warehouseType = data.warehouseType || 'wb';
        this.date = clean(data.date) || new Date().toISOString().slice(0, 10);
        this.quantity = number(data.quantity);
        this.reserved = number(data.reserved);
        this.available = Math.max(0, this.quantity - this.reserved);
        this.inTransitTo = number(data.inTransitTo);
        this.inTransitFrom = number(data.inTransitFrom);
        this.source = data.source || 'stock_current';
        this.id = clean(data.id) || StockRecord.makeId(this.productId, this.warehouseName, this.date);
        this.importBatchId = data.importBatchId || null;
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    static makeId(productId, warehouseName, date) {
        return `${clean(productId)}|${clean(warehouseName)}|${clean(date)}`;
    }

    static createFromImport(data) {
        const productId = clean(data.productId || data.articleKey || data.article);
        const warehouseName = clean(data.warehouseName || data.warehouse) || 'Не указан';
        const date = clean(data.date) || new Date().toISOString().slice(0, 10);
        return new StockRecord({
            ...data,
            id: data.id || StockRecord.makeId(productId, warehouseName, date),
            productId,
            warehouseName,
            date,
            quantity: data.quantity,
            reserved: data.reserved
        });
    }

    getAvailable() {
        return Math.max(0, this.quantity - this.reserved);
    }

    hasStock() {
        return this.getAvailable() > 0;
    }

    static aggregate(records) {
        const byWarehouse = {};
        let total = 0;
        let totalReserved = 0;
        let inTransitTo = 0;
        let inTransitFrom = 0;

        for (const record of records || []) {
            const key = clean(record.warehouseName) || 'Не указан';
            if (!byWarehouse[key]) {
                byWarehouse[key] = { quantity: 0, reserved: 0, available: 0 };
            }

            const quantity = number(record.quantity);
            const reserved = number(record.reserved);
            const available = Math.max(0, quantity - reserved);

            byWarehouse[key].quantity += quantity;
            byWarehouse[key].reserved += reserved;
            byWarehouse[key].available += available;
            total += quantity;
            totalReserved += reserved;
            inTransitTo += number(record.inTransitTo);
            inTransitFrom += number(record.inTransitFrom);
        }

        return {
            total,
            reserved: totalReserved,
            available: Math.max(0, total - totalReserved),
            inTransitTo,
            inTransitFrom,
            byWarehouse
        };
    }
}

export default StockRecord;
