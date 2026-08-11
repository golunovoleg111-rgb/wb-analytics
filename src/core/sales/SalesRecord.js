// ============================================================
// SALES RECORD — BELTANEE v6.1
// ============================================================

function clean(value) { return String(value ?? '').trim(); }
function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }

class SalesRecord {
    constructor(data = {}) {
        this.productId = clean(data.productId || data.article);
        this.article = clean(data.article || this.productId);
        this.date = clean(data.date) || new Date().toISOString().slice(0, 10);
        this.id = clean(data.id) || SalesRecord.makeId(this.productId, this.date);
        this.orders = number(data.orders);
        this.delivered = number(data.delivered);
        this.returns = number(data.returns);
        this.amount = number(data.amount);
        this.totalAmount = number(data.totalAmount || data.amount);
        this.importBatchId = data.importBatchId || null;
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    static makeId(productId, date) { return `${clean(productId)}|${clean(date)}`; }

    static createFromImport(data) {
        const productId = clean(data.productId || data.article);
        const date = clean(data.date);
        return new SalesRecord({ ...data, id: data.id || SalesRecord.makeId(productId, date), productId, article: clean(data.article || productId), date, orders: data.orders, delivered: data.delivered, returns: data.returns, amount: data.amount, totalAmount: data.totalAmount || data.amount });
    }

    static aggregate(records) {
        return (records || []).reduce((acc, record) => ({
            totalOrders: acc.totalOrders + number(record.orders),
            totalDelivered: acc.totalDelivered + number(record.delivered),
            totalReturns: acc.totalReturns + number(record.returns),
            totalAmount: acc.totalAmount + number(record.amount)
        }), { totalOrders: 0, totalDelivered: 0, totalReturns: 0, totalAmount: 0 });
    }

    static filterByPeriod(records, startDate, endDate) {
        return (records || []).filter(record => record.date >= startDate && record.date <= endDate);
    }

    static filterLastDays(records, days = 30) {
        const end = new Date();
        const start = new Date(end);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (Math.max(1, Number(days)) - 1));
        return this.filterByPeriod(records, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    }
}

export default SalesRecord;
