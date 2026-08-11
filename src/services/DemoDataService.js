// ============================================================
// BELTANEE — DEMO DATA
// Только для демонстрации продукта. Реальные шаблоны WB не меняются.
// ============================================================

import Database from '../infrastructure/db.js';

const PRODUCTS = [
    ['21_К_Вельвет_бирюзовый','Вельветовый костюм','Костюмы',6990,2450,'Бирюзовый','42'],
    ['21_К_Вельвет_черный','Вельветовый костюм','Костюмы',6990,2450,'Черный','42'],
    ['18_Платье_молочный','Платье миди','Платья',5490,1850,'Молочный','44'],
    ['18_Платье_черный','Платье миди','Платья',5490,1850,'Черный','44'],
    ['07_Юбка_графит','Юбка макси','Юбки',4290,1350,'Графит','46'],
    ['11_Блуза_белая','Блуза базовая','Блузы',3290,990,'Белый','44'],
    ['24_Кардиган_бежевый','Кардиган мягкий','Кардиганы',4790,1650,'Бежевый','46'],
    ['31_Брюки_шоколад','Брюки прямые','Брюки',4990,1750,'Шоколад','44']
];

function key(article, size) { return `${article}|${size}`; }
function iso(daysAgo) { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0,10); }

export async function seedDemoData({ force = false } = {}) {
    const [products, sales, stock] = await Promise.all([
        Database.count(Database.STORES.PRODUCTS),
        Database.count(Database.STORES.SALES),
        Database.count(Database.STORES.STOCK)
    ]);
    if (!force && (products || sales || stock)) return { seeded: false, reason: 'existing-data' };

    if (force) {
        for (const store of [Database.STORES.PRODUCTS, Database.STORES.SALES, Database.STORES.STOCK, Database.STORES.STOCK_HISTORY]) await Database.clear(store);
    }

    const now = new Date().toISOString();
    const productRows = PRODUCTS.map(([article,name,category,price,purchasePrice,color,size]) => ({
        id: key(article,size), article, originalArticle: article, articleKey: key(article,size), productGroupKey: article.split('_')[0], baseModel: article.split('_')[0],
        name, category, color, size, price, purchasePrice, barcode: '', status: 'active', createdAt: now, updatedAt: now
    }));
    await Database.saveMany(Database.STORES.PRODUCTS, productRows);

    const salesRows = [];
    PRODUCTS.forEach(([article,, ,price,,color,size], productIndex) => {
        for (let day = 0; day < 14; day++) {
            const trend = productIndex === 2 ? 1.25 : productIndex === 4 ? 0.55 : 0.85 + ((13-day) * 0.025);
            const orders = Math.max(1, Math.round((2 + ((productIndex * 3 + day) % 5)) * trend));
            const delivered = Math.max(0, Math.round(orders * (0.72 + ((day + productIndex) % 4) * 0.04)));
            const date = iso(day);
            const articleKey = key(article,size);
            salesRows.push({ id:`demo|${articleKey}|${date}`, productId:articleKey, articleKey, productGroupKey:article.split('_')[0], article, color, size, date, orders, delivered, returns:orders-delivered, amount:orders*price, totalAmount:orders*price, source:'demo', importBatchId:'demo-v1', createdAt:now });
        }
    });
    await Database.saveMany(Database.STORES.SALES, salesRows);

    const stockRows = [];
    const historyRows = [];
    PRODUCTS.forEach(([article,, ,,,color,size], productIndex) => {
        const articleKey = key(article,size);
        const base = [8,31,5,24,76,18,42,14][productIndex];
        ['Коледино','Электросталь','Краснодар'].forEach((warehouse, warehouseIndex) => {
            const available = Math.max(0, Math.round(base * ([0.55,0.30,0.15][warehouseIndex])));
            const current = { id:`${articleKey}|${warehouse}|${size}||${iso(0)}`, productId:articleKey, articleKey, productGroupKey:article.split('_')[0], article, size, color, warehouseName:warehouse, warehouseType:'wb', date:iso(0), quantity:available, reserved:0, available, inTransitTo: warehouseIndex===0 && productIndex===0 ? 12 : 0, inTransitFrom:0, source:'demo', isAggregate:false, importBatchId:'demo-v1', createdAt:now };
            stockRows.push(current);
            for (let day=0; day<14; day++) {
                const historic = Math.max(0, available + Math.round((day * (productIndex===0 ? 1 : productIndex===2 ? -0.3 : 0.1))));
                historyRows.push({...current, id:`${articleKey}|${warehouse}|${size}||${iso(day)}`, date:iso(day), quantity:historic, available:historic});
            }
        });
    });
    await Database.saveMany(Database.STORES.STOCK, stockRows);
    await Database.saveMany(Database.STORES.STOCK_HISTORY, historyRows);
    return { seeded:true, products:productRows.length, sales:salesRows.length, stock:stockRows.length, history:historyRows.length };
}

export default { seedDemoData };
