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
// ШАБЛОНЫ КОЛОНОК (ОБНОВЛЕНЫ)
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
        required: ['Артикул продавца'],
        filename: 'StockFlow_Шаблон_Номенклатура.xlsx'
    },
    [ImportTypes.SALES]: {
        // ✅ НОВЫЙ ШАБЛОН — под "Динамику продаж"
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
// ПРИМЕРЫ ДЛЯ ШАБЛОНОВ (ОБНОВЛЕНЫ)
// ============================================================

const EXAMPLES = {
    [ImportTypes.NOMENCLATURE]: [
        '210_Комбез_графит',
        'Комбез графит',
        '42',
        '4601234567890',
        '6104.63.0000',
        '95% хлопок, 5% эластан',
        '04601234567890'
    ],
    [ImportTypes.SALES]: [
        // ✅ НОВЫЙ ПРИМЕР — под "Динамику продаж"
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

function getYesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return String(d.getDate()).padStart(2, '0') + '.' +
           String(d.getMonth() + 1).padStart(2, '0') + '.' +
           d.getFullYear();
}

/**
 * Парсинг даты из формата DD.MM.YYYY → YYYY-MM-DD
 */
function parseDateFromWB(dateStr) {
    if (!dateStr) return null;
    
    const str = dateStr.toString().trim();
    
    // Формат DD.MM.YYYY
    const match = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
        const day = match[1];
        const month = match[2];
        const year = match[3];
        return `${year}-${month}-${day}`;
    }
    
    // Формат YYYY-MM-DD (уже правильный)
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
        return str;
    }
    
    // Пробуем через Date (запасной вариант)
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    return null;
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
 * Создание уникального ключа товара (артикул + размер + цвет)
 * Для продаж размер не известен → используем NOSIZE
 */
function createArticleKey(article, size = 'NOSIZE', color = 'NOCOLOR') {
    return `${article}|${size}|${color}`.toLowerCase().trim();
}

// ============================================================
// ОСНОВНОЙ КЛАСС ImportService
// ============================================================

class ImportService {
    
    // ============================================================
    // ПОЛУЧИТЬ ШАБЛОН
    // ============================================================

    static getTemplate(type) {
        return TEMPLATES[type] || null;
    }

    // ============================================================
    // ОБРАБОТКА ФАЙЛА
    // ============================================================

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

        // 🔍 ДИАГНОСТИКА: выводим структуру файла
        if (data && data.length > 0) {
            console.log('📋 Фактические колонки в файле:', Object.keys(data[0]));
            console.log('📋 Первая строка данных:', data[0]);
        }

        const template = TEMPLATES[type];
        const columnCheck = this._validateColumns(data, template.columns);
        if (!columnCheck.valid) {
            return { success: false, error: columnCheck.error };
        }

        const result = this._parseAndValidate(data, type, template);

        if (result.records.length > 0) {
            await this._saveData(result.records, type);
        }

        return result;
    }

    // ============================================================
    // ЧТЕНИЕ ФАЙЛА
    // ============================================================

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

    // ============================================================
    // ПРОВЕРКА КОЛОНОК
    // ============================================================

    static _validateColumns(data, expectedColumns) {
        if (!data || data.length === 0) {
            return { valid: false, error: 'Файл пуст' };
        }

        const actualColumns = Object.keys(data[0]);
        
        // 🔍 ДИАГНОСТИКА
        console.log('📋 Ожидаемые колонки:', expectedColumns);

        // Проверяем, что есть хотя бы основные колонки
        const required = ['Артикул продавца', 'День', 'Выкупили', 'Заказано'];
        const found = required.filter(col => 
            actualColumns.some(actual => actual.includes(col) || col.includes(actual))
        );

        if (found.length < 2) {
            return {
                valid: false,
                error: `Не найдены обязательные колонки. Фактические колонки: ${actualColumns.join(', ')}`
            };
        }

        return { valid: true };
    }

    // ============================================================
    // ПОИСК ЗНАЧЕНИЯ ПО НЕСКОЛЬКИМ КЛЮЧАМ
    // ============================================================

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

    // ============================================================
    // ПАРСИНГ И ВАЛИДАЦИЯ (ОБНОВЛЕН)
    // ============================================================

    static _parseAndValidate(data, type, template) {
        const records = [];
        const errors = [];
        const required = template.required || [];

        data.forEach((row, index) => {
            const rowNum = index + 1;
            const rowErrors = [];

            // Проверяем, что row не пустой
            if (!row || typeof row !== 'object') {
                errors.push({ row: rowNum, errors: ['Строка пуста или не является объектом'] });
                return;
            }

            // ============================================================
            // ПАРСИНГ ПРОДАЖ (НОВАЯ ВЕРСИЯ)
            // ============================================================
            if (type === ImportTypes.SALES) {
                // Гибкий поиск колонок
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

                // 🔍 ДИАГНОСТИКА
                if (index === 0) {
                    console.log('🔍 Найденные значения в первой строке:', {
                        article,
                        dateStr,
                        redeemed,
                        amount,
                        orders,
                        totalAmount
                    });
                }

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

                const parsedDate = parseDateFromWB(dateStr);
                if (!parsedDate) {
                    errors.push({ row: rowNum, errors: [`Некорректная дата: "${dateStr}"`] });
                    return;
                }

                // Создаём articleKey без размера
                const articleKey = createArticleKey(article);

                const record = {
                    articleKey,
                    productId: articleKey,
                    article: article,
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
            // ПАРСИНГ НОМЕНКЛАТУРЫ
            // ============================================================
            if (type === ImportTypes.NOMENCLATURE) {
                const article = String(row['Артикул продавца'] || '').trim();
                const size = String(row['Размер'] || '').trim();
                const color = ''; // в шаблоне пока нет цвета
                const articleKey = createArticleKey(article, size || 'NOSIZE', color || 'NOCOLOR');

                if (!article) {
                    errors.push({ row: rowNum, errors: ['Артикул продавца пуст'] });
                    return;
                }

                const record = {
                    article,
                    articleKey,
                    baseModel: article,
                    color: color,
                    size: size || 'NOSIZE',
                    name: String(row['Название карточки'] || '').trim() || article,
                    barcode: String(row['Баркод'] || '').trim(),
                    tnved: String(row['ТН ВЭД'] || '').trim(),
                    fabric: String(row['Состав ткани'] || '').trim(),
                    gtin: String(row['GTIN'] || '').trim(),
                    category: '',
                    purchasePrice: 0,
                    price: 0,
                    status: 'active'
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

        // 🔍 ДИАГНОСТИКА: итоги
        console.log(`📊 Итоги парсинга: всего ${data.length} строк, валидных ${records.length}, ошибок ${errors.length}`);

        return {
            success: errors.length === 0,
            records,
            errors,
            total: data.length,
            valid: records.length,
            invalid: errors.length
        };
    }

    // ============================================================
    // СОХРАНЕНИЕ В БАЗУ
    // ============================================================

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

        // Для остальных типов — очищаем и загружаем заново
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

    // ============================================================
    // ЭКСПОРТ ШАБЛОНА В EXCEL (ОБНОВЛЕН)
    // ============================================================

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
