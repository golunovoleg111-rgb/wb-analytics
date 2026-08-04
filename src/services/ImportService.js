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
        required: ['Артикул продавца'],
        filename: 'StockFlow_Шаблон_Номенклатура.xlsx'
    },
    [ImportTypes.SALES]: {
        columns: [
            'Артикул продавца',
            'Размер',
            'Склад',
            'Дата',
            'Заказано',
            'Выкуплено',
            'Сумма заказов',
            'Возвраты'
        ],
        required: ['Артикул продавца', 'Дата', 'Заказано', 'Выкуплено', 'Сумма заказов'],
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
        '21_К_Вельвет_серый_40',
        'Костюм Вельвет',
        '40',
        '4601234567890',
        '6104.63.0000',
        '95% хлопок, 5% эластан',
        '04601234567890'
    ],
    [ImportTypes.SALES]: [
        '21_К_Вельвет_серый_40',
        '40',
        'Коледино',
        '23.07.2026',
        '5',
        '4',
        '16000',
        '0'
    ],
    [ImportTypes.STOCK]: [
        '21_К_Вельвет_серый_40',
        '40',
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

function parseArticle(article) {
    if (!article) return null;
    
    const parts = article.split('_');
    let size = null;
    let color = null;
    let baseModel = article;
    
    const lastPart = parts[parts.length - 1];
    if (lastPart && !isNaN(lastPart) && lastPart.length <= 3) {
        size = lastPart;
        baseModel = parts.slice(0, -1).join('_');
        if (parts.length >= 2) {
            const colorCandidate = parts[parts.length - 2];
            if (colorCandidate && isNaN(colorCandidate)) {
                color = colorCandidate;
                baseModel = parts.slice(0, -2).join('_');
                if (!baseModel) baseModel = parts.slice(0, -1).join('_');
            }
        }
    } else {
        if (lastPart && isNaN(lastPart)) {
            color = lastPart;
            baseModel = parts.slice(0, -1).join('_');
        }
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part && !isNaN(part) && part.length <= 3) {
                size = part;
                const beforeSize = parts.slice(0, i).join('_');
                const afterSize = parts.slice(i + 1).join('_');
                baseModel = beforeSize ? (afterSize ? beforeSize + '_' + afterSize : beforeSize) : afterSize;
                break;
            }
        }
    }
    
    if (!baseModel) baseModel = article;
    if (baseModel.endsWith('_' + size)) {
        baseModel = baseModel.slice(0, -(size.length + 1));
    }
    
    return {
        article,
        baseModel,
        color,
        size,
        parts
    };
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
        const missingColumns = expectedColumns.filter(col => !actualColumns.includes(col));

        if (missingColumns.length > 0) {
            return {
                valid: false,
                error: `Отсутствуют обязательные колонки: ${missingColumns.join(', ')}`
            };
        }

        return { valid: true };
    }

    // ============================================================
    // ПАРСИНГ И ВАЛИДАЦИЯ
    // ============================================================

    static _parseAndValidate(data, type, template) {
        const records = [];
        const errors = [];
        const required = template.required || [];

        data.forEach((row, index) => {
            const rowNum = index + 1;
            const rowErrors = [];
            const record = {};

            for (const field of required) {
                const value = String(row[field] || '').trim();
                if (!value) {
                    rowErrors.push(`Поле "${field}" пустое`);
                }
                record[field] = value;
            }

            if (rowErrors.length > 0) {
                errors.push({ row: rowNum, errors: rowErrors });
                return;
            }

            const article = String(row['Артикул продавца'] || '').trim();
            const parsed = parseArticle(article);

            let finalRecord = {};

            switch (type) {
                case ImportTypes.NOMENCLATURE: {
                    const size = String(row['Размер'] || '').trim() || (parsed ? parsed.size : '');
                    const color = (parsed ? parsed.color : '') || '';
                    const articleKey = [article, size || 'NOSIZE', color || 'NOCOLOR'].join('_');

                    finalRecord = {
                        article,
                        articleKey,
                        baseModel: parsed ? parsed.baseModel : article,
                        color: color,
                        size: size,
                        name: String(row['Название карточки'] || '').trim() || parsed?.baseModel || article,
                        barcode: String(row['Баркод'] || '').trim(),
                        tnved: String(row['ТН ВЭД'] || '').trim(),
                        fabric: String(row['Состав ткани'] || '').trim(),
                        gtin: String(row['GTIN'] || '').trim(),
                        category: '',
                        purchasePrice: 0,
                        price: 0,
                        status: 'active'
                    };
                    break;
                }

                case ImportTypes.SALES: {
                    let size = String(row['Размер'] || '').trim();
                    if (!size) {
                        const parts = article.split('_');
                        const lastPart = parts[parts.length - 1];
                        if (lastPart && !isNaN(lastPart)) {
                            size = lastPart;
                        }
                    }

                    let warehouse = String(row['Склад'] || '').trim();

                    let date = String(row['Дата'] || '').trim();
                    if (date && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                        const parts = date.split('-');
                        date = `${parts[2]}.${parts[1]}.${parts[0]}`;
                    }

                    finalRecord = {
                        article,
                        size: size || '',
                        warehouse: warehouse || '',
                        date: date || getYesterdayStr(),
                        orders: parseInt(row['Заказано']) || 0,
                        delivered: parseInt(row['Выкуплено']) || 0,
                        amount: parseFloat(String(row['Сумма заказов'] || '0').replace(',', '.').replace(/\s/g, '')) || 0,
                        returns: parseInt(row['Возвраты']) || 0
                    };
                    break;
                }

                case ImportTypes.STOCK: {
                    const size = String(row['Размер'] || '').trim() || (parsed ? parsed.size : '');
                    
                    finalRecord = {
                        article,
                        size: size || '',
                        toCustomer: parseInt(row['В пути до покупателя']) || 0,
                        fromCustomer: parseInt(row['В пути от покупателя']) || 0,
                        available: parseInt(row['Всего на складах']) || 0,
                        warehouse: String(row['Склад'] || 'Коледино').trim()
                    };
                    break;
                }

                case ImportTypes.ADS: {
                    finalRecord = {
                        campaign: String(row['Кампания'] || '').trim(),
                        type: String(row['Тип ставки'] || '').trim(),
                        wbId: String(row['ID'] || '').trim(),
                        impressions: parseInt(row['Показы']) || 0,
                        clicks: parseInt(row['Клики']) || 0,
                        cpc: parseFloat(String(row['CPC'] || '0').replace(',', '.')) || 0,
                        ctr: parseFloat(String(row['CTR'] || '0').replace(',', '.')) || 0,
                        cr: parseFloat(String(row['CR'] || '0').replace(',', '.')) || 0,
                        spent: parseFloat(String(row['Затраты'] || '0').replace(',', '.')) || 0,
                        orders_from_ad: parseInt(row['Заказанные товары, шт']) || 0
                    };
                    break;
                }

                default:
                    return;
            }

            records.push(finalRecord);
        });

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

        await Database.clear(storeName);
        for (const record of records) {
            await Database.save(storeName, {
                id: Date.now().toString(36) + Math.random().toString(36).substring(2),
                ...record,
                importDate: new Date().toISOString()
            });
        }

        return records;
    }

    // ============================================================
    // ЭКСПОРТ ШАБЛОНА В EXCEL
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
