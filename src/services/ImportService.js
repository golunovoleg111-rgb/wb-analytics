// ============================================================
// IMPORT SERVICE — BELTANEE v6.1
// Единая точка входа для Excel/CSV. Повторный импорт одного
// отчёта заменяет соответствующий набор данных, а не добавляет его.
// ============================================================

import { Database } from '../infrastructure/db.js';

export const ImportTypes = {
    NOMENCLATURE: 'nomenclature',
    SALES: 'sales',
    STOCK_DAILY: 'stock_daily',
    STOCK_CURRENT: 'stock_current',
    PRICES: 'prices',
    MARGIN: 'margin',
    ADS: 'ads'
};

const TEMPLATES = {
    [ImportTypes.NOMENCLATURE]: {
        columns: ['Артикул продавца', 'Название карточки', 'Размер', 'Баркод', 'ТН ВЭД', 'Состав ткани', 'GTIN'],
        required: ['Артикул продавца', 'Размер'],
        filename: 'Beltanee_v6_1_Номенклатура.xlsx',
        description: '📦 Номенклатура'
    },
    [ImportTypes.SALES]: {
        columns: ['День', 'Артикул продавца', 'Выкупили, шт.', 'К перечислению за товар, руб.', 'Заказано, шт.', 'Сумма заказов минус комиссия WB, руб.'],
        required: ['День', 'Артикул продавца', 'Заказано, шт.'],
        filename: 'Beltanee_v6_1_Продажи.xlsx',
        description: '🛒 Продажи по дням'
    },
    [ImportTypes.STOCK_DAILY]: {
        columns: ['Артикул продавца', 'Название', 'Размер', 'Склад', '30.07.2026'],
        required: ['Артикул продавца', 'Размер', 'Склад'],
        filename: 'Beltanee_v6_1_Остатки_по_дням.xlsx',
        description: '📊 История остатков'
    },
    [ImportTypes.STOCK_CURRENT]: {
        columns: ['Артикул продавца', 'Размер вещи', 'В пути до получателей', 'В пути возвраты на склад WB', 'Всего на складах', 'Новосибирск'],
        required: ['Артикул продавца', 'Размер вещи'],
        filename: 'Beltanee_v6_1_Текущие_остатки.xlsx',
        description: '📦 Текущие остатки'
    },
    [ImportTypes.PRICES]: {
        columns: ['Артикул продавца', 'Текущая цена', 'Текущая скидка', 'Цена со скидкой'],
        required: ['Артикул продавца', 'Текущая цена'],
        filename: 'Beltanee_v6_1_Цены.xlsx',
        description: '💰 Цены и скидки'
    },
    [ImportTypes.MARGIN]: {
        columns: ['Артикул', 'Остаток', 'Закупочная цена', 'Рыночная цена - сейчас', 'Цена для клиента', 'Комиссия WB', 'Налог, %', 'Стоимость хранения', 'Срок хранения', 'Упаковка', 'Логистика', 'Итого себестоимость', 'Прибыль с 1 шт', 'Прибыль итого', 'Выручка', 'Вложения', 'Маржинальность', 'Объем', '% выкупа (месяц)'],
        required: ['Артикул', 'Закупочная цена'],
        filename: 'Beltanee_v6_1_Маржинальность.xlsx',
        description: '📈 Юнит-экономика'
    },
    [ImportTypes.ADS]: {
        columns: ['Кампания', 'Старт', 'Финиш', 'Показы', 'Частота', 'Клики', 'CPC', 'CPM', 'CTR(%)', 'Длительность', 'CR(%)', 'Затраты', 'Заказанные товары, шт', 'Добавления в корзину'],
        required: ['Кампания', 'Затраты'],
        filename: 'Beltanee_v6_1_Реклама.xlsx',
        description: '📢 Реклама'
    }
};

function clean(value) {
    return String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function normalizeKey(value) {
    return clean(value).toLowerCase().replace(/\s+/g, ' ');
}

function number(value) {
    if (value === null || value === undefined || value === '') return 0;
    let text = clean(value).replace(/\s/g, '').replace(/р\./gi, '').replace(/₽/g, '').replace(/%/g, '');
    if (text.includes(',') && text.includes('.')) {
        if (text.lastIndexOf(',') > text.lastIndexOf('.')) text = text.replace(/\./g, '').replace(',', '.');
        else text = text.replace(/,/g, '');
    } else {
        text = text.replace(',', '.');
    }
    const result = Number.parseFloat(text);
    return Number.isFinite(result) ? result : 0;
}

function percent(value) {
    return number(value);
}

function date(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
    const text = clean(value);
    if (!text) return null;

    const excel = Number(text);
    if (Number.isFinite(excel) && excel > 30000 && excel < 60000) {
        return new Date((excel - 25569) * 86400000).toISOString().slice(0, 10);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

    const parts = text.split(/[.\/-]/).map(Number);
    if (parts.length === 3 && parts.every(Number.isFinite)) {
        let [a, b, c] = parts;
        if (a >= 1900) return `${a}-${String(b).padStart(2, '0')}-${String(c).padStart(2, '0')}`;
        if (c >= 1900) return `${c}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    }

    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function valueFrom(row, names) {
    const entries = Object.entries(row || {});
    const wanted = names.map(normalizeKey);

    for (const [key, value] of entries) {
        if (wanted.includes(normalizeKey(key)) && clean(value) !== '') return value;
    }

    for (const target of wanted) {
        const found = entries.find(([key, value]) => {
            const current = normalizeKey(key);
            return clean(value) !== '' && (current.includes(target) || target.includes(current));
        });
        if (found) return found[1];
    }

    return '';
}

function parseArticle(article) {
    const full = clean(article);
    const parts = full.split('_').filter(Boolean);
    if (!full) return { baseModel: '', color: '', size: '' };

    const sizePattern = /^(\d{2,3}|XXS|XS|S|M|L|XL|XXL|XXXL)$/i;
    let sizeIndex = parts.findIndex(part => sizePattern.test(part));
    const size = sizeIndex >= 0 ? parts[sizeIndex] : '';

    const colorWords = new Set(['белый', 'черный', 'серый', 'красный', 'синий', 'зеленый', 'желтый', 'розовый', 'голубой', 'фиолетовый', 'оранжевый', 'коричневый', 'бежевый', 'графит', 'бордовый', 'бирюзовый', 'хаки', 'фуксия', 'шоколадный', 'кремовый', 'изумрудный', 'лавандовый']);
    let color = '';
    const modelParts = [];

    parts.forEach((part, index) => {
        if (index === sizeIndex) return;
        if (!color && colorWords.has(part.toLowerCase())) color = part;
        else modelParts.push(part);
    });

    if (!color && modelParts.length > 1) {
        const last = modelParts[modelParts.length - 1];
        if (!/^\d+$/.test(last)) {
            color = last;
            modelParts.pop();
        }
    }

    return { baseModel: modelParts.join('_') || full, color, size };
}

function makeArticleKey(article, size = '', color = '') {
    return `${clean(article)}|${clean(size) || 'NOSIZE'}|${clean(color) || 'NOCOLOR'}`.toLowerCase();
}

function makeProductData(article, size, extra = {}) {
    const parsed = parseArticle(article);
    const finalSize = clean(size) || parsed.size || 'NOSIZE';
    const finalColor = parsed.color || '';
    return {
        article: clean(article),
        articleKey: makeArticleKey(article, finalSize, finalColor),
        baseModel: parsed.baseModel,
        color: finalColor,
        size: finalSize,
        ...extra
    };
}

const AGGREGATE_STOCK_COLUMNS = new Set([
    'всего на складах',
    'всего находится на складах',
    'итого на складах',
    'остаток всего',
    'всего'
].map(normalizeKey));

class ImportService {
    static getTemplate(type) {
        return TEMPLATES[type] || null;
    }

    static getTemplates() {
        return { ...TEMPLATES };
    }

    static async processFile(file, type) {
        if (!TEMPLATES[type]) return { success: false, error: `Неизвестный тип импорта: ${type}` };
        if (!file) return { success: false, error: 'Файл не выбран' };

        try {
            const rows = await this._readFile(file);
            const validation = this._validateColumns(rows, TEMPLATES[type]);
            if (!validation.valid) return { success: false, error: validation.error, records: [], errors: [] };

            const parsed = this._parseAndValidate(rows, type);
            if (!parsed.records.length) {
                return { ...parsed, success: false, error: 'В файле нет валидных записей для импорта' };
            }

            await this._saveData(parsed.records, type);
            await Database.save(Database.STORES.IMPORTS, {
                id: `${type}|${Date.now()}`,
                type,
                fileName: file.name,
                rows: parsed.records.length,
                errors: parsed.errors.length,
                createdAt: new Date().toISOString()
            });

            return { ...parsed, success: parsed.errors.length === 0, fileName: file.name };
        } catch (error) {
            console.error('[ImportService]', error);
            return { success: false, error: error.message, records: [], errors: [] };
        }
    }

    static async importFile(file, type) {
        return this.processFile(file, type);
    }

    static _readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = event => {
                try {
                    const workbook = XLSX.read(event.target.result, { type: 'array', cellDates: true });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    resolve(XLSX.utils.sheet_to_json(sheet, { defval: '' }));
                } catch (error) {
                    reject(new Error(`Не удалось распознать Excel/CSV: ${error.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsArrayBuffer(file);
        });
    }

    static _validateColumns(rows, template) {
        if (!rows?.length) return { valid: false, error: 'Файл пуст' };
        const columns = Object.keys(rows[0]).map(normalizeKey);
        const missing = (template.required || []).filter(required => {
            const target = normalizeKey(required);
            return !columns.some(column => column === target || column.includes(target) || target.includes(column));
        });
        return missing.length ? { valid: false, error: `Отсутствуют обязательные колонки: ${missing.join(', ')}` } : { valid: true };
    }

    static _parseAndValidate(rows, type) {
        const records = [];
        const errors = [];
        const seen = new Set();

        const add = (record, key) => {
            if (!record) return;
            if (seen.has(key)) {
                // Внутри одного файла последняя строка является актуальной.
                const index = records.findIndex(item => item.id === key);
                if (index >= 0) records[index] = record;
                return;
            }
            seen.add(key);
            records.push(record);
        };

        rows.forEach((row, index) => {
            const rowNumber = index + 2;
            if (!Object.values(row || {}).some(value => clean(value) !== '')) return;

            try {
                if (type === ImportTypes.NOMENCLATURE) {
                    const article = clean(valueFrom(row, ['Артикул продавца', 'Артикул', 'article']));
                    const size = clean(valueFrom(row, ['Размер', 'Размер вещи', 'size']));
                    if (!article || !size) throw new Error('Не найден артикул или размер');
                    const parsed = makeProductData(article, size, {
                        name: clean(valueFrom(row, ['Название карточки', 'Название', 'name'])) || article,
                        barcode: clean(valueFrom(row, ['Баркод', 'barcode'])),
                        tnved: clean(valueFrom(row, ['ТН ВЭД', 'tnved'])),
                        fabric: clean(valueFrom(row, ['Состав ткани', 'fabric'])),
                        gtin: clean(valueFrom(row, ['GTIN', 'gtin'])),
                        category: clean(valueFrom(row, ['Предмет', 'Категория', 'category'])) || 'Товар',
                        price: 0,
                        purchasePrice: 0,
                        status: 'active'
                    });
                    add({ ...parsed, id: parsed.articleKey }, parsed.articleKey);
                    return;
                }

                if (type === ImportTypes.SALES) {
                    const article = clean(valueFrom(row, ['Артикул продавца', 'Артикул', 'article']));
                    const day = date(valueFrom(row, ['День', 'Дата', 'Дата заказа', 'Date']));
                    if (!article || !day) throw new Error('Не найден артикул или дата');
                    const id = `${article.toLowerCase()}|${day}`;
                    add({
                        id,
                        productId: article,
                        article,
                        date: day,
                        orders: number(valueFrom(row, ['Заказано, шт.', 'Заказано шт.', 'Заказано', 'Количество заказов'])),
                        delivered: number(valueFrom(row, ['Выкупили, шт.', 'Выкупили шт.', 'Выкупили', 'Выкуплено'])),
                        returns: number(valueFrom(row, ['Возвраты, шт.', 'Возвраты', 'Возвратов'])),
                        amount: number(valueFrom(row, ['К перечислению за товар, руб.', 'К перечислению за товар', 'Сумма выкупа'])),
                        totalAmount: number(valueFrom(row, ['Сумма заказов минус комиссия WB, руб.', 'Сумма заказов минус комиссия WB', 'Сумма заказов, руб.'])),
                        createdAt: new Date().toISOString()
                    }, id);
                    return;
                }

                if (type === ImportTypes.STOCK_DAILY) {
                    const article = clean(valueFrom(row, ['Артикул продавца', 'Артикул', 'article']));
                    const size = clean(valueFrom(row, ['Размер', 'Размер вещи', 'size']));
                    const warehouse = clean(valueFrom(row, ['Склад', 'warehouse']));
                    if (!article || !size || !warehouse) throw new Error('Не найден артикул, размер или склад');

                    const parsed = makeProductData(article, size);
                    for (const [column, raw] of Object.entries(row)) {
                        const day = date(column);
                        if (!day || raw === '') continue;
                        const id = `${parsed.articleKey}|${warehouse}|${day}`;
                        add({
                            id,
                            productId: parsed.articleKey,
                            articleKey: parsed.articleKey,
                            article,
                            warehouseName: warehouse,
                            warehouseType: 'wb',
                            date: day,
                            quantity: number(raw),
                            reserved: 0,
                            source: 'stock_daily',
                            createdAt: new Date().toISOString()
                        }, id);
                    }
                    return;
                }

                if (type === ImportTypes.STOCK_CURRENT) {
                    const article = clean(valueFrom(row, ['Артикул продавца', 'Артикул', 'article']));
                    const size = clean(valueFrom(row, ['Размер вещи', 'Размер', 'size']));
                    if (!article || !size) throw new Error('Не найден артикул или размер');

                    const parsed = makeProductData(article, size);
                    const inTransitTo = number(valueFrom(row, ['В пути до получателей']));
                    const inTransitFrom = number(valueFrom(row, ['В пути возвраты на склад WB', 'В пути возвраты']));
                    const today = new Date().toISOString().slice(0, 10);

                    for (const [column, raw] of Object.entries(row)) {
                        const warehouse = clean(column);
                        if (!warehouse || AGGREGATE_STOCK_COLUMNS.has(normalizeKey(warehouse))) continue;
                        if (['Артикул продавца', 'Артикул', 'Размер вещи', 'Размер', 'В пути до получателей', 'В пути возвраты на склад WB', 'В пути возвраты'].map(normalizeKey).includes(normalizeKey(warehouse))) continue;
                        if (raw === '') continue;

                        const id = `${parsed.articleKey}|${warehouse}|${today}`;
                        add({
                            id,
                            productId: parsed.articleKey,
                            articleKey: parsed.articleKey,
                            article,
                            warehouseName: warehouse,
                            warehouseType: 'wb',
                            date: today,
                            quantity: number(raw),
                            reserved: 0,
                            inTransitTo,
                            inTransitFrom,
                            source: 'stock_current',
                            createdAt: new Date().toISOString()
                        }, id);
                    }
                    return;
                }

                if (type === ImportTypes.PRICES) {
                    const article = clean(valueFrom(row, ['Артикул продавца', 'Артикул', 'article']));
                    if (!article) throw new Error('Не найден артикул');
                    add({
                        article,
                        price: number(valueFrom(row, ['Текущая цена', 'Цена', 'price'])),
                        discount: number(valueFrom(row, ['Текущая скидка', 'Скидка', 'discount'])),
                        priceWithDiscount: number(valueFrom(row, ['Цена со скидкой', 'Цена со скидкой, руб.']))
                    }, article.toLowerCase());
                    return;
                }

                if (type === ImportTypes.MARGIN) {
                    const article = clean(valueFrom(row, ['Артикул', 'Артикул продавца']));
                    if (!article) throw new Error('Не найден артикул');
                    add({
                        article,
                        purchasePrice: number(valueFrom(row, ['Закупочная цена'])),
                        marketPrice: number(valueFrom(row, ['Рыночная цена - сейчас'])),
                        clientPrice: number(valueFrom(row, ['Цена для клиента'])),
                        wbCommission: percent(valueFrom(row, ['Комиссия WB'])),
                        tax: percent(valueFrom(row, ['Налог, %'])),
                        storageCost: number(valueFrom(row, ['Стоимость хранения'])),
                        storageDays: number(valueFrom(row, ['Срок хранения'])),
                        packaging: number(valueFrom(row, ['Упаковка'])),
                        logistics: number(valueFrom(row, ['Логистика'])),
                        totalCost: number(valueFrom(row, ['Итого себестоимость'])),
                        profitPerUnit: number(valueFrom(row, ['Прибыль с 1 шт'])),
                        profitTotal: number(valueFrom(row, ['Прибыль итого'])),
                        revenue: number(valueFrom(row, ['Выручка'])),
                        investment: number(valueFrom(row, ['Вложения'])),
                        margin: percent(valueFrom(row, ['Маржинальность'])),
                        volume: number(valueFrom(row, ['Объем'])),
                        buyoutPercent: percent(valueFrom(row, ['% выкупа (месяц)']))
                    }, article.toLowerCase());
                    return;
                }

                if (type === ImportTypes.ADS) {
                    const campaign = clean(valueFrom(row, ['Кампания', 'campaign']));
                    if (!campaign) throw new Error('Не найдено название кампании');
                    const start = date(valueFrom(row, ['Старт', 'start']));
                    const id = `${campaign.toLowerCase()}|${start || 'nodate'}`;
                    add({
                        id,
                        campaign,
                        startDate: valueFrom(row, ['Старт', 'start']) || '',
                        finishDate: valueFrom(row, ['Финиш', 'finish']) || '',
                        impressions: number(valueFrom(row, ['Показы'])),
                        frequency: number(valueFrom(row, ['Частота'])),
                        clicks: number(valueFrom(row, ['Клики'])),
                        cpc: number(valueFrom(row, ['CPC'])),
                        cpm: number(valueFrom(row, ['CPM'])),
                        ctr: number(valueFrom(row, ['CTR(%)', 'CTR'])),
                        cr: number(valueFrom(row, ['CR(%)', 'CR'])),
                        spent: number(valueFrom(row, ['Затраты'])),
                        orders: number(valueFrom(row, ['Заказанные товары, шт'])),
                        cartAdds: number(valueFrom(row, ['Добавления в корзину'])),
                        createdAt: new Date().toISOString()
                    }, id);
                }
            } catch (error) {
                errors.push({ row: rowNumber, errors: [error.message] });
            }
        });

        return { records, errors, total: rows.length, valid: records.length, invalid: errors.length };
    }

    static async _saveData(records, type) {
        const now = new Date().toISOString();

        if (type === ImportTypes.NOMENCLATURE) {
            await Database.replaceAll(Database.STORES.PRODUCTS, records.map(record => ({ ...record, updatedAt: now })));
            return;
        }

        if (type === ImportTypes.SALES) {
            await Database.replaceAll(Database.STORES.SALES, records);
            return;
        }

        if (type === ImportTypes.STOCK_CURRENT) {
            await Database.replaceAll(Database.STORES.STOCK, records);
            return;
        }

        if (type === ImportTypes.STOCK_DAILY) {
            await Database.replaceAll(Database.STORES.STOCK_HISTORY, records);

            // Для карточек товара используем только последнюю дату из истории.
            const latest = {};
            for (const record of records) {
                const key = `${record.productId}|${record.warehouseName}`;
                if (!latest[key] || record.date > latest[key].date) latest[key] = record;
            }
            await Database.replaceAll(Database.STORES.STOCK, Object.values(latest));
            return;
        }

        if (type === ImportTypes.PRICES) {
            const products = await Database.getAll(Database.STORES.PRODUCTS);
            for (const product of products) {
                const article = normalizeKey(product.article);
                const match = records.find(record => normalizeKey(record.article) === article || article.startsWith(normalizeKey(record.article) + '_'));
                if (!match) continue;
                product.price = match.price;
                product.discount = match.discount;
                product.priceWithDiscount = match.priceWithDiscount;
                product.updatedAt = now;
                await Database.save(Database.STORES.PRODUCTS, product);
            }
            await Database.replaceAll(Database.STORES.PRICES, records.map((record, index) => ({ ...record, id: `${normalizeKey(record.article)}|${index}` })));
            return;
        }

        if (type === ImportTypes.MARGIN) {
            const products = await Database.getAll(Database.STORES.PRODUCTS);
            for (const product of products) {
                const article = normalizeKey(product.article);
                const match = records.find(record => article === normalizeKey(record.article) || article.startsWith(normalizeKey(record.article) + '_'));
                if (!match) continue;
                Object.assign(product, match);
                product.updatedAt = now;
                await Database.save(Database.STORES.PRODUCTS, product);
            }
            return;
        }

        if (type === ImportTypes.ADS) {
            await Database.replaceAll(Database.STORES.ADVERTISING, records);
        }
    }

    static downloadTemplate(type) {
        const template = TEMPLATES[type];
        if (!template || typeof XLSX === 'undefined') return;
        const workbook = XLSX.utils.book_new();
        const sheet = XLSX.utils.aoa_to_sheet([template.columns]);
        XLSX.utils.book_append_sheet(workbook, sheet, 'Шаблон');
        XLSX.writeFile(workbook, template.filename);
    }
}

export default ImportService;
