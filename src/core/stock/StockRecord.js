// ============================================================
// STOCK RECORD — ЗАПИСЬ ОБ ОСТАТКАХ
// ============================================================

class StockRecord {
    constructor(data) {
        this.id = data.id || this._generateId();
        this.productId = data.productId || '';
        this.warehouseName = data.warehouseName || ''; // 'Коледино', 'Казань', 'Новосибирск'
        this.warehouseType = data.warehouseType || 'wb'; // 'wb' | 'own' | 'transit'
        this.quantity = data.quantity || 0;
        this.reserved = data.reserved || 0; // зарезервировано под заказы
        this.available = (data.quantity || 0) - (data.reserved || 0);
        this.date = data.date || new Date().toISOString().split('T')[0];
        this.importBatchId = data.importBatchId || null;
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    static createFromImport(data) {
        return new StockRecord({
            productId: data.productId,
            warehouseName: data.warehouseName || 'Коледино',
            warehouseType: data.warehouseType || 'wb',
            quantity: data.quantity || 0,
            reserved: data.reserved || 0,
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

    // Получить доступное количество
    getAvailable() {
        return Math.max(0, this.quantity - this.reserved);
    }

    // Проверить, есть ли остаток
    hasStock() {
        return this.getAvailable() > 0;
    }

    // Суммировать остатки по товару
    static aggregate(records) {
        if (!records || records.length === 0) {
            return { total: 0, byWarehouse: {}, available: 0, reserved: 0 };
        }

        const byWarehouse = {};
        let total = 0;
        let totalReserved = 0;

        records.forEach(r => {
            const key = r.warehouseName || 'unknown';
            if (!byWarehouse[key]) {
                byWarehouse[key] = { quantity: 0, reserved: 0, available: 0 };
            }
            byWarehouse[key].quantity += r.quantity;
            byWarehouse[key].reserved += r.reserved;
            byWarehouse[key].available += r.getAvailable();
            total += r.quantity;
            totalReserved += r.reserved;
        });

        return {
            total,
            reserved: totalReserved,
            available: total - totalReserved,
            byWarehouse
        };
    }
}

export default StockRecord;
