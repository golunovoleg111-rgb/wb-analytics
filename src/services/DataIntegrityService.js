// ============================================================
// BELTANEE v6.1 — КОНТРОЛЬ ЦЕЛОСТНОСТИ ДАННЫХ
// Не исправляет бизнес-данные молча: обнаруживает аномалии и
// возвращает понятный отчёт, который UI может показать пользователю.
// ============================================================

import Database from '../infrastructure/db.js';

const AGGREGATE_WAREHOUSES = new Set([
    'всего на складах', 'всего находится на складах', 'итого на складах',
    'остаток всего', 'всего'
]);

const clean = value => String(value ?? '').trim();
const key = value => clean(value).toLowerCase().replace(/\s+/g, ' ');

class DataIntegrityService {
    static async inspect() {
        const [products, sales, stock] = await Promise.all([
            Database.getAll(Database.STORES.PRODUCTS),
            Database.getAll(Database.STORES.SALES),
            Database.getAll(Database.STORES.STOCK)
        ]);

        const warnings = [];
        const duplicateIds = this._duplicates(sales.concat(stock));
        if (duplicateIds.length) warnings.push({
            code: 'DUPLICATE_IDS', severity: 'high', count: duplicateIds.length,
            message: `Обнаружены повторяющиеся ключи данных: ${duplicateIds.length}`
        });

        const fakeWarehouses = stock.filter(r => AGGREGATE_WAREHOUSES.has(key(r.warehouseName)));
        if (fakeWarehouses.length) warnings.push({
            code: 'AGGREGATE_AS_WAREHOUSE', severity: 'high', count: fakeWarehouses.length,
            message: 'Агрегатная колонка ошибочно попала в детализацию складов'
        });

        const impossibleSales = sales.filter(r => Number(r.orders) < 0 || Number(r.delivered) < 0 || Number(r.returns) < 0 || Number(r.amount) < 0);
        if (impossibleSales.length) warnings.push({
            code: 'INVALID_SALES', severity: 'high', count: impossibleSales.length,
            message: 'Найдены отрицательные значения в продажах'
        });

        const productsWithoutKey = products.filter(p => !clean(p.articleKey));
        if (productsWithoutKey.length) warnings.push({
            code: 'PRODUCT_KEY_MISSING', severity: 'medium', count: productsWithoutKey.length,
            message: 'У части товаров отсутствует уникальный ключ варианта'
        });

        return {
            ok: warnings.every(item => item.severity !== 'high'),
            checkedAt: new Date().toISOString(),
            counts: { products: products.length, sales: sales.length, stock: stock.length },
            warnings
        };
    }

    static _duplicates(records) {
        const seen = new Set();
        const duplicates = new Set();
        for (const record of records || []) {
            if (!record?.id) continue;
            if (seen.has(record.id)) duplicates.add(record.id);
            seen.add(record.id);
        }
        return [...duplicates];
    }
}

export default DataIntegrityService;
