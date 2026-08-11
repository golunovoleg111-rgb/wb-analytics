// ============================================================
// BELTANEE — КОНТРОЛЬ ЦЕЛОСТНОСТИ ДАННЫХ
// ============================================================
import Database from '../infrastructure/db.js';

const AGGREGATE_WAREHOUSES = new Set(['всего на складах','всего находится на складах','итого на складах','остаток всего','всего','total','итого']);
const clean = value => String(value ?? '').trim();
const key = value => clean(value).toLowerCase().replace(/\s+/g, ' ');

class DataIntegrityService {
    static async inspect() {
        const [products, sales, stock] = await Promise.all([Database.getAll(Database.STORES.PRODUCTS), Database.getAll(Database.STORES.SALES), Database.getAll(Database.STORES.STOCK)]);
        const warnings = [];
        const add = (code, severity, count, message, examples = []) => { if (count) warnings.push({ code, severity, count, message, examples: examples.slice(0, 10) }); };

        const salesIds = this._duplicates(sales);
        const stockIds = this._duplicates(stock);
        add('DUPLICATE_SALES', 'high', salesIds.length, `Дубли продаж: ${salesIds.length}`, salesIds);
        add('DUPLICATE_STOCK', 'high', stockIds.length, `Дубли остатков: ${stockIds.length}`, stockIds);

        const aggregateStock = stock.filter(r => AGGREGATE_WAREHOUSES.has(key(r.warehouseName)));
        add('AGGREGATE_AS_WAREHOUSE', 'high', aggregateStock.length, 'Агрегатная строка ошибочно сохранена как склад', aggregateStock.map(r => r.id));

        const invalidSales = sales.filter(r => Number(r.orders) < 0 || Number(r.delivered) < 0 || Number(r.returns) < 0 || Number(r.amount) < 0 || (Number(r.orders) > 0 && Number(r.delivered) > Number(r.orders)));
        add('INVALID_SALES', 'high', invalidSales.length, 'Найдены невозможные значения в продажах', invalidSales.map(r => r.id));

        const missingProductGroup = products.filter(p => !clean(p.productGroupKey));
        add('PRODUCT_GROUP_MISSING', 'medium', missingProductGroup.length, 'У товаров отсутствует группа изделия', missingProductGroup.map(p => p.articleKey || p.article));

        const missingVariantKey = products.filter(p => !clean(p.articleKey));
        add('PRODUCT_KEY_MISSING', 'medium', missingVariantKey.length, 'У части товаров отсутствует уникальный ключ варианта', missingVariantKey.map(p => p.article || p.id));

        const salesWithoutDate = sales.filter(r => !/^\d{4}-\d{2}-\d{2}$/.test(clean(r.date)));
        add('SALES_DATE_INVALID', 'high', salesWithoutDate.length, 'Продажи содержат некорректные даты', salesWithoutDate.map(r => r.id));

        const stockWithoutWarehouse = stock.filter(r => !clean(r.warehouseName));
        add('STOCK_WAREHOUSE_MISSING', 'high', stockWithoutWarehouse.length, 'Остатки без склада не могут участвовать в складской аналитике', stockWithoutWarehouse.map(r => r.id));

        const duplicateVariants = this._duplicates(products, r => `${key(r.articleKey || r.article || r.id)}`);
        add('DUPLICATE_VARIANTS', 'medium', duplicateVariants.length, `Повторяющиеся варианты товаров: ${duplicateVariants.length}`, duplicateVariants);

        return { ok: warnings.every(item => item.severity !== 'high'), checkedAt: new Date().toISOString(), counts: { products: products.length, sales: sales.length, stock: stock.length }, warnings };
    }
    static _duplicates(records, identity = record => record?.id) {
        const seen = new Set(), duplicates = new Set();
        for (const record of records || []) { const value = identity(record); if (!value) continue; if (seen.has(value)) duplicates.add(value); seen.add(value); }
        return [...duplicates];
    }
}
export default DataIntegrityService;
