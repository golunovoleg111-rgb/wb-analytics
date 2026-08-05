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
    STOCK: 'stock',
    ADS: 'ads'
};

// ============================================================
// ШАБЛОНЫ КОЛОНОК
// ============================================================

const TEMPLATES = {
    [ImportTypes.NOMENCLATURE]: {
        columns: [
            'Артикул продавца',
            'Название карточки',
            'Размер',
            'Баркод',
            'ТН ВЭД',
            'Состав ткани',
            'GTIN'
        ],
        required: ['Артикул продавца', 'Название карточки', 'Размер', 'Баркод'],
        filename: 'StockFlow_Шаблон_Номенклатура.xlsx'
    },
    [ImportTypes.SALES]: {
        columns: [
            'День',
            'Артикул продавца',
            'Выкупили, шт.',
            'К перечислению за товар, руб.',
            'Заказано, шт.',
            'Сумма заказов минус комиссия WB, руб.'
        ],
        required: ['День', 'Артикул продавца', 'Выкупили, шт.', 'Заказано, шт.', 'К перечислению за товар, руб.'],
        filename: 'StockFlow_Шаблон_Продажи.xlsx'
    },
    [ImportTypes.STOCK]: {
        columns: [
            'Артикул продавца',
            'Размер',
            'В пути до покупателя',
            'В пути от покупателя',
            'Всего на складах',
            'Склад'
        ],
        required: ['Артикул продавца', 'Всего на складах', 'Склад'],
        filename: 'StockFlow_Шаблон_Остатки.xlsx'
    },
    [ImportTypes.ADS]: {
        columns: [
            'Кампания',
            'Тип ставки',
            'ID',
            'Показы',
            'Клики',
            'CPC',
            'CTR',
            'CR',
            'Затраты',
            'Заказанные товары, шт'
        ],
        required: ['Кампания', 'Затраты', 'Заказанные товары, шт'],
        filename: 'StockFlow_Шаблон_Реклама.xlsx'
    }
};

// ============================================================
// ПРИМЕРЫ ДЛЯ ШАБЛОНОВ
// ============================================================

const EXAMPLES = {
    [ImportTypes.NOMENCLATURE]: [
        '210_Комбез_графит_42',
        'Комбез графит',
        '42',
        '4601234567890',
        '6104.63.0000',
        '95% хлопок, 5% эластан',
        '04601234567890'
    ],
    [ImportTypes.SALES]: [
        '01.05.2026',
        '210_Комбез_графит',
        '3',
        '6740,03',
        '3',
        '7131,48'
    ],
    [ImportTypes.STOCK]: [
        '210_Комбез_графит',
        '42',
        '5',
        '2',
        '50',
        'Коледино'
    ],
    [ImportTypes.ADS]: [
        'Кампания от 06.05.2025',
        'Единая Ставка',
        '36386799',
        '12500',
        '320',
        '45.5',
        '2.56',
        '4.2',
        '14560',
        '13'
    ]
};

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

/**
 * Парсинг артикула: выделение базы, цвета, размера
 * Поддерживает форматы:
 * - 210_Комбез_графит_42
 * - 210_Комбез_графит
 * - 216_К_Замша_№1_коричневый
 * - 24_К_Велюр_розовый
 */
function parseArticle(article) {
    if (!article) {
        return { baseModel: '', color: '', size: '', full: '' };
    }

    const full = article.trim();
    let baseModel = full;
    let color = '';
    let size = '';

    // Разбиваем на части по '_'
    const parts = full.split('_');
    
    if (parts.length === 1) {
        // Простой артикул без разделителей
        return { baseModel: full, color: '', size: '', full };
    }

    // Ищем размер (число в конце или в любом месте)
    let sizeIndex = -1;
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        // Размер может быть: 42, 44, 46, 48, 50, 52, 54, 56, M, L, XL, XXL, XS, S
        if (part.match(/^\d{2,3}$/) || part.match(/^[XxSsMmLl]{1,4}$/)) {
            sizeIndex = i;
            size = part;
            break;
        }
    }

    // Если размер найден — удаляем его из частей
    const nameParts = [];
    let colorPart = '';

    for (let i = 0; i < parts.length; i++) {
        if (i === sizeIndex) continue;
        const part = parts[i].trim();
        if (!part) continue;
        
        // Проверяем, не является ли часть цветом
        const colorKeywords = ['белый', 'черный', 'серый', 'красный', 'синий', 'зеленый', 'желтый', 
                               'розовый', 'голубой', 'фиолетовый', 'оранжевый', 'коричневый', 
                               'бежевый', 'графит', 'бордовый', 'бирюзовый', 'салатовый', 
                               'лавандовый', 'графитовый', 'изумрудный', 'шоколадный', 
                               'кремовый', 'золотистый', 'серебристый', 'персиковый', 
                               'васильковый', 'лимонный', 'темный', 'светлый'];
        
        const lowerPart = part.toLowerCase();
        if (colorKeywords.some(keyword => lowerPart.includes(keyword))) {
            colorPart = part;
        } else {
            nameParts.push(part);
        }
    }

    baseModel = nameParts.join('_');
    color = colorPart;

    // Если цвет не найден, но есть что-то после базы — считаем цветом
    if (!color && nameParts.length > 1) {
        const lastPart = nameParts[nameParts.length - 1];
        if (lastPart && !lastPart.match(/^\d+$/)) {
            color = lastPart;
            nameParts.pop();
            baseModel = nameParts.join('_');
        }
    }

    // Если база пустая — используем полный артикул без размера
    if (!baseModel) {
        baseModel = full.replace('_' + size, '');
        if (baseModel.endsWith('_')) {
            baseModel = baseModel.slice(0, -1);
        }
    }

    return {
        baseModel: baseModel || full,
        color: color,
        size: size,
        full: full
    };
}

/**
 * Универсальный парсинг даты
 * Поддерживает: DD.MM.YYYY, MM.DD.YYYY, YYYY.MM.DD, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
 */
function parseDateUniversal(dateStr) {
    if (!dateStr) return null;
    
    const str = dateStr.toString().trim();
    
    // Если уже YYYY-MM-DD
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return str;
    }
    
    // Определяем разделитель
    const separators = ['.', '/', '-'];
    let separator = null;
    let parts = null;
    
    for (const sep of separators) {
        const split = str.split(sep);
        if (split.length === 3) {
            separator = sep;
            parts = split.map(p => p.trim());
            break;
        }
    }
    
    if (!parts) {
        // Пробуем через Date
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return null;
    }
    
    // Определяем формат
    let day, month, year;
    const p1 = parseInt(parts[0]);
    const p2 = parseInt(parts[1]);
    const p3 = parseInt(parts[2]);
    
    // Определяем, что есть что
    if (p3 >= 1900 && p3 <= 2100) {
        // Год в конце — DD.MM.YYYY или MM.DD.YYYY
        year = p3;
        if (p1 <= 12 && p2 <= 31) {
            // MM.DD.YYYY
            month = p1;
            day = p2;
        } else {
            // DD.MM.YYYY
            day = p1;
            month = p2;
        }
    } else if (p1 >= 1900 && p1 <= 2100) {
        // Год в начале — YYYY.MM.DD
        year = p1;
        month = p2;
        day = p3;
    } else {
        // Непонятный формат — пробуем через Date
        const date = new Date(str);
        if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        return null;
    }
    
    // Проверяем валидность
    if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
        return null;
    }
    
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Преобразование числа с запятой как разделитель
 */
function parseNumberFromWB(value) {
    if (value === null || value === undefined || value === '') return 0;
    const str = value.toString().trim().replace(/\s/g, '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

/**
 * Создание уникального ключа товара
 */
function createArticleKey(article, size = 'NOSIZE', color = 'NOCOLOR') {
    return `${article}|${size}|${color}`.toLowerCase().trim();
}

// ============================================================
// ОСНОВНОЙ КЛАСС ImportService
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
            console.log('📋 Фактические колонки в файле:', Object.keys(data[0]));
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
        
        // Проверяем наличие обязательных колонок
        const missing = required.filter(col => !actualColumns.includes(col));
        
        if (missing.length > 0) {
            return {
                valid: false,
                error: `Отсутствуют обязательные колонки: ${missing.join(', ')}`
            };
        }

        return { valid: true };
    }

    static _findValueInRow(row, possibleKeys) {
        for (const key of possibleKeys) {
            if (row && row.hasOwnProperty(key)) {
                const value = row[key];
                if (value !== null && value !== undefined && value !== '') {
                    return value;
                }
            }
        }
        return null;
    }

    static _parseAndValidate(data, type, template) {
        const records = [];
        const errors = [];
        const required = template.required || [];

        data.forEach((row, index) => {
            const rowNum = index + 1;
            const rowErrors = [];

            if (!row || typeof row !== 'object') {
                errors.push({ row: rowNum, errors: ['Строка пуста или не является объектом'] });
                return;
            }

            // ============================================================
            // ПАРСИНГ НОМЕНКЛАТУРЫ (ОБНОВЛЕН)
            // ============================================================
            if (type === ImportTypes.NOMENCLATURE) {
                const article = String(row['Артикул продавца'] || '').trim();
                const name = String(row['Название карточки'] || '').trim();
                const sizeFromCol = String(row['Размер'] || '').trim();
                const barcode = String(row['Баркод'] || '').trim();
                const tnved = String(row['ТН ВЭД'] || '').trim();
                const fabric = String(row['Состав ткани'] || '').trim();
                const gtin = String(row['GTIN'] || '').trim();

                // Проверяем обязательные поля
                if (!article) {
                    rowErrors.push('Артикул продавца пуст');
                }
                if (!name) {
                    rowErrors.push('Название карточки пусто');
                }
                if (!sizeFromCol) {
                    rowErrors.push('Размер пуст');
                }
                if (!barcode) {
                    rowErrors.push('Баркод пуст');
                }

                if (rowErrors.length > 0) {
                    errors.push({ row: rowNum, errors: rowErrors });
                    return;
                }

                // Парсим артикул для извлечения базы, цвета и размера
                const parsed = parseArticle(article);
                
                // Приоритет: размер из колонки > размер из артикула
                const finalSize = sizeFromCol || parsed.size || 'NOSIZE';
                const finalColor = parsed.color || '';
                const baseModel = parsed.baseModel || article;
                
                // Название: из колонки > из артикула
                const finalName = name || baseModel || article;
                
                const articleKey = createArticleKey(article, finalSize, finalColor);

                const record = {
                    article,
                    articleKey,
                    baseModel: baseModel,
                    color: finalColor,
                    size: finalSize,
                    name: finalName,
                    barcode: barcode,
                    tnved: tnved || '',
                    fabric: fabric || '',
                    gtin: gtin || '',
                    category: '',
                    purchasePrice: 0,
                    price: 0,
                    status: 'active'
                };

                records.push(record);
                return;
            }

            // ============================================================
            // ПАРСИНГ ПРОДАЖ (ОБНОВЛЕН)
            // ============================================================
            if (type === ImportTypes.SALES) {
                const article = this._findValueInRow(row, [
                    'Артикул продавца',
                    'Артикул',
                    'article'
                ]);

                const dateStr = this._findValueInRow(row, [
                    'День',
                    'Дата',
                    'Date',
                    'Дата заказа'
                ]);

                const redeemed = this._findValueInRow(row, [
                    'Выкупили, шт.',
                    'Выкупили шт.',
                    'Выкупили',
                    'Выкуплено, шт.',
                    'Выкуплено'
                ]);

                const amount = this._findValueInRow(row, [
                    'К перечислению за товар, руб.',
                    'К перечислению за товар руб.',
                    'К перечислению за товар',
                    'Сумма выкупа'
                ]);

                const orders = this._findValueInRow(row, [
                    'Заказано, шт.',
                    'Заказано шт.',
                    'Заказано',
                    'Количество заказов'
                ]);

                const totalAmount = this._findValueInRow(row, [
                    'Сумма заказов минус комиссия WB, руб.',
                    'Сумма заказов минус комиссия WB руб.',
                    'Сумма заказов минус комиссия WB',
                    'Сумма заказов'
                ]);

                // Проверяем обязательные поля
                if (!article) {
                    rowErrors.push('Артикул продавца не найден');
                }
                if (!dateStr) {
                    rowErrors.push('Дата (День) не найдена');
                }
                if (!redeemed || redeemed === '') {
                    rowErrors.push('Выкупили, шт. не найдено');
                }
                if (!orders || orders === '') {
                    rowErrors.push('Заказано, шт. не найдено');
                }
                if (!amount || amount === '') {
                    rowErrors.push('К перечислению за товар, руб. не найдено');
                }

                if (rowErrors.length > 0) {
                    errors.push({ row: rowNum, errors: rowErrors });
                    return;
                }

                // Универсальный парсинг даты
                const parsedDate = parseDateUniversal(dateStr);
                if (!parsedDate) {
                    errors.push({ row: rowNum, errors: [`Некорректная дата: "${dateStr}"`] });
                    return;
                }

                // Обрезаем артикул от пробелов
                const cleanArticle = article.toString().trim();
                const articleKey = createArticleKey(cleanArticle);

                const record = {
                    articleKey,
                    productId: articleKey,
                    article: cleanArticle,
                    size: 'NOSIZE',
                    warehouse: 'Не указан',
                    date: parsedDate,
                    orders: parseNumberFromWB(orders),
                    redeemed: parseNumberFromWB(redeemed),
                    delivered: parseNumberFromWB(redeemed),
                    amount: parseNumberFromWB(amount),
                    totalAmount: parseNumberFromWB(totalAmount || amount),
                    returns: 0,
                    fileName: row._fileName || '',
                    importDate: new Date().toISOString()
                };

                records.push(record);
                return;
            }

            // ============================================================
            // ПАРСИНГ ОСТАТКОВ
            // ============================================================
            if (type === ImportTypes.STOCK) {
                const article = String(row['Артикул продавца'] || '').trim();
                const size = String(row['Размер'] || '').trim();
                const articleKey = createArticleKey(article, size || 'NOSIZE');

                if (!article) {
                    errors.push({ row: rowNum, errors: ['Артикул продавца пуст'] });
                    return;
                }

                const record = {
                    productId: articleKey,
                    article,
                    size: size || 'NOSIZE',
                    articleKey,
                    toCustomer: parseNumberFromWB(row['В пути до покупателя']),
                    fromCustomer: parseNumberFromWB(row['В пути от покупателя']),
                    available: parseNumberFromWB(row['Всего на складах']),
                    warehouse: String(row['Склад'] || 'Коледино').trim(),
                    date: new Date().toISOString().split('T')[0]
                };

                records.push(record);
                return;
            }

            // ============================================================
            // ПАРСИНГ РЕКЛАМЫ
            // ============================================================
            if (type === ImportTypes.ADS) {
                const record = {
                    campaign: String(row['Кампания'] || '').trim(),
                    type: String(row['Тип ставки'] || '').trim(),
                    wbId: String(row['ID'] || '').trim(),
                    impressions: parseNumberFromWB(row['Показы']),
                    clicks: parseNumberFromWB(row['Клики']),
                    cpc: parseNumberFromWB(row['CPC']),
                    ctr: parseNumberFromWB(row['CTR']),
                    cr: parseNumberFromWB(row['CR']),
                    spent: parseNumberFromWB(row['Затраты']),
                    orders_from_ad: parseNumberFromWB(row['Заказанные товары, шт'])
                };

                records.push(record);
                return;
            }
        });

       console.log(`📊 Итоги парсинга: всего ${data.length} строк, валидных ${records.length}, ошибок ${errors.length}`);

// ВЫВОДИМ ПЕРВЫЕ 20 ОШИБОК ДЛЯ ДИАГНОСТИКИ
if (errors.length > 0) {
    console.log('🔴 ПРИМЕРЫ ОШИБОК (первые 20):');
    errors.slice(0, 20).forEach(err => {
        console.log(`  Строка ${err.row}: ${err.errors.join(', ')}`);
    });
}
        return {
            success: errors.length === 0,
            records,
            errors,
            total: data.length,
            valid: records.length,
            invalid: errors.length
        };
    }

    static async _saveData(records, type) {
        const storeMap = {
            [ImportTypes.NOMENCLATURE]: 'products',
            [ImportTypes.SALES]: 'sales',
            [ImportTypes.STOCK]: 'stock',
            [ImportTypes.ADS]: 'ads'
        };

        const storeName = storeMap[type];
        if (!storeName) {
            throw new Error(`Неизвестное хранилище для типа: ${type}`);
        }

        if (type === ImportTypes.NOMENCLATURE) {
            const existingProducts = await Database.getAll(Database.STORES.PRODUCTS);
            const existingKeys = new Set(existingProducts.map(p => p.articleKey));

            let added = 0;
            let skipped = 0;

            for (const record of records) {
                if (existingKeys.has(record.articleKey)) {
                    skipped++;
                    continue;
                }
                await Database.save(Database.STORES.PRODUCTS, {
                    id: Date.now().toString(36) + Math.random().toString(36).substring(2),
                    ...record,
                    importDate: new Date().toISOString()
                });
                added++;
            }

            console.log(`[ImportService] Номенклатура: добавлено ${added}, пропущено дубликатов: ${skipped}`);
            return records.filter(r => !existingKeys.has(r.articleKey));
        }

        await Database.clear(storeName);
        for (const record of records) {
            await Database.save(storeName, {
                id: Date.now().toString(36) + Math.random().toString(36).substring(2),
                ...record,
                importDate: new Date().toISOString()
            });
        }

        console.log(`[ImportService] ${type}: сохранено ${records.length} записей`);
        return records;
    }

    static downloadTemplate(type) {
        const template = TEMPLATES[type];
        if (!template) {
            console.error(`Неизвестный тип: ${type}`);
            return;
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([template.columns]);

        if (EXAMPLES[type]) {
            XLSX.utils.sheet_add_aoa(ws, [EXAMPLES[type]], { origin: 'A2' });
        }

        ws['!cols'] = template.columns.map(() => ({ wch: 22 }));
        XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
        XLSX.writeFile(wb, template.filename);
    }
}

export default ImportService;
