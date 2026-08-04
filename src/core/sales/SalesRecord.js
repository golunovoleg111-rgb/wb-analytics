// ============================================================
// SALES RECORD — ЗАПИСЬ О ПРОДАЖАХ
// Сущность — только данные, без логики
// ============================================================

class SalesRecord {
    constructor(data) {
        this.id = data.id || this._generateId();
        this.productId = data.productId || '';
        this.date = data.date || new Date().toISOString().split('T')[0];
        this.orders = data.orders || 0;
        this.delivered = data.delivered || 0;
        this.returns = data.returns || 0;
        this.amount = data.amount || 0;
        this.importBatchId = data.importBatchId || null;
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    // ============================================================
    // СТАТИЧЕСКИЕ МЕТОДЫ
    // ============================================================

    static createFromImport(data) {
        return new SalesRecord({
            productId: data.productId,
            date: data.date,
            orders: data.orders || 0,
            delivered: data.delivered || 0,
            returns: data.returns || 0,
            amount: data.amount || 0,
            importBatchId: data.importBatchId || null
        });
    }

    // Создать тестовую запись
    static createTest(productId, date, orders, delivered, returns, amount) {
        return new SalesRecord({
            productId,
            date,
            orders,
            delivered,
            returns,
            amount
        });
    }

    // Агрегация: сумма продаж за период
    static aggregate(salesRecords) {
        if (!salesRecords || salesRecords.length === 0) {
            return { totalOrders: 0, totalDelivered: 0, totalReturns: 0, totalAmount: 0 };
        }

        return salesRecords.reduce((acc, record) => ({
            totalOrders: acc.totalOrders + record.orders,
            totalDelivered: acc.totalDelivered + record.delivered,
            totalReturns: acc.totalReturns + record.returns,
            totalAmount: acc.totalAmount + record.amount
        }), { totalOrders: 0, totalDelivered: 0, totalReturns: 0, totalAmount: 0 });
    }

    // Фильтрация по дате
    static filterByPeriod(records, startDate, endDate) {
        if (!records || records.length === 0) return [];
        return records.filter(r => r.date >= startDate && r.date <= endDate);
    }

    // Получить продажи за последние N дней
    static filterLastDays(records, days) {
        if (!records || records.length === 0) return [];
        const today = new Date();
        const cutoff = new Date(today);
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffStr = cutoff.toISOString().split('T')[0];
        return records.filter(r => r.date >= cutoffStr);
    }
}

export default SalesRecord;
