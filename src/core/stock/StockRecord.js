// ============================================================
// STOCK RECORD — ЗАПИСЬ ОБ ОСТАТКАХ
// ============================================================

class StockRecord {
    constructor(data) {
        this.id = data.id || this._generateId();
        this.productId = data.productId || data.articleKey || '';
        this.warehouseName = data.warehouseName || data.warehouse || '';
        this.warehouseType = data.warehouseType || 'wb';
        this.quantity = Number(data.quantity) || 0;
        this.reserved = Number(data.reserved) || 0;
        this.available = Math.max(0, this.quantity - this.reserved);
        this.date = data.date || new Date().toISOString().split('T')[0];
        this.importBatchId = data.importBatchId || null;
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    static createFromImport(data) {
        return new StockRecord({
            productId: data.productId || data.articleKey,
            warehouseName: data.warehouseName || data.warehouse || 'Не указан',
            warehouseType: data.warehouseType || 'wb',
            quantity: data.quantity,
            reserved: data.reserved,
            date: data.date,
            importBatchId: data.importBatchId
        });
    }

    static createTest(productId, warehouseName, quantity, reserved = 0) {
        return new StockRecord({
            productId,
            warehouseName,
            warehouseType: 'wb',
            quantity,
            reserved,
            date: new Date().toISOString().split('T')[0]
        });
    }

    getAvailable() {
        return Math.max(0, this.quantity - this.reserved);
    }

    hasStock() {
        return this.getAvailable() > 0;
    }

    static aggregate(records) {
        if (!records || records.length === 0) {
            return { total: 0, byWarehouse: {}, available: 0, reserved: 0 };
        }

        const byWarehouse = {};
        let total = 0;
        let totalReserved = 0;

        records.forEach(record => {
            const key = record.warehouseName || 'Не указан';
            if (!byWarehouse[key]) {
                byWarehouse[key] = { quantity: 0, reserved: 0, available: 0 };
            }

            byWarehouse[key].quantity += record.quantity;
            byWarehouse[key].reserved += record.reserved;
            byWarehouse[key].available += record.getAvailable();
            total += record.quantity;
            totalReserved += record.reserved;
        });

        return {
            total,
            reserved: totalReserved,
            available: Math.max(0, total - totalReserved),
            byWarehouse
        };
    }
}

export default StockRecord;
