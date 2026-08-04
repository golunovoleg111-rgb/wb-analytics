// ============================================================
// INIT — ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ
// ============================================================

import ProductService from './services/ProductService.js';
import SalesService from './services/SalesService.js';
import StockService from './services/StockService.js';
import SupplyService from './services/SupplyService.js';

// ============================================================
// ПРОВЕРКА АРХИТЕКТУРЫ
// ============================================================

async function checkArchitecture() {
    console.log('🔍 Проверка архитектуры...');
    
    try {
        const products = await ProductService.getAll();
        console.log(`📦 Товаров в базе: ${products.length}`);
        
        const sales = await SalesService.getAllAggregated(30);
        console.log(`📊 Продаж: ${Object.keys(sales).length} товаров с продажами`);
        
        const stock = await StockService.getAllAggregated();
        console.log(`📦 Остатков: ${Object.keys(stock).length} товаров с остатками`);
        
        const recommendations = await SupplyService.calculateRecommendations();
        console.log(`📋 Рекомендаций по закупкам: ${recommendations.length}`);
        
        console.log('✅ Архитектура работает корректно');
        console.log('ℹ️ Данные отсутствуют. Импортируйте отчёты WB.');
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
    console.log('ℹ️ Система готова к импорту данных');
    
    await checkArchitecture();
    
    console.log('✅ Инициализация завершена');
}

init();

export { checkArchitecture };
