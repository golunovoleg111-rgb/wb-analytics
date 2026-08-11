// ============================================================
// SALES RECORD — BELTANEE
// Каноническая дневная запись продаж варианта товара.
// ============================================================

function clean(value) { return String(value ?? '').trim(); }
function number(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const normalized = clean(value).replace(/\s/g, '').replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : 0;
}
function dateOnly(value) {
    const text = clean(value);
    if (!text) return '';
    const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

class SalesRecord {
    constructor(data = {}) {
        this.productId = clean(data.productId || data.articleKey || data.article);
        this.articleKey = clean(data.articleKey) || this.productId;
        this.productGroupKey = clean(data.productGroupKey);
        this.article = clean(data.article || this.productId);
        this.date = dateOnly(data.date) || new Date().toISOString().slice(0, 10);
        this.id = clean(data.id) || SalesRecord.makeId(this.articleKey, this.date, data.source || 'sales');
        this.orders = Math.max(0, number(data.orders));
        this.delivered = Math.max(0, number(data.delivered));
        this.returns = Math.max(0, number(data.returns));
        this.amount = Math.max(0, number(data.amount));
        this.totalAmount = Math.max(0, number(data.totalAmount ?? data.amount));
        this.source = clean(data.source) || 'import';
        this.importBatchId = clean(data.importBatchId) || null;
        this.createdAt = data.createdAt || new Date().toISOString();
    }

    static makeId(articleKey, date, source = 'sales') {
        return `${clean(source)}|${clean(articleKey)}|${clean(date)}`;
    }

    static createFromImport(data) {
        const record = new SalesRecord(data);
        record.id = clean(data.id) || this.makeId(record.articleKey, record.date, record.source);
        return record;
    }

    static aggregate(records) {
        const seen = new Set();
        return (records || []).reduce((acc, record) => {
            const id = clean(record.id) || this.makeId(record.articleKey || record.productId || record.article, record.date, record.source || 'sales');
            if (seen.has(id)) return acc;
            seen.add(id);
            acc.totalOrders += number(record.orders);
            acc.totalDelivered += number(record.delivered);
            acc.totalReturns += number(record.returns);
            acc.totalAmount += number(record.amount);
            return acc;
        }, { totalOrders: 0, totalDelivered: 0, totalReturns: 0, totalAmount: 0, recordCount: seen.size });
    }

    static filterByPeriod(records, startDate, endDate) {
        const start = dateOnly(startDate);
        const end = dateOnly(endDate);
        if (!start || !end) return [];
        return (records || []).filter(record => {
            const date = dateOnly(record.date);
            return date >= start && date <= end;
        });
    }

    static filterLastDays(records, days = 30, now = new Date()) {
        const count = Math.max(1, Math.floor(number(days) || 30));
        const end = new Date(now);
        end.setHours(0, 0, 0, 0);
        const start = new Date(end);
        start.setDate(start.getDate() - (count - 1));
        return this.filterByPeriod(records, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
    }

    static validate(record) {
        const errors = [];
        if (!clean(record.articleKey || record.productId || record.article)) errors.push('Не указан идентификатор товара');
        if (!dateOnly(record.date)) errors.push('Некорректная дата');
        for (const field of ['orders', 'delivered', 'returns', 'amount']) {
            if (number(record[field]) < 0) errors.push(`Отрицательное значение: ${field}`);
        }
        if (number(record.delivered) > number(record.orders) && number(record.orders) > 0) errors.push('Выкупы превышают заказы');
        return { valid: errors.length === 0, errors };
    }
}

export default SalesRecord;
