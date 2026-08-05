// ============================================================
// IMPORT SERVICE — ЕДИНЫЙ СЕРВИС ДЛЯ ВСЕХ ТИПОВ ИМПОРТА
// ============================================================

import { Database } from '../infrastructure/db.js';

// ============================================================
// ТИПЫ ИМПОРТА
// ============================================================

export const ImportTypes = {
    NOMENCLATURE: 'nomenclature',
    SALES: 'sales',
    STOCK_DAILY: 'stock_daily',
    STOCK_CURRENT: 'stock_current',
    PRICES: 'prices',
    MARGIN: 'margin',
    ADS: 'ads'
};

// ============================================================
// ШАБЛОНЫ КОЛОНОК
// ============================================================

const TEMPLATES = {
    [ImportTypes.NOMENCLATURE]: {
        columns: ['Артикул продавца', 'Название карточки', 'Размер', 'Баркод', 'ТН ВЭД', 'Состав ткани', 'GTIN'],
        required: ['Артикул продавца', 'Название карточки', 'Размер', 'Баркод'],
        filename: 'StockFlow_Шаблон_Номенклатура.xlsx',
        description: '📦 Номенклатура — товары и их характеристики'
    },
    [ImportTypes.SALES]: {
        columns: ['День', 'Артикул продавца', 'Выкупили, шт.', 'К перечислению за товар, руб.', 'Заказано, шт.', 'Сумма заказов минус комиссия WB, руб.'],
        required: ['День', 'Артикул продавца', 'Выкупили, шт.', 'Заказано, шт.', 'К перечислению за товар, руб.'],
        filename: 'StockFlow_Шаблон_Продажи.xlsx',
        description: '🛒 Продажи — динамика продаж по дням'
    },
    [ImportTypes.STOCK_DAILY]: {
        columns: ['Артикул продавца', 'Название', 'Размер', 'Склад', '30.07.2026'],
        required: ['Артикул продавца', 'Размер', 'Склад'],
        filename: 'StockFlow_Шаблон_Остатки_по_дням.xlsx',
        description: '📊 Остатки по дням — детализация по датам и складам'
    },
    [ImportTypes.STOCK_CURRENT]: {
        columns: ['Артикул продавца', 'Размер вещи', 'В пути до получателей', 'В пути возвраты', 'Всего на складах', 'Новосибирск'],
        required: ['Артикул продавца', 'Размер вещи'],
        filename: 'StockFlow_Шаблон_Текущие_остатки.xlsx',
        description: '📦 Текущие остатки — актуальные остатки и в пути'
    },
    [ImportTypes.PRICES]: {
        columns: ['Артикул продавца', 'Текущая цена', 'Текущая скидка', 'Цена со скидкой'],
        required: ['Артикул продавца', 'Текущая цена'],
        filename: 'StockFlow_Шаблон_Цены_и_скидки.xlsx',
        description: '💰 Цены и скидки — актуальные цены из WB'
    },
    [ImportTypes.MARGIN]: {
        columns: [
            'Артикул', 'Остаток', 'Закупочная цена', 'Рыночная цена - сейчас',
            'Цена для клиента', 'Комиссия WB', 'Налог, %', 'Стоимость хранения',
            'Срок хранения', 'Упаковка', 'Логистика', 'Итого себестоимость',
            'Прибыль с 1 шт', 'Прибыль итого', 'Выручка', 'Вложения',
            'Маржинальность', 'Объем', '% выкупа (месяц)'
        ],
        required: ['Артикул', 'Закупочная цена'],
        filename: 'StockFlow_Шаблон_Маржинальность.xlsx',
        description: '📊 Маржинальность — экономические показатели по товарам'
    },
    [ImportTypes.ADS]: {
        columns: [
            'Кампания', 'Старт', 'Финиш', 'Показы', 'Частота',
            'Клики', 'CPC', 'CPM', 'CTR(%)', 'Длительность',
            'CR(%)', 'Затраты', 'Заказанные товары, шт', 'Добавления в корзину'
        ],
        required: ['Кампания', 'Затраты', 'Заказанные товары, шт'],
        filename: 'StockFlow_Шаблон_Реклама.xlsx',
        description: '📢 Реклама — эффективность рекламных кампаний'
    }
};

// ============================================================
// ПРИМЕРЫ ДЛЯ ШАБЛОНОВ
// ============================================================

const EXAMPLES = {
    [ImportTypes.NOMENCLATURE]: ['210_Комбез_графит_42', 'Комбез графит', '42', '4601234567890', '6104.63.0000', '95% хлопок, 5% эластан', '04601234567890'],
    [ImportTypes.SALES]: ['01.05.2026', '210_Комбез_графит', '3', '6740,03', '3', '7131,48'],
    [ImportTypes.STOCK_DAILY]: ['210_Комбез_графит', 'Комбез графит', '42', 'Коледино', '50'],
    [ImportTypes.STOCK_CURRENT]: ['210_Комбез_графит', '42', '5', '2', '50', '45'],
    [ImportTypes.PRICES]: ['210_Комбез_графит', '7000', '67', '2310'],
    [ImportTypes.MARGIN]: [
        '21_К_Вельвет_бирюзовый', '1098', 'р.796,00', 'р.2 627,00',
        '2049,06 р.', '25%', '2%', '0,845 р.',
        '60', '10,00 р.', 'р.980,24', '2 546,23 р.',
        '80,77 р.', '88 682,32 р.', '2 884 446,00 р.', '884 988,00 р.',
        '3%', '8,45', '35'
    ],
    [ImportTypes.ADS]: [
        'Кампания от 29.06.2026 - КЗЖ№2 - Беж - Авто',
        '2026-06-29 11:02:28',
        '2026-08-05 15:42:54',
        '2', '1', '0', '0', '320', '0', '892:40:26',
        '0', '0,64', '0', '0'
    ]
};

// ============================================================
// УНИВЕРСАЛЬНЫЕ ФУНКЦИИ ПАРСИНГА
// ============================================================

function cleanString(value) {
    if (!value && value !== 0) return '';
    const str = String(value).trim();
    return str.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

function findValue(row, possibleKeys) {
    if (!row || typeof row !== 'object') return null;
    
    const normalizedKeys = {};
    for (const key of Object.keys(row)) {
        const cleanKey = cleanString(key);
        normalizedKeys[cleanKey] = key;
    }
    
    for (const searchKey of possibleKeys) {
        const cleanSearchKey = cleanString(searchKey);
        
        if (normalizedKeys[cleanSearchKey]) {
            const value = row[normalizedKeys[cleanSearchKey]];
            const cleaned = cleanString(value);
            if (cleaned !== '') return cleaned;
        }
        
        const lowerSearch = cleanSearchKey.toLowerCase();
        for (const [cleanKey, origKey] of Object.entries(normalizedKeys)) {
            const lowerKey = cleanKey.toLowerCase();
            if (lowerKey.includes(lowerSearch) || lowerSearch.includes(lowerKey)) {
                const value = row[origKey];
                const cleaned = cleanString(value);
                if (cleaned !== '') return cleaned;
            }
        }
    }
    
    return null;
}

function parseDateUniversal(dateStr) {
    if (!dateStr) return null;
    
    const str = cleanString(dateStr);
    if (!str) return null;
    
    const num = parseFloat(str);
    if (!isNaN(num) && num > 30000 && num < 60000) {
        const date = new Date((num - 25569) * 86400 * 1000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return str;
    }
    
    const separators = ['.', '/', '-', ' '];
    let parts = null;
    
    for (const sep of separators) {
        const split = str.split(sep);
        if (split.length === 3) {
            parts = split.map(p => cleanString(p));
            break;
        }
    }
    
    if (!parts) {
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return null;
    }
    
    let day, month, year;
    const p1 = parseInt(parts[0]);
    const p2 = parseInt(parts[1]);
    const p3 = parseInt(parts[2]);
    
    if (p3 >= 1900 && p3 <= 2100) {
        year = p3;
        if (p1 <= 12 && p2 <= 31) {
            month = p1;
            day = p2;
        } else {
            day = p1;
            month = p2;
        }
    } else if (p1 >= 1900 && p1 <= 2100) {
        year = p1;
        month = p2;
        day = p3;
    } else {
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return null;
    }
    
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
        return null;
    }
    
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseNumber(value) {
    if (!value && value !== 0) return 0;
    const str = cleanString(String(value));
    if (!str) return 0;
    const cleaned = str.replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

// ============================================================
// УНИВЕРСАЛЬНЫЙ ПАРСИНГ ЧИСЕЛ ДЛЯ МАРЖИНАЛЬНОСТИ
// ============================================================

function parseUniversalNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    
    let str = cleanString(String(value));
    if (!str) return 0;
    
    const naPatterns = ['n/a', 'н/д', '—', '-', 'na', 'undefined', 'null'];
    if (naPatterns.some(p => str.toLowerCase() === p)) {
        return 0;
    }
    
    str = str.replace(/р\./g, '').replace(/\s/g, '');
    str = str.replace(/%/g, '');
    str = str.replace(/,/g, '.');
    
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

function parseUniversalPercent(value) {
    if (value === null || value === undefined || value === '') return 0;
    
    let str = cleanString(String(value));
    if (!str) return 0;
    
    const naPatterns = ['n/a', 'н/д', '—', '-', 'na', 'undefined', 'null'];
    if (naPatterns.some(p => str.toLowerCase() === p)) {
        return 0;
    }
    
    str = str.replace(/%/g, '').replace(/\s/g, '').replace(/,/g, '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

function parseArticle(article) {
    if (!article) return { baseModel: '', color: '', size: '', full: '' };
    const full = cleanString(article);
    let baseModel = full;
    let color = '';
    let size = '';

    const parts = full.split('_');
    if (parts.length === 1) {
        return { baseModel: full, color: '', size: '', full };
    }

    let sizeIndex = -1;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        if (part.match(/^\d{2,3}$/) || part.match(/^[XxSsMmLl]{1,4}$/)) {
            sizeIndex = i;
            size = part;
            break;
        }
    }

    const nameParts = [];
    let colorPart = '';
    const colorKeywords = ['белый', 'черный', 'серый', 'красный', 'синий', 'зеленый', 'желтый', 
                           'розовый', 'голубой', 'фиолетовый', 'оранжевый', 'коричневый', 
                           'бежевый', 'графит', 'бордовый', 'бирюзовый', 'салатовый', 
                           'лавандовый', 'графитовый', 'изумрудный', 'шоколадный', 
                           'кремовый', 'золотистый', 'серебристый', 'персиковый', 
                           'васильковый', 'лимонный', 'темный', 'светлый', 'хаки', 'фуксия'];

    for (let i = 0; i < parts.length; i++) {
        if (i === sizeIndex) continue;
        const part = parts[i].trim();
        if (!part) continue;
        
        const lowerPart = part.toLowerCase();
        if (colorKeywords.some(keyword => lowerPart.includes(keyword))) {
            colorPart = part;
        } else {
            nameParts.push(part);
        }
    }

    baseModel = nameParts.join('_');
    color = colorPart;

    if (!color && nameParts.length > 1) {
        const lastPart = nameParts[nameParts.length - 1];
        if (lastPart && !lastPart.match(/^\d+$/)) {
            color = lastPart;
            nameParts.pop();
            baseModel = nameParts.join('_');
        }
    }

    if (!baseModel) {
        baseModel = full.replace('_' + size, '');
        if (baseModel.endsWith('_')) baseModel = baseModel.slice(0, -1);
    }

    return { baseModel: baseModel || full, color, size, full };
}

function createArticleKey(article, size = 'NOSIZE', color = 'NOCOLOR') {
    return `${cleanString(article)}|${cleanString(size)}|${cleanString(color)}`.toLowerCase();
}

// ============================================================
// ОСНОВНОЙ КЛАСС
// ============================================================

class ImportService {
    
    static getTemplate(type) {
        return TEMPLATES[type] || null;
    }

    static async processFile(file, type) {
        console.log(`📥 Импорт ${type} из файла:`, file.name);

        if (!TEMPLATES[type]) {
            return { success: false, error: `Неизвестный тип импорта: ${type}` };
        }

        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!validExtensions.includes(ext)) {
            return { success: false, error: 'Неверный формат файла. Поддерживаются XLSX, XLS, CSV.' };
        }

        let data;
        try {
            data = await this._readFile(file);
        } catch (err) {
            return { success: false, error: `Ошибка чтения файла: ${err.message}` };
        }

        if (data && data.length > 0) {
            console.log('📋 Колонки в файле:', Object.keys(data[0]));
        }

        const template = TEMPLATES[type];
        const columnCheck = this._validateColumns(data, template);
        if (!columnCheck.valid) {
            return { success: false, error: columnCheck.error };
        }

        const result = this._parseAndValidate(data, type, template);

        if (result.records.length > 0) {
            await this._saveData(result.records, type);
        }

        return result;
    }

    static _readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const wb = XLSX.read(e.target.result, { type: 'array' });
                    const sh = wb.Sheets[wb.SheetNames[0]];
                    const data = XLSX.utils.sheet_to_json(sh, { defval: '' });
                    resolve(data);
                } catch (err) {
                    reject(new Error(`Ошибка парсинга: ${err.message}`));
                }
            };
            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
            reader.readAsArrayBuffer(file);
        });
    }

    static _validateColumns(data, template) {
        if (!data || data.length === 0) {
            return { valid: false, error: 'Файл пуст' };
        }

        const actualColumns = Object.keys(data[0]);
        const required = template.required || [];
        
        const missing = [];
        for (const req of required) {
            const found = actualColumns.some(col => {
                const cleanCol = cleanString(col).toLowerCase();
                const cleanReq = cleanString(req).toLowerCase();
                return cleanCol === cleanReq || cleanCol.includes(cleanReq) || cleanReq.includes(cleanCol);
            });
            if (!found) {
                missing.push(req);
            }
        }
        
        if (missing.length > 0) {
            return {
                valid: false,
                error: `Отсутствуют обязательные колонки: ${missing.join(', ')}`
            };
        }

        return { valid: true };
    }

    static _parseAndValidate(data, type, template) {
        const records = [];
        const errors = [];

        data.forEach((row, index) => {
            const rowNum = index + 1;
            const rowErrors = [];

            if (!row || typeof row !== 'object') {
                errors.push({ row: rowNum, errors: ['Строка пуста'] });
                return;
            }

            const hasAnyData = Object.values(row).some(v => v !== null && v !== undefined && cleanString(v) !== '');
            if (!hasAnyData) {
                return;
            }

            // ============================================================
            // ПАРСИНГ НОМЕНКЛАТУРЫ
            // ============================================================
            if (type === ImportTypes.NOMENCLATURE) {
                const article = findValue(row, ['Артикул продавца', 'Артикул', 'article']);
                const name = findValue(row, ['Название карточки', 'Название', 'name']);
                const sizeFromCol = findValue(row, ['Размер', 'size']);
                const barcode = findValue(row, ['Баркод', 'barcode']);
                const tnved = findValue(row, ['ТН ВЭД', 'tnved']);
                const fabric = findValue(row, ['Состав ткани', 'fabric']);
                const gtin = findValue(row, ['GTIN', 'gtin']);

                if (!article) rowErrors.push('Артикул продавца не найден');
                if (!name) rowErrors.push('Название карточки не найдено');
                if (!sizeFromCol) rowErrors.push('Размер не найден');
                if (!barcode) rowErrors.push('Баркод не найден');

                if (rowErrors.length > 0) {
                    errors.push({ row: rowNum, errors: rowErrors });
                    return;
                }

                const parsed = parseArticle(article);
                const finalSize = sizeFromCol || parsed.size || 'NOSIZE';
                const finalColor = parsed.color || '';
                const baseModel = parsed.baseModel || article;
                const finalName = name || baseModel || article;
                const articleKey = createArticleKey(article, finalSize, finalColor);

                records.push({
                    article, articleKey, baseModel, color: finalColor, size: finalSize,
                    name: finalName, barcode, tnved: tnved || '', fabric: fabric || '',
                    gtin: gtin || '', category: '', purchasePrice: 0, price: 0, status: 'active'
                });
                return;
            }

            // ============================================================
            // ПАРСИНГ ПРОДАЖ
            // ============================================================
            if (type === ImportTypes.SALES) {
                const article = findValue(row, [
                    'Артикул продавца', 'Артикул', 'article', 'Артикул продавца (артикул)'
                ]);
                
                const dateStr = findValue(row, [
                    'День', 'Дата', 'Date', 'Дата заказа', 'Дата заказа (местное время)'
                ]);
                
                const redeemed = findValue(row, [
                    'Выкупили, шт.', 'Выкупили шт.', 'Выкупили', 'Выкуплено, шт.', 
                    'Выкуплено', 'Количество выкупов', 'Выкупили, шт'
                ]);
                
                const amount = findValue(row, [
                    'К перечислению за товар, руб.', 'К перечислению за товар руб.', 
                    'К перечислению за товар', 'Сумма выкупа', 'Сумма выкупа, руб.'
                ]);
                
                const orders = findValue(row, [
                    'Заказано, шт.', 'Заказано шт.', 'Заказано', 'Количество заказов',
                    'Заказов, шт.', 'Заказано, шт'
                ]);
                
                const totalAmount = findValue(row, [
                    'Сумма заказов минус комиссия WB, руб.', 'Сумма заказов минус комиссия WB руб.',
                    'Сумма заказов минус комиссия WB', 'Сумма заказов, руб.', 'Сумма заказов'
                ]);

                const hasError = !article || !dateStr;
                
                if (hasError) {
                    const errorDetails = [];
                    if (!article) errorDetails.push('Артикул продавца не найден');
                    if (!dateStr) errorDetails.push('Дата (День) не найдена');
                    
                    console.log(`🔴 ОШИБКА в строке ${rowNum}:`, {
                        row,
                        found: { article, dateStr, redeemed, amount, orders, totalAmount },
                        keys: Object.keys(row)
                    });
                    
                    errors.push({ row: rowNum, errors: errorDetails });
                    return;
                }

                const cleanArticle = cleanString(article);
                if (!cleanArticle) {
                    errors.push({ row: rowNum, errors: ['Артикул пустой после очистки'] });
                    return;
                }

                const parsedDate = parseDateUniversal(dateStr);
                if (!parsedDate) {
                    console.log(`🔴 НЕКОРРЕКТНАЯ ДАТА в строке ${rowNum}: "${dateStr}"`);
                    errors.push({ row: rowNum, errors: [`Некорректная дата: "${dateStr}"`] });
                    return;
                }

                const articleKey = createArticleKey(cleanArticle);

                records.push({
                    articleKey, productId: articleKey, article: cleanArticle,
                    size: 'NOSIZE', warehouse: 'Не указан',
                    date: parsedDate,
                    orders: parseNumber(orders),
                    redeemed: parseNumber(redeemed),
                    delivered: parseNumber(redeemed),
                    amount: parseNumber(amount),
                    totalAmount: parseNumber(totalAmount || amount),
                    returns: 0,
                    fileName: row._fileName || '',
                    importDate: new Date().toISOString()
                });
                return;
            }

            // ============================================================
            // ПАРСИНГ ОСТАТКОВ ПО ДНЯМ (STOCK_DAILY)
            // ============================================================
            if (type === ImportTypes.STOCK_DAILY) {
                const article = findValue(row, ['Артикул продавца', 'Артикул', 'article']);
                const name = findValue(row, ['Название', 'name']);
                const size = findValue(row, ['Размер', 'size']);
                const warehouse = findValue(row, ['Склад', 'warehouse']);
                
                if (!article) {
                    errors.push({ row: rowNum, errors: ['Артикул продавца не найден'] });
                    return;
                }
                
                if (!size) {
                    errors.push({ row: rowNum, errors: ['Размер не найден'] });
                    return;
                }
                
                if (!warehouse) {
                    errors.push({ row: rowNum, errors: ['Склад не найден'] });
                    return;
                }
                
                const knownColumns = ['Артикул продавца', 'Название', 'Размер', 'Склад'];
                const dateColumns = Object.keys(row).filter(key => {
                    if (knownColumns.includes(key)) return false;
                    const val = row[key];
                    if (val === null || val === undefined || val === '') return false;
                    const cleanKey = cleanString(key);
                    return cleanKey.match(/^\d{2}\.\d{2}\.\d{4}$/) || 
                           cleanKey.match(/^\d{4}\.\d{2}\.\d{2}$/) ||
                           cleanKey.match(/^\d{2}\/\d{2}\/\d{4}$/);
                });
                
                if (dateColumns.length === 0) {
                    errors.push({ row: rowNum, errors: ['Не найдены колонки с датами'] });
                    return;
                }
                
                const cleanArticle = cleanString(article);
                const cleanSize = cleanString(size);
                const cleanWarehouse = cleanString(warehouse);
                const articleKey = createArticleKey(cleanArticle, cleanSize);
                
                for (const dateKey of dateColumns) {
                    const quantity = parseNumber(row[dateKey]);
                    const parsedDate = parseDateUniversal(dateKey);
                    if (parsedDate) {
                        records.push({
                            articleKey,
                            productId: articleKey,
                            article: cleanArticle,
                            name: cleanString(name) || '',
                            size: cleanSize,
                            warehouse: cleanWarehouse,
                            date: parsedDate,
                            quantity: quantity,
                            source: 'stock_daily',
                            importDate: new Date().toISOString()
                        });
                    }
                }
                return;
            }

            // ============================================================
            // ПАРСИНГ ТЕКУЩИХ ОСТАТКОВ (STOCK_CURRENT)
            // ============================================================
            if (type === ImportTypes.STOCK_CURRENT) {
                const article = findValue(row, ['Артикул продавца', 'Артикул', 'article']);
                const size = findValue(row, ['Размер вещи', 'Размер', 'size']);
                const inTransitTo = findValue(row, ['В пути до получателей']);
                const inTransitFrom = findValue(row, ['В пути возвраты на склад WB', 'В пути возвраты']);
                const total = findValue(row, ['Всего находится на складах', 'Всего на складах', 'Итого на складах']);
                
                if (!article) {
                    errors.push({ row: rowNum, errors: ['Артикул продавца не найден'] });
                    return;
                }
                
                if (!size) {
                    errors.push({ row: rowNum, errors: ['Размер не найден'] });
                    return;
                }
                
                const totalValue = total ? parseNumber(total) : 0;
                
                const knownColumns = ['Артикул продавца', 'Размер вещи', 'В пути до получателей', 
                                      'В пути возвраты на склад WB', 'Всего находится на складах'];
                const warehouseColumns = Object.keys(row).filter(key => {
                    if (knownColumns.includes(key)) return false;
                    const val = row[key];
                    if (val === null || val === undefined || val === '') return false;
                    return true;
                });
                
                if (warehouseColumns.length === 0) {
                    return;
                }
                
                const cleanArticle = cleanString(article);
                const cleanSize = cleanString(size);
                const articleKey = createArticleKey(cleanArticle, cleanSize);
                
                const baseRecord = {
                    articleKey,
                    productId: articleKey,
                    article: cleanArticle,
                    size: cleanSize,
                    inTransitTo: parseNumber(inTransitTo),
                    inTransitFrom: parseNumber(inTransitFrom),
                    total: totalValue,
                    date: new Date().toISOString().split('T')[0],
                    source: 'stock_current',
                    importDate: new Date().toISOString()
                };
                
                for (const warehouse of warehouseColumns) {
                    const quantity = parseNumber(row[warehouse]);
                    records.push({
                        ...baseRecord,
                        warehouse: cleanString(warehouse),
                        quantity: quantity
                    });
                }
                return;
            }

            // ============================================================
            // ПАРСИНГ ЦЕН И СКИДОК (PRICES)
            // ============================================================
            if (type === ImportTypes.PRICES) {
                const article = findValue(row, ['Артикул продавца', 'Артикул', 'article']);
                const price = findValue(row, ['Текущая цена', 'Цена', 'price']);
                const discount = findValue(row, ['Текущая скидка', 'Скидка', 'discount']);
                const priceWithDiscount = findValue(row, ['Цена со скидкой', 'Цена со скидкой, руб.']);
                
                if (!article) {
                    errors.push({ row: rowNum, errors: ['Артикул продавца не найден'] });
                    return;
                }
                
                if (!price) {
                    errors.push({ row: rowNum, errors: ['Текущая цена не найдена'] });
                    return;
                }
                
                const cleanArticle = cleanString(article);
                const priceValue = parseNumber(price);
                const discountValue = parseNumber(discount);
                const priceWithDiscountValue = priceWithDiscount ? parseNumber(priceWithDiscount) : 0;
                
                records.push({
                    article: cleanArticle,
                    price: priceValue,
                    discount: discountValue,
                    priceWithDiscount: priceWithDiscountValue,
                    importDate: new Date().toISOString(),
                    _type: 'price_record'
                });
                return;
            }

            // ============================================================
            // ПАРСИНГ МАРЖИНАЛЬНОСТИ (MARGIN)
            // ============================================================
            if (type === ImportTypes.MARGIN) {
                const article = findValue(row, ['Артикул']);
                const purchasePrice = findValue(row, ['Закупочная цена']);
                
                if (!article) {
                    errors.push({ row: rowNum, errors: ['Артикул не найден'] });
                    return;
                }
                
                if (!purchasePrice) {
                    errors.push({ row: rowNum, errors: ['Закупочная цена не найдена'] });
                    return;
                }
                
                const cleanArticle = cleanString(article);
                
                const record = {
                    article: cleanArticle,
                    stock: parseUniversalNumber(findValue(row, ['Остаток'])),
                    purchasePrice: parseUniversalNumber(purchasePrice),
                    marketPrice: parseUniversalNumber(findValue(row, ['Рыночная цена - сейчас'])),
                    clientPrice: parseUniversalNumber(findValue(row, ['Цена для клиента'])),
                    wbCommission: parseUniversalPercent(findValue(row, ['Комиссия WB'])),
                    tax: parseUniversalPercent(findValue(row, ['Налог, %'])),
                    storageCost: parseUniversalNumber(findValue(row, ['Стоимость хранения'])),
                    storageDays: parseUniversalNumber(findValue(row, ['Срок хранения'])),
                    packaging: parseUniversalNumber(findValue(row, ['Упаковка'])),
                    logistics: parseUniversalNumber(findValue(row, ['Логистика'])),
                    totalCost: parseUniversalNumber(findValue(row, ['Итого себестоимость'])),
                    profitPerUnit: parseUniversalNumber(findValue(row, ['Прибыль с 1 шт'])),
                    profitTotal: parseUniversalNumber(findValue(row, ['Прибыль итого'])),
                    revenue: parseUniversalNumber(findValue(row, ['Выручка'])),
                    investment: parseUniversalNumber(findValue(row, ['Вложения'])),
                    margin: parseUniversalPercent(findValue(row, ['Маржинальность'])),
                    volume: parseUniversalNumber(findValue(row, ['Объем'])),
                    buyoutPercent: parseUniversalPercent(findValue(row, ['% выкупа (месяц)'])),
                    importDate: new Date().toISOString()
                };
                
                records.push(record);
                return;
            }

            // ============================================================
            // ПАРСИНГ РЕКЛАМЫ (ADS) — ОБНОВЛЕННЫЙ
            // ============================================================
            if (type === ImportTypes.ADS) {
                const campaign = findValue(row, ['Кампания', 'campaign']);
                
                if (!campaign) {
                    errors.push({ row: rowNum, errors: ['Название кампании не найдено'] });
                    return;
                }
                
                // Парсинг даты с временем
                const parseDateTime = (value) => {
                    if (!value) return null;
                    const str = cleanString(value);
                    if (!str) return null;
                    const date = new Date(str);
                    return isNaN(date.getTime()) ? null : date.toISOString();
                };
                
                const record = {
                    campaign: cleanString(campaign),
                    startDate: parseDateTime(findValue(row, ['Старт', 'start'])),
                    finishDate: parseDateTime(findValue(row, ['Финиш', 'finish'])),
                    impressions: parseNumber(findValue(row, ['Показы'])),
                    frequency: parseNumber(findValue(row, ['Частота'])),
                    clicks: parseNumber(findValue(row, ['Клики'])),
                    cpc: parseNumber(findValue(row, ['CPC'])),
                    cpm: parseNumber(findValue(row, ['CPM'])),
                    ctr: parseNumber(findValue(row, ['CTR(%)', 'CTR'])),
                    duration: clean
