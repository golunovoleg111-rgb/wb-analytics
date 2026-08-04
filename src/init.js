// ============================================================
// INIT — ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ
// Загрузка тестовых данных и проверка архитектуры
// ============================================================

import ProductService from './services/ProductService.js';

// ============================================================
// ТЕСТОВЫЕ ДАННЫЕ
// ============================================================

const TEST_PRODUCTS = [
    {
        article: '21_К_Вельвет_голубой_40',
        baseArticle: '21_К_Вельвет',
        category: 'Костюмы',
        color: 'голубой',
        size: '40',
        barcode: '4601234567890'
    },
    {
        article: '27_К_Платье_чёрный_44',
        baseArticle: '27_К_Платье',
        category: 'Платья',
        color: 'чёрный',
        size: '44',
        barcode: '4601234567891'
    },
    {
        article: '33_К_Жакет_синий_48',
        baseArticle: '33_К_Жакет',
        category: 'Жакеты',
        color: 'синий',
        size: '48',
        barcode: '4601234567892'
    },
    {
        article: '41_К_Брюки_серый_42',
        baseArticle: '41_К_Брюки',
        category: 'Брюки',
        color: 'серый',
        size: '42',
        barcode: '4601234567893'
    },
    {
        article: '15_К_Свитер_бежевый_46',
        baseArticle: '15_К_Свитер',
        category: 'Свитеры',
        color: 'бежевый',
        size: '46',
        barcode: '4601234567894'
    }
];

// ============================================================
// ЗАГРУЗКА ТЕСТОВЫХ ДАННЫХ
// ============================================================

async function loadTestProducts() {
    console.log('🔄 Загрузка тестовых товаров...');
    
    const existing = await ProductService.getActive();
    
    if (existing.length > 0) {
        console.log(`📦 В базе уже есть ${existing.length} товаров. Пропускаем загрузку тестовых.`);
        return existing;
    }
    
    const results = await ProductService.createManyFromImport(TEST_PRODUCTS);
    
    console.log(`✅ Загружено ${results.results.length} товаров`);
    
    if (results.errors.length > 0) {
        console.warn('⚠️ Ошибки при загрузке:', results.errors);
    }
    
    return results.results;
}

// ============================================================
// ПРОВЕРКА АРХИТЕКТУРЫ
// ============================================================

async function checkArchitecture() {
    console.log('🔍 Проверка архитектуры...');
    
    try {
        const products = await ProductService.getAll();
        console.log(`📦 Всего товаров: ${products.length}`);
        
        const active = await ProductService.getActive();
        console.log(`📦 Активных товаров: ${active.length}`);
        
        const archived = await ProductService.getArchived();
        console.log(`📦 Архивных товаров: ${archived.length}`);
        
        if (products.length > 0) {
            const searchResult = await ProductService.search('Вельвет');
            console.log(`🔍 Поиск "Вельвет": найдено ${searchResult.length} товаров`);
        }
        
        console.log('✅ Архитектура работает корректно');
        return true;
    } catch (error) {
        console.error('❌ Ошибка при проверке архитектуры:', error.message);
        return false;
    }
}

// ============================================================
// ЗАПУСК
// ============================================================

async function init() {
    console.log('🚀 Запуск StockFlow v5.0 (новая архитектура)');
    console.log('📦 ProductService:', ProductService);
    
    await loadTestProducts();
    await checkArchitecture();
    
    console.log('✅ Инициализация завершена');
}

// ============================================================
// ЗАПУСКАЕМ АВТОМАТИЧЕСКИ
// ============================================================

init();

export { loadTestProducts, checkArchitecture };
