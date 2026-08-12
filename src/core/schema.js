export const VERSION='2.1.0';
export const STORES={
  products:'products', variants:'productVariants', sales:'sales', stocks:'stocks', warehouses:'warehouses', locations:'warehouseLocations', containers:'containers', transfers:'stockTransfers', shipments:'shipments', fbs:'fbs', ads:'ads', expenses:'expenses', productionOrders:'productionOrders', apiConnections:'apiConnections', imports:'imports', reports:'reports', users:'users'
};
export const PRODUCT_FIELDS=['article','name','brand','category','color','size','fabric','tnved','barcode','wbArticle','price','discount','purchasePrice','commission','logisticsCost','storageCost','adCost','otherExpenses'];
export const EMPTY_STATES={
 products:['Каталог готов','Создайте карточку или импортируйте номенклатуру.'],
 sales:['Продажи готовы','После импорта или синхронизации здесь появятся продажи.'],
 stocks:['Остатки готовы','Создайте склад или загрузите остатки.'],
 fbs:['FBS готов','После синхронизации появятся заказы на сборку.'],
 ads:['Реклама готова','Импортируйте рекламный отчёт или подключите источник данных.']
};
export function productId(article,color='',size=''){return [article,color,size].map(v=>String(v||'').trim()).join('|').toLowerCase();}
export function normalizeProduct(input={}){return {id:input.id||productId(input.article,input.color,input.size),article:String(input.article||'').trim(),name:String(input.name||'').trim(),brand:String(input.brand||'').trim(),category:String(input.category||'').trim(),color:String(input.color||'').trim(),size:String(input.size||'').trim(),fabric:String(input.fabric||'').trim(),tnved:String(input.tnved||'').trim(),barcode:String(input.barcode||'').trim(),wbArticle:String(input.wbArticle||'').trim(),price:Number(input.price)||0,discount:Number(input.discount)||0,purchasePrice:Number(input.purchasePrice)||0,commission:Number(input.commission)||0,logisticsCost:Number(input.logisticsCost)||0,storageCost:Number(input.storageCost)||0,adCost:Number(input.adCost)||0,otherExpenses:Number(input.otherExpenses)||0,updatedAt:new Date().toISOString()};}
