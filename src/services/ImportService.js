// ============================================================
// IMPORT SERVICE — BELTANEE
// Существующие шаблоны WB не меняются. Система подстраивается под них.
// Импорт: файл -> проверка -> нормализация -> дедупликация -> база.
// ============================================================

import { Database } from '../infrastructure/db.js';
import { parseProductArticle, makeVariantKey } from '../core/product/ProductParser.js';

export const ImportTypes = {
    NOMENCLATURE: 'nomenclature', SALES: 'sales', STOCK_DAILY: 'stock_daily', STOCK_CURRENT: 'stock_current',
    PRICES: 'prices', MARGIN: 'margin', ADS: 'ads'
};

const TEMPLATES = {
    [ImportTypes.NOMENCLATURE]: { columns: ['Артикул продавца', 'Название карточки', 'Размер', 'Баркод', 'ТН ВЭД', 'Состав ткани', 'GTIN'], required: ['Артикул продавца', 'Размер'], filename: 'Beltanee_Номенклатура.xlsx', description: '📦 Номенклатура' },
    [ImportTypes.SALES]: { columns: ['День', 'Артикул продавца', 'Выкупили, шт.', 'К перечислению за товар, руб.', 'Заказано, шт.'], required: ['День', 'Артикул продавца', 'Заказано, шт.'], filename: 'Beltanee_Продажи.xlsx', description: '🛒 Продажи по дням' },
    [ImportTypes.STOCK_DAILY]: { columns: ['Артикул продавца', 'Название', 'Размер', 'Склад', '30.07.2026'], required: ['Артикул продавца', 'Размер', 'Склад'], filename: 'Beltanee_Остатки_по_дням.xlsx', description: '📊 История остатков' },
    [ImportTypes.STOCK_CURRENT]: { columns: ['Артикул продавца', 'Размер вещи', 'В пути до получателей', 'В пути возвраты на склад WB', 'Всего на складах', 'Новосибирск'], required: ['Артикул продавца', 'Размер вещи'], filename: 'Beltanee_Текущие_остатки.xlsx', description: '📦 Текущие остатки' },
    [ImportTypes.PRICES]: { columns: ['Артикул продавца', 'Текущая цена', 'Текущая скидка', 'Цена со скидкой'], required: ['Артикул продавца', 'Текущая цена'], filename: 'Beltanee_Цены.xlsx', description: '💰 Цены и скидки' },
    [ImportTypes.MARGIN]: { columns: ['Артикул', 'Остаток', 'Закупочная цена', 'Рыночная цена - сейчас', 'Цена для клиента', 'Комиссия WB', 'Налог, %', 'Стоимость хранения', 'Срок хранения', 'Упаковка', 'Логистика', 'Итого себестоимость', 'Прибыль с 1 шт', 'Прибыль итого', 'Выручка', 'Вложения', 'Маржинальность', 'Объем', '% выкупа (месяц)'], required: ['Артикул', 'Закупочная цена'], filename: 'Beltanee_Маржинальность.xlsx', description: '📈 Юнит-экономика' },
    [ImportTypes.ADS]: { columns: ['Кампания', 'Старт', 'Финиш', 'Показы', 'Частота', 'Клики', 'CPC', 'CPM', 'CTR(%)', 'Длительность', 'CR(%)', 'Затраты', 'Заказанные товары, шт', 'Добавления в корзину'], required: ['Кампания', 'Затраты'], filename: 'Beltanee_Реклама.xlsx', description: '📢 Реклама' }
};

const AGGREGATE_STOCK_COLUMNS = new Set(['всего на складах','всего находится на складах','итого на складах','остаток всего','всего'].map(normalizeKey));
const NON_WAREHOUSE_COLUMNS = new Set(['артикул продавца','артикул','название','название карточки','размер','размер вещи','в пути до получателей','в пути возвраты на склад wb','в пути возвраты','баркод','штрихкод','nm id','nmid','vendorcode','артикул wb','предмет','категория'].map(normalizeKey));

function clean(value) { return String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim(); }
function normalizeKey(value) { return clean(value).toLowerCase().replace(/\s+/g, ' '); }
function normalizeWarehouse(value) { return clean(value).replace(/\s+/g, ' '); }
function number(value) {
    if (value === null || value === undefined || value === '') return 0;
    let text = clean(value).replace(/\s/g, '').replace(/р\./gi, '').replace(/₽/g, '').replace(/%/g, '');
    if (text.includes(',') && text.includes('.')) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
    else text = text.replace(',', '.');
    const result = Number.parseFloat(text); return Number.isFinite(result) ? result : 0;
}
function date(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    const text = clean(value); if (!text) return null;
    const excel = Number(text);
    if (Number.isFinite(excel) && excel > 30000 && excel < 60000) return new Date((excel - 25569) * 86400000).toISOString().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    const p = text.split(/[.\/-]/).map(Number);
    if (p.length === 3 && p.every(Number.isFinite)) {
        if (p[0] >= 1900) return `${p[0]}-${String(p[1]).padStart(2,'0')}-${String(p[2]).padStart(2,'0')}`;
        if (p[2] >= 1900) return `${p[2]}-${String(p[1]).padStart(2,'0')}-${String(p[0]).padStart(2,'0')}`;
    }
    const parsed = new Date(text); return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}
function valueFrom(row, names) {
    const entries = Object.entries(row || {}), wanted = names.map(normalizeKey);
    for (const [key, value] of entries) if (wanted.includes(normalizeKey(key)) && clean(value) !== '') return value;
    for (const target of wanted) { const found = entries.find(([key, value]) => clean(value) !== '' && (normalizeKey(key).includes(target) || target.includes(normalizeKey(key)))); if (found) return found[1]; }
    return '';
}
function productData(article, suppliedSize = '', extra = {}) {
    const parsed = parseProductArticle(article, { size: suppliedSize, color: extra.color });
    const variantKey = makeVariantKey(parsed, extra.barcode);
    return { article: parsed.originalArticle, originalArticle: parsed.originalArticle, articleKey: variantKey, productGroupKey: parsed.productGroupKey, baseModel: parsed.productGroupKey, color: parsed.color, size: parsed.size, ...extra };
}
function upsert(records, map, record) {
    if (!record?.id) return;
    if (map.has(record.id)) { records[map.get(record.id)] = record; return; }
    map.set(record.id, records.length); records.push(record);
}
function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') return Object.keys(value).sort().reduce((out, key) => { out[key] = stableValue(value[key]); return out; }, {});
    return value instanceof Date ? value.toISOString() : value;
}
async function fingerprint(type, file, rows) {
    const payload = JSON.stringify(stableValue({ type, name: clean(file?.name), size: file?.size || 0, rows }));
    if (globalThis.crypto?.subtle) {
        const bytes = new TextEncoder().encode(payload); const digest = await crypto.subtle.digest('SHA-256', bytes);
        return `${type}|sha256:${Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
    }
    let hash = 2166136261; for (let i = 0; i < payload.length; i += 1) { hash ^= payload.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return `${type}|fnv:${(hash >>> 0).toString(16)}`;
}

class ImportService {
    static getTemplate(type) { return TEMPLATES[type] || null; }
    static getTemplates() { return { ...TEMPLATES }; }

    // Полный импорт существующего шаблона WB. Структура шаблона не изменяется.
    static async processFile(file, type, options = {}) {
        if (!TEMPLATES[type]) return { success: false, error: `Неизвестный тип импорта: ${type}` };
        if (!file) return { success: false, error: 'Файл не выбран' };
        try {
            const rows = await this._readFile(file);
            const validation = this._validateColumns(rows, TEMPLATES[type]);
            if (!validation.valid) return { success: false, error: validation.error, records: [], errors: [] };
            const fileFingerprint = await fingerprint(type, file, rows);
            const previous = await Database.getById(Database.STORES.IMPORTS, fileFingerprint);
            if (previous && !options.force) return { success: false, duplicateImport: true, error: 'Этот файл с таким содержимым уже импортирован.', importBatchId: previous.id, fileName: previous.fileName, records: [], errors: [], preview: previous.preview || null };
            const parsed = this._parseAndValidate(rows, type);
            if (!parsed.records.length) return { ...parsed, success: false, error: 'В файле нет валидных записей для импорта' };
            const batchId = `${type}|${Date.now()}|${normalizeKey(file.name)}`;
            const records = parsed.records.map(record => ({ ...record, importBatchId: batchId }));
            const preview = this._makePreview(records, parsed, type);
            if (options.previewOnly) return { ...parsed, records, success: parsed.errors.length === 0, fileName: file.name, importBatchId: batchId, fingerprint: fileFingerprint, preview };
            await this._saveData(records, type);
            await Database.save(Database.STORES.IMPORTS, { id: fileFingerprint, type, fileName: file.name, rows: records.length, sourceRows: rows.length, errors: parsed.errors.length, createdAt: new Date().toISOString(), importBatchId: batchId, fingerprint: fileFingerprint, preview });
            return { ...parsed, records, success: parsed.errors.length === 0, fileName: file.name, importBatchId: batchId, fingerprint: fileFingerprint, preview };
        } catch (error) { console.error('[ImportService]', error); return { success: false, error: error.message, records: [], errors: [] }; }
    }
    static async previewFile(file, type) { return this.processFile(file, type, { previewOnly: true }); }
    static async importFile(file, type, options = {}) { return this.processFile(file, type, options); }
    static async getImportHistory() { return (await Database.getAll(Database.STORES.IMPORTS)).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))); }

    static _makePreview(records, parsed, type) {
        const dates = records.map(r => r.date).filter(Boolean).sort();
        return { type, description: TEMPLATES[type]?.description || type, sourceRows: parsed.total, validRows: parsed.valid, invalidRows: parsed.invalid, recordCount: records.length, duplicateRows: Math.max(0, parsed.total - parsed.valid - parsed.invalid), dateFrom: dates[0] || null, dateTo: dates.at(-1) || null, errors: parsed.errors.slice(0, 20), sample: records.slice(0, 8).map(r => ({ article: r.article || r.articleKey || r.id, productGroupKey: r.productGroupKey, color: r.color, size: r.size, warehouse: r.warehouseName, date: r.date })) };
    }

    static _readFile(file) {
        return new Promise((resolve, reject) => {
            if (typeof XLSX === 'undefined') return reject(new Error('Библиотека XLSX не загружена'));
            const reader = new FileReader();
            reader.onload = event => { try { const workbook = XLSX.read(event.target.result, { type: 'array', cellDates: true }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; if (!sheet) throw new Error('В файле не найден лист'); resolve(XLSX.utils.sheet_to_json(sheet, { defval: '' })); } catch (error) { reject(new Error(`Не удалось распознать Excel/CSV: ${error.message}`)); } };
            reader.onerror = () => reject(new Error('Ошибка чтения файла')); reader.readAsArrayBuffer(file);
        });
    }
    static _validateColumns(rows, template) {
        if (!rows?.length) return { valid: false, error: 'Файл пуст' };
        const columns = Object.keys(rows[0]).map(normalizeKey);
        const missing = (template.required || []).filter(required => { const target = normalizeKey(required); return !columns.some(column => column === target || column.includes(target) || target.includes(column)); });
        return missing.length ? { valid: false, error: `Отсутствуют обязательные колонки: ${missing.join(', ')}` } : { valid: true };
    }

    static _parseAndValidate(rows, type) {
        const records = [], errors = [], seen = new Map();
        rows.forEach((row, index) => {
            const rowNumber = index + 2; if (!Object.values(row || {}).some(value => clean(value) !== '')) return;
            try {
                if (type === ImportTypes.NOMENCLATURE) {
                    const article = clean(valueFrom(row, ['Артикул продавца','Артикул','article'])); const size = clean(valueFrom(row, ['Размер','Размер вещи','size']));
                    if (!article) throw new Error('Не найден артикул');
                    const data = productData(article, size, { name: clean(valueFrom(row, ['Название карточки','Название','name'])) || article, barcode: clean(valueFrom(row, ['Баркод','barcode','Штрихкод'])), tnved: clean(valueFrom(row, ['ТН ВЭД','tnved'])), fabric: clean(valueFrom(row, ['Состав ткани','fabric'])), gtin: clean(valueFrom(row, ['GTIN','gtin'])), category: clean(valueFrom(row, ['Предмет','Категория','category'])) || 'Товар', status: 'active' });
                    upsert(records, seen, { ...data, id: data.articleKey }); return;
                }
                if (type === ImportTypes.SALES) {
                    const article = clean(valueFrom(row, ['Артикул продавца','Артикул','article'])); const day = date(valueFrom(row, ['День','Дата','Дата заказа','Date'])); if (!article || !day) throw new Error('Не найден артикул или дата');
                    const parsed = productData(article, valueFrom(row, ['Размер','Размер вещи','size']), { barcode: valueFrom(row, ['Баркод','Штрихкод','barcode']) });
                    const id = `${parsed.articleKey}|${day}`;
                    const current = records[seen.get(id)];
                    const incoming = { id, productId: parsed.articleKey, article: parsed.article, articleKey: parsed.articleKey, productGroupKey: parsed.productGroupKey, color: parsed.color, size: parsed.size, barcode: clean(parsed.barcode), date: day, orders: number(valueFrom(row, ['Заказано, шт.','Заказано шт.','Заказано','Количество заказов'])), delivered: number(valueFrom(row, ['Выкупили, шт.','Выкупили шт.','Выкуплено','Выкупили'])), returns: number(valueFrom(row, ['Возвраты, шт.','Возвраты','Возвратов'])), amount: number(valueFrom(row, ['К перечислению за товар, руб.','К перечислению за товар','Сумма выкупа'])), totalAmount: number(valueFrom(row, ['Сумма заказов минус комиссия WB, руб.','Сумма заказов минус комиссия WB','Сумма заказов, руб.'])), createdAt: new Date().toISOString() };
                    if (current) { current.orders += incoming.orders; current.delivered += incoming.delivered; current.returns += incoming.returns; current.amount += incoming.amount; current.totalAmount += incoming.totalAmount; } else upsert(records, seen, incoming); return;
                }
                if (type === ImportTypes.STOCK_DAILY) {
                    const article = clean(valueFrom(row, ['Артикул продавца','Артикул','article'])); const size = clean(valueFrom(row, ['Размер','Размер вещи','size'])); const warehouse = normalizeWarehouse(valueFrom(row, ['Склад','warehouse'])); if (!article || !warehouse) throw new Error('Не найден артикул или склад');
                    const parsed = productData(article, size);
                    for (const [column, raw] of Object.entries(row)) { const day = date(column); if (!day || raw === '') continue; const id = `${parsed.articleKey}|${normalizeKey(warehouse)}|${day}`; upsert(records, seen, { id, productId: parsed.articleKey, articleKey: parsed.articleKey, article: parsed.article, productGroupKey: parsed.productGroupKey, warehouseName: warehouse, warehouseType: 'wb', date: day, quantity: number(raw), reserved: 0, source: 'stock_daily', createdAt: new Date().toISOString() }); }
                    return;
                }
                if (type === ImportTypes.STOCK_CURRENT) {
                    const article = clean(valueFrom(row, ['Артикул продавца','Артикул','article'])); const size = clean(valueFrom(row, ['Размер вещи','Размер','size'])); if (!article) throw new Error('Не найден артикул');
                    const parsed = productData(article, size); const inTransitTo = number(valueFrom(row, ['В пути до получателей'])); const inTransitFrom = number(valueFrom(row, ['В пути возвраты на склад WB'])); const today = new Date().toISOString().slice(0, 10);
                    for (const [column, raw] of Object.entries(row)) { const warehouse = normalizeWarehouse(column); if (!warehouse || AGGREGATE_STOCK_COLUMNS.has(normalizeKey(warehouse)) || NON_WAREHOUSE_COLUMNS.has(normalizeKey(warehouse)) || raw === '') continue; const id = `${parsed.articleKey}|${normalizeKey(warehouse)}|${today}`; upsert(records, seen, { id, productId: parsed.articleKey, articleKey: parsed.articleKey, article: parsed.article, productGroupKey: parsed.productGroupKey, warehouseName: warehouse, warehouseType: 'wb', date: today, quantity: number(raw), reserved: 0, inTransitTo, inTransitFrom, source: 'stock_current', createdAt: new Date().toISOString() }); }
                    return;
                }
                if (type === ImportTypes.PRICES || type === ImportTypes.MARGIN) {
                    const article = clean(valueFrom(row, ['Артикул продавца','Артикул','article'])); if (!article) throw new Error('Не найден артикул');
                    if (type === ImportTypes.PRICES) upsert(records, seen, { id: normalizeKey(article), article, price: number(valueFrom(row, ['Текущая цена','Цена','price'])), discount: number(valueFrom(row, ['Текущая скидка','Скидка','discount'])), priceWithDiscount: number(valueFrom(row, ['Цена со скидкой','Цена со скидкой, руб.'])) });
                    else upsert(records, seen, { id: normalizeKey(article), article, purchasePrice: number(valueFrom(row, ['Закупочная цена'])), marketPrice: number(valueFrom(row, ['Рыночная цена - сейчас'])), clientPrice: number(valueFrom(row, ['Цена для клиента'])), wbCommission: number(valueFrom(row, ['Комиссия WB'])), tax: number(valueFrom(row, ['Налог, %'])), storageCost: number(valueFrom(row, ['Стоимость хранения'])), storageDays: number(valueFrom(row, ['Срок хранения'])), packaging: number(valueFrom(row, ['Упаковка'])), logistics: number(valueFrom(row, ['Логистика'])), totalCost: number(valueFrom(row, ['Итого себестоимость'])), profitPerUnit: number(valueFrom(row, ['Прибыль с 1 шт'])), profitTotal: number(valueFrom(row, ['Прибыль итого'])), revenue: number(valueFrom(row, ['Выручка'])), investment: number(valueFrom(row, ['Вложения'])), margin: number(valueFrom(row, ['Маржинальность'])), volume: number(valueFrom(row, ['Объем'])), buyoutPercent: number(valueFrom(row, ['% выкупа (месяц)'])) });
                    return;
                }
                if (type === ImportTypes.ADS) {
                    const campaign = clean(valueFrom(row, ['Кампания','campaign'])); if (!campaign) throw new Error('Не найдено название кампании'); const start = date(valueFrom(row, ['Старт','start'])); const id = `${normalizeKey(campaign)}|${start || 'nodate'}`;
                    upsert(records, seen, { id, campaign, startDate: start, finishDate: date(valueFrom(row, ['Финиш','finish'])), impressions: number(valueFrom(row, ['Показы'])), frequency: number(valueFrom(row, ['Частота'])), clicks: number(valueFrom(row, ['Клики'])), cpc: number(valueFrom(row, ['CPC'])), cpm: number(valueFrom(row, ['CPM'])), ctr: number(valueFrom(row, ['CTR(%)','CTR'])), cr: number(valueFrom(row, ['CR(%)','CR'])), spent: number(valueFrom(row, ['Затраты'])), orders: number(valueFrom(row, ['Заказанные товары, шт'])), cartAdds: number(valueFrom(row, ['Добавления в корзину'])) });
                }
            } catch (error) { errors.push({ row: rowNumber, errors: [error.message] }); }
        });
        return { records, errors, total: rows.length, valid: records.length, invalid: errors.length };
    }

    static async _mergeById(storeName, incoming, options = {}) {
        const existing = await Database.getAll(storeName); const map = new Map(existing.map(item => [item.id, item]));
        for (const item of incoming) map.set(item.id, { ...(map.get(item.id) || {}), ...item, importBatchId: options.importBatchId || item.importBatchId });
        await Database.replaceAll(storeName, Array.from(map.values()));
    }

    static async _saveData(records, type) {
        if (type === ImportTypes.NOMENCLATURE) { await Database.replaceAll(Database.STORES.PRODUCTS, records); return; }
        if (type === ImportTypes.SALES) { await this._mergeById(Database.STORES.SALES, records); return; }
        if (type === ImportTypes.STOCK_CURRENT) { await Database.replaceAll(Database.STORES.STOCK, records); return; }
        if (type === ImportTypes.STOCK_DAILY) {
            await this._mergeById(Database.STORES.STOCK_HISTORY, records);
            const history = await Database.getAll(Database.STORES.STOCK_HISTORY); const latest = new Map();
            for (const record of history) { const key = `${record.articleKey || record.productId}|${normalizeKey(record.warehouseName)}`; if (!latest.has(key) || record.date > latest.get(key).date) latest.set(key, record); }
            await Database.replaceAll(Database.STORES.STOCK, Array.from(latest.values())); return;
        }
        if (type === ImportTypes.PRICES) {
            await this._mergeById(Database.STORES.PRICES, records);
            const products = await Database.getAll(Database.STORES.PRODUCTS); const byArticle = new Map(records.map(record => [normalizeKey(record.article), record]));
            for (const product of products) { const match = byArticle.get(normalizeKey(product.article)); if (match) { Object.assign(product, match); await Database.save(Database.STORES.PRODUCTS, product); } }
            return;
        }
        if (type === ImportTypes.MARGIN) {
            const products = await Database.getAll(Database.STORES.PRODUCTS); const byArticle = new Map(records.map(record => [normalizeKey(record.article), record]));
            for (const product of products) { const match = byArticle.get(normalizeKey(product.article)); if (match) { Object.assign(product, match); await Database.save(Database.STORES.PRODUCTS, product); } }
            await this._mergeById(Database.STORES.FINANCE, records); return;
        }
        if (type === ImportTypes.ADS) await this._mergeById(Database.STORES.ADVERTISING, records);
    }

    static downloadTemplate(type) {
        const template = TEMPLATES[type]; if (!template || typeof XLSX === 'undefined') return;
        const workbook = XLSX.utils.book_new(); const sheet = XLSX.utils.aoa_to_sheet([template.columns]); XLSX.utils.book_append_sheet(workbook, sheet, 'Шаблон'); XLSX.writeFile(workbook, template.filename);
    }
}

export default ImportService;
