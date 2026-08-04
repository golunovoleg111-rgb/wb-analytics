// ============================================================
// INIT — ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ
// ============================================================

import ProductService from './services/ProductService.js';
import SalesService from './services/SalesService.js';

// ============================================================
// ТЕСТОВЫЕ ТОВАРЫ
// ============================================================

const TEST_PRODUCTS = [
    { article: '21_К_Вельвет_голубой_40', baseArticle: '21_К_Вельвет', category: 'Костюмы', color: 'голубой', size: '40', barcode: '4601234567890' },
    { article: '27_К_Платье_чёрный_44', baseArticle: '27_К_Платье', category: 'Платья', color: 'чёрный', size: '44', barcode: '4601234567891' },
    { article: '33_К_Жакет_синий_48', baseArticle: '33_К_Жакет', category: 'Жакеты', color: 'синий', size: '48', barcode: '4601234567892' },
    { article: '41_К_Брюки_серый_42', baseArticle: '41_К_Брюки', category: 'Брюки', color: 'серый', size: '42', barcode: '4601234567893' },
    { article: '15_К_Свитер_бежевый_46', baseArticle: '15_К_Свитер', category: 'Свитеры', color: 'бежевый', size: '46', barcode: '4601234567894' }
];

// ============================================================
// ТЕСТОВЫЕ ПРОДАЖИ
// ============================================================

function generateTestSales(products) {
    const sales = [];
    const today = new Date();
    const priceMap = {
        '21_К_Вельвет_голубой_40': 3200,
        '27_К_Платье_чёрный_44': 2100,
        '33_К_Жакет_синий_48': 4500,
        '41_К_Брюки_серый_42': 3800,
        '15_К_Свитер_бежевый_46': 2800
    };

    // Находим productId для каждого товара
    const productMap = {};
    products.forEach(p => {
        productMap[p.article] = p.id;
    });

    // Генерируем продажи за последние 30 дней
    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        products.forEach(product => {
            const productId = productMap[product.article];
            if (!productId) return;

            // Случайные продажи (0-5 в день)
            const orders = Math.floor(Math.random() * 5);
            if (orders === 0) return;

            const delivered = Math.floor(orders * (0.7 + Math.random() * 0.25));
            const returns = Math.floor(orders * 0.05);
            const price = priceMap[product.article] || 3000;
            const amount = delivered * price;

            sales.push({
                productId: productId,
                date: dateStr,
                orders: orders,
                delivered: delivered,
                returns: returns,
                amount: amount
            });
        });
    }

    return sales;
}

// ============================================================
// ЗАГРУЗКА ТЕСТОВЫХ ДАННЫХ
// ============================================================

async function loadTestData() {
    console.log('🔄 Загрузка тестовых данных...');
    
    // 1. Загружаем товары
    let products = await ProductService.getActive();
    if (products.length === 0) {
        const result = await ProductService.createManyFromImport(TEST_PRODUCTS);
        products = result.results;
        console.log(`✅ Загружено ${products.length} товаров`);
    } else {
        console.log(`📦 Товаров уже есть: ${products.length}`);
    }

    // 2. Загружаем продажи
    const existingSales = await SalesService.getByProduct(products[0]?.id || '');
    if (existingSales.length === 0 && products.length > 0) {
        const salesData = generateTestSales(products);
        await SalesService.loadTestData(salesData);
        console.log(`✅ Загружено ${salesData.length} тестовых продаж`);
    } else {
        console.log('📦 Продажи уже есть, пропускаем');
    }

    return { products, sales: await SalesService.getAllAggregated() };
}

// ============================================================
// ПРОВЕРКА АРХИТЕКТУРЫ
// ============================================================

async function checkArchitecture() {
    console.log('🔍 Проверка архитектуры...');
    
    try {
        const products = await ProductService.getAll();
        console.log(`📦 Товаров: ${products.length}`);
        
        const sales = await SalesService.getAllAggregated(30);
        const totalRevenue = await SalesService.getTotalRevenue(30);
        console.log(`📊 Выручка за 30 дней: ${totalRevenue.toLocaleString()} ₽`);
        console.log(`📊 Товаров с продажами: ${Object.keys(sales).length}`);
        
        console.log('✅ Архитектура работает корректно');
        return true;
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        return false;
    }
}

// ============================================================
// ЗАПУСК
// ============================================================

async function init() {
    console.log('🚀 Запуск StockFlow v5.0 (новая архитектура)');
    
    await loadTestData();
    await checkArchitecture();
    
    console.log('✅ Инициализация завершена');
}

init();

export { loadTestData, checkArchitecture };
