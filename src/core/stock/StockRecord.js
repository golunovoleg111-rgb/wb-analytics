// ============================================================
// STOCK RECORD — ОСТАТОК ПО ТОВАРУ / ВАРИАНТУ / СКЛАДУ
// ============================================================

function clean(value) {
    return String(value ?? '').trim();
}

function warehouseKey(value) {
    return clean(value).toLowerCase().replace(/\s+/g, ' ');
}

function number(value) {
    const n = Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
}

class StockRecord {
    constructor(data = {}) {
        this.productId = clean(data.productId || data.articleKey || data.article);
        this.articleKey = clean(data.articleKey || this.productId);
        this.article = clean(data.article || this.productId);
        this.warehouseName = clean(data.warehouseName || data.warehouse);
        this.warehouseType = data.warehouseType || 'wb';
        this.size = clean(data.size || data.sizeName || data['размер']);
        this.color = clean(data.color || data.colorName || data['цвет']);
        this.barcode = clean(data.barcode || data.barCode || data['штрихкод']);
        this.date = clean(data.date) || new Date().toISOString().slice(0, 10);
        this.quantity = number(data.quantity);
        this.reserved = number(data.reserved);
        this.available = Math.max(0, this.quantity - this.reserved);
        this.inTransitTo = number(data.inTransitTo);
        this.inTransitFrom = number(data.inTransitFrom);
        this.source = data.source || 'stock_current';
        this.importBatchId = data.importBatchId || null;
        this.createdAt = data.createdAt || new Date().toISOString();
        this.id = clean(data.id) || StockRecord.makeId(this.productId, this.warehouseName, this.size, this.color, this.barcode, this.date);
    }

    static makeId(productId, warehouseName, size = '', color = '', barcode = '', date = '') {
        return [productId, warehouseKey(warehouseName), clean(size), clean(color), clean(barcode), clean(date)].join('|');
    }

    static createFromImport(data) {
        const record = new StockRecord(data);
        if (!record.productId) throw new Error('Не указан артикул товара');
        if (!record.warehouseName) throw new Error('Не указан склад');
        return record;
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

        for (const raw of records || []) {
            const record = raw instanceof StockRecord ? raw : new StockRecord(raw);
            const displayName = clean(record.warehouseName) || 'Не указан';
            const key = warehouseKey(displayName) || 'не указан';
            if (!byWarehouse[key]) {
                byWarehouse[key] = { name: displayName, quantity: 0, reserved: 0, available: 0, inTransitTo: 0, inTransitFrom: 0 };
            }

            const quantity = number(record.quantity);
            const reserved = number(record.reserved);
            const available = Math.max(0, quantity - reserved);
            const to = number(record.inTransitTo);
            const from = number(record.inTransitFrom);

            byWarehouse[key].quantity += quantity;
            byWarehouse[key].reserved += reserved;
            byWarehouse[key].available += available;
            byWarehouse[key].inTransitTo += to;
            byWarehouse[key].inTransitFrom += from;
            total += quantity;
            totalReserved += reserved;
            inTransitTo += to;
            inTransitFrom += from;
        }

        return {
            total,
            reserved: totalReserved,
            available: Math.max(0, total - totalReserved),
            inTransitTo,
            inTransitFrom,
            byWarehouse: Object.fromEntries(Object.values(byWarehouse).map(item => [item.name, item]))
        };
    }
}

export default StockRecord;
