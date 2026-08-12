// ============================================================
// BELTANEE — PRODUCTION DATA INTEGRITY
// Cross-store validation used before analytical pages consume data.
// ============================================================
import Database from '../infrastructure/db.js';

const AGGREGATE_WAREHOUSES = new Set(['всего на складах','всего находится на складах','итого на складах','остаток всего','всего','total','итого']);
const clean = value => String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
const key = value => clean(value).toLowerCase().replace(/\s+/g, ' ');
const articleKey = record => key(record?.articleKey || record?.productId || record?.article || record?.id);
const groupKey = record => key(record?.productGroupKey || record?.baseModel || record?.productId || record?.articleKey || record?.article);
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(clean(value)) && !Number.isNaN(Date.parse(`${clean(value)}T00:00:00`));
const finite = value => value === null || value === undefined || value === '' || Number.isFinite(Number(value));

class DataIntegrityService {
    static async inspect(options = {}) {
        const [products, sales, stock, stockHistory, imports, prices, finance, advertising] = await Promise.all([
            Database.getAll(Database.STORES.PRODUCTS), Database.getAll(Database.STORES.SALES), Database.getAll(Database.STORES.STOCK),
            Database.getAll(Database.STORES.STOCK_HISTORY), Database.getAll(Database.STORES.IMPORTS), Database.getAll(Database.STORES.PRICES),
            Database.getAll(Database.STORES.FINANCE), Database.getAll(Database.STORES.ADVERTISING)
        ]);
        const warnings = [];
        const add = (code, severity, count, message, examples = []) => {
            if (count) warnings.push({ code, severity, count, message, examples: [...new Set(examples)].slice(0, 10) });
        };
        const productArticles = new Set(products.map(articleKey).filter(Boolean));
        const productGroups = new Set(products.map(groupKey).filter(Boolean));

        const duplicateProducts = this._duplicates(products, articleKey);
        const duplicateSales = this._duplicates(sales, r => `${articleKey(r)}|${clean(r.date)}`);
        const duplicateStock = this._duplicates(stock, r => `${articleKey(r)}|${key(r.warehouseName)}|${clean(r.date || 'current')}`);
        const duplicateHistory = this._duplicates(stockHistory, r => `${articleKey(r)}|${key(r.warehouseName)}|${clean(r.date)}`);
        add('DUPLICATE_PRODUCTS','high',duplicateProducts.length,'Дубли вариантов в номенклатуре',duplicateProducts);
        add('DUPLICATE_SALES','high',duplicateSales.length,'Дубли дневных записей продаж',duplicateSales);
        add('DUPLICATE_STOCK','high',duplicateStock.length,'Дубли текущих остатков',duplicateStock);
        add('DUPLICATE_STOCK_HISTORY','high',duplicateHistory.length,'Дубли истории остатков',duplicateHistory);

        const aggregateStock = [...stock, ...stockHistory].filter(r => AGGREGATE_WAREHOUSES.has(key(r.warehouseName)));
        add('AGGREGATE_AS_WAREHOUSE','high',aggregateStock.length,'Агрегатные строки ошибочно сохранены как отдельные склады',aggregateStock.map(r => r.id));

        const invalidSales = sales.filter(r => !finite(r.orders) || !finite(r.delivered) || !finite(r.returns) || !finite(r.amount) || Number(r.orders) < 0 || Number(r.delivered) < 0 || Number(r.returns) < 0 || Number(r.amount) < 0 || (Number(r.orders) > 0 && Number(r.delivered) > Number(r.orders)) || !validDate(r.date));
        add('INVALID_SALES','high',invalidSales.length,'Продажи содержат невозможные числа или даты',invalidSales.map(r => r.id));

        const invalidStock = [...stock, ...stockHistory].filter(r => !finite(r.quantity ?? r.stock ?? r.amount) || Number(r.quantity ?? r.stock ?? 0) < 0 || !clean(r.warehouseName) || AGGREGATE_WAREHOUSES.has(key(r.warehouseName)) || (r.date && !validDate(r.date)));
        add('INVALID_STOCK','high',invalidStock.length,'Остатки содержат отрицательные значения, некорректные даты или склад',invalidStock.map(r => r.id));

        const missingProductGroup = products.filter(p => !groupKey(p));
        const missingVariantKey = products.filter(p => !articleKey(p));
        add('PRODUCT_GROUP_MISSING','medium',missingProductGroup.length,'У товаров отсутствует группа изделия',missingProductGroup.map(p => p.id));
        add('PRODUCT_KEY_MISSING','medium',missingVariantKey.length,'У товаров отсутствует уникальный ключ варианта',missingVariantKey.map(p => p.id));

        const salesWithoutProduct = sales.filter(r => { const a=articleKey(r), g=groupKey(r); return a && !productArticles.has(a) && !productGroups.has(g); });
        const stockWithoutProduct = stock.filter(r => { const a=articleKey(r), g=groupKey(r); return a && !productArticles.has(a) && !productGroups.has(g); });
        add('ORPHAN_SALES','medium',salesWithoutProduct.length,'Продажи не сопоставляются ни с одним товаром',salesWithoutProduct.map(r => r.id));
        add('ORPHAN_STOCK','medium',stockWithoutProduct.length,'Остатки не сопоставляются ни с одним товаром',stockWithoutProduct.map(r => r.id));

        const invalidPrices = prices.filter(r => !finite(r.price ?? r.currentPrice) || Number(r.price ?? r.currentPrice ?? 0) < 0);
        const invalidFinance = finance.filter(r => !finite(r.cost ?? r.costPrice ?? r.margin ?? r.profit) || Number(r.cost ?? r.costPrice ?? 0) < 0);
        const invalidAds = advertising.filter(r => !finite(r.cost ?? r.spend ?? r.amount) || Number(r.cost ?? r.spend ?? r.amount ?? 0) < 0);
        add('INVALID_PRICES','medium',invalidPrices.length,'Цены содержат некорректные значения',invalidPrices.map(r => r.id));
        add('INVALID_FINANCE','medium',invalidFinance.length,'Финансовые данные содержат некорректные значения',invalidFinance.map(r => r.id));
        add('INVALID_ADS','medium',invalidAds.length,'Реклама содержит некорректные расходы',invalidAds.map(r => r.id));

        const importsByBatch = new Map();
        for (const item of imports) { const batch=clean(item.importBatchId); if(!batch) continue; importsByBatch.set(batch,(importsByBatch.get(batch)||0)+1); }
        const duplicateBatches = [...importsByBatch.entries()].filter(([,count]) => count > 1).map(([batch]) => batch);
        add('DUPLICATE_IMPORT_BATCH','high',duplicateBatches.length,'Один импорт зарегистрирован несколько раз',duplicateBatches);

        const futureSales = sales.filter(r => validDate(r.date) && r.date > new Date().toISOString().slice(0,10));
        const futureHistory = stockHistory.filter(r => validDate(r.date) && r.date > new Date().toISOString().slice(0,10));
        add('FUTURE_SALES_DATE','medium',futureSales.length,'Продажи имеют дату из будущего',futureSales.map(r => r.id));
        add('FUTURE_STOCK_DATE','medium',futureHistory.length,'История остатков имеет дату из будущего',futureHistory.map(r => r.id));

        const counts = { products: products.length, sales: sales.length, stock: stock.length, stockHistory: stockHistory.length, imports: imports.length, prices: prices.length, finance: finance.length, advertising: advertising.length };
        return { ok: warnings.every(item => item.severity !== 'high'), checkedAt: new Date().toISOString(), counts, warnings, healthy: warnings.length === 0, summary: { high: warnings.filter(w=>w.severity==='high').reduce((n,w)=>n+w.count,0), medium: warnings.filter(w=>w.severity==='medium').reduce((n,w)=>n+w.count,0) }, options };
    }

    static async assertHealthy() {
        const report = await this.inspect();
        if (!report.ok) { const error = new Error(`Критические ошибки данных: ${report.summary.high}`); error.code='DATA_INTEGRITY_FAILED'; error.report=report; throw error; }
        return report;
    }

    static _duplicates(records, identity) {
        const seen = new Set(), duplicates = new Set();
        for (const record of records || []) { const value = identity(record); if (!value) continue; if (seen.has(value)) duplicates.add(value); seen.add(value); }
        return [...duplicates];
    }
}

export default DataIntegrityService;
