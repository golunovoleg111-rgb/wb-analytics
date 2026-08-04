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
// ШАБЛОНЫ КОЛОНОК (ЖЁСТКИЕ)
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
// ПАРСИНГ АРТИКУЛА
// ============================================================

function parseArticle(article) {
    if (!article) return null;
    
    const parts = article.split('_');
    let size = null;
    let color = null;
    let baseModel = article;
    
    // Проверяем последнюю часть —可能是 размер
    const lastPart = parts[parts.length - 1];
    if (lastPart && !isNaN(lastPart) && lastPart.length <= 3) {
        size = lastPart;
        baseModel = parts.slice(0, -1).join('_');
        // Цвет — предпоследняя часть
        if (parts.length >= 2) {
            const colorCandidate = parts[parts.length - 2];
            if (colorCandidate && isNaN(colorCandidate)) {
                color = colorCandidate;
                // Базовая модель — всё до цвета
                baseModel = parts.slice(0, -2).join('_');
                if (!baseModel) baseModel = parts.slice(0, -1).join('_');
            }
        }
    } else {
        // Если последняя часть не число — возможно, это цвет
        if (lastPart && isNaN(lastPart)) {
            color = lastPart;
            baseModel = parts.slice(0, -1).join('_');
        }
        // Проверяем, есть ли размер в других частях
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (part && !isNaN(part) && part.length <= 3) {
                size = part;
                // Удаляем размер из базовой модели
                const beforeSize = parts.slice(0, i).join('_');
                const afterSize = parts.slice(i + 1).join('_');
                baseModel = beforeSize ? (afterSize ? beforeSize + '_' + afterSize : beforeSize) : afterSize;
                break;
            }
        }
    }
    
    // Если базовая модель пустая, используем артикул
    if (!baseModel) baseModel = article;
    
    // Убираем размер из конца базовой модели, если он там остался
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

        // 1. Проверяем тип
        if (!TEMPLATES[type]) {
            return { success: false, error: `Неизвестный тип импорта: ${type}` };
        }

        // 2. Проверяем формат файла
        const validExtensions = ['.xlsx', '.xls', '.csv'];
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!validExtensions.includes(ext)) {
            return { success: false, error: 'Неверный формат файла. Поддерживаются XLSX, XLS, CSV.' };
        }

        // 3. Читаем файл
        let data;
        try {
            data = await this._readFile(file);
        } catch (err) {
            return { success: false, error: `Ошибка чтения файла: ${err.message}` };
        }

        // 4. Проверяем колонки
        const template = TEMPLATES[type];
        const columnCheck = this._validateColumns(data, template.columns);
        if (!columnCheck.valid) {
            return { success: false, error: columnCheck.error };
        }

        // 5. Парсим и валидируем данные
        const result = this._parseAndValidate(data, type, template);

        // 6. Сохраняем в БД
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

            // Проверяем обязательные поля
            for (const field of required) {
                const value = String(row[field] || '').trim();
                if (!value) {
                    rowErrors.push(`Поле "${field}" пустое`);
                }
                record[field] = value;
            }

            // Если есть ошибки — пропускаем строку
            if (rowErrors.length > 0) {
                errors.push({ row: rowNum, errors: rowErrors });
                return;
            }

            // Парсим артикул
            const article = String(row['Артикул продавца'] || '').trim();
            const parsed = parseArticle(article);

            // Собираем запись в зависимости от типа
            let finalRecord = {};

            switch (type) {
                case ImportTypes.NOMENCLATURE:
                    finalRecord = {
                        article,
                        baseModel: parsed ? parsed.baseModel : article,
                        color: parsed ? parsed.color : null,
                        size: parsed ? parsed.size : null,
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

                case ImportTypes.SALES:
                    finalRecord = {
                        article,
                        date: String(row['Дата'] || '').trim(),
                        orders: parseInt(row['Заказано']) || 0,
                        delivered: parseInt(row['Выкуплено']) || 0,
                        amount: parseFloat(String(row['Сумма заказов'] || '0').replace(',', '.').replace(/\s/g, '')) || 0,
                        returns: parseInt(row['Возвраты']) || 0
                    };
                    break;

                case ImportTypes.STOCK:
                    finalRecord = {
                        article,
                        size: String(row['Размер'] || '').trim() || (parsed ? parsed.size : null),
                        toCustomer: parseInt(row['В пути до покупателя']) || 0,
                        fromCustomer: parseInt(row['В пути от покупателя']) || 0,
                        available: parseInt(row['Всего на складах']) || 0,
                        warehouse: String(row['Склад'] || 'Коледино').trim()
                    };
                    break;

                case ImportTypes.ADS:
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

        // Очищаем хранилище перед импортом
        await Database.clear(storeName);

        // Сохраняем записи
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

        // Добавляем пример данных
        const examples = {
            [ImportTypes.NOMENCLATURE]: ['21_К_Вельвет_серый_40', 'Костюм Вельвет', '40', '4601234567890', '6104.63.0000', '95% хлопок, 5% эластан', '04601234567890'],
            [ImportTypes.SALES]: ['21_К_Вельвет_серый_40', '23.07.2026', '5', '4', '16000', '0'],
            [ImportTypes.STOCK]: ['21_К_Вельвет_серый_40', '40', '5', '2', '50', 'Коледино'],
            [ImportTypes.ADS]: ['Кампания от 06.05.2025', 'Единая Ставка', '36386799', '12500', '320', '45.5', '2.56', '4.2', '14560', '13']
        };

        if (examples[type]) {
            XLSX.utils.sheet_add_aoa(ws, [examples[type]], { origin: 'A2' });
        }

        ws['!cols'] = template.columns.map(() => ({ wch: 22 }));
        XLSX.utils.book_append_sheet(wb, ws, 'Шаблон');
        XLSX.writeFile(wb, template.filename);
    }
}

// ============================================================
// ЭКСПОРТ
// ============================================================

export default ImportService;
