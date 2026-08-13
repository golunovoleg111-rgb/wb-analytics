// B-JOB import contracts. Minimal, user-friendly Excel templates with only required business columns.
export const IMPORT_TEMPLATES={
 products:{title:'Товары',description:'Карточки товаров: артикул, название и базовые цены',columns:['Артикул','Название','Цена','Себестоимость','Баркод']},
 sales:{title:'Продажи',description:'Заказы и выручка по датам и артикулам',columns:['Дата','Артикул','Заказы','Сумма']},
 stocks:{title:'Остатки',description:'Фактические остатки по складам',columns:['Дата','Склад','Артикул','Доступно']},
 advertising:{title:'Реклама',description:'Расходы и эффективность рекламных кампаний',columns:['Дата','Кампания','Показы','Клики','Расход','Заказы']},
 warehouses:{title:'Склады',description:'Список собственных складов',columns:['Склад','Адрес','Тип']},
 fbs:{title:'FBS',description:'Заказы для сборки и отгрузки',columns:['Заказ','Дата','Артикул','Баркод','Количество','Склад','Статус']}
};
export function template(name){return IMPORT_TEMPLATES[name]||null;}
export function headers(name){return template(name)?.columns||[];}
export function validateHeader(name,received=[]){const expected=headers(name);const actual=new Set(received.map(String));return {valid:expected.every(x=>actual.has(x)),missing:expected.filter(x=>!actual.has(x)),expected};}
export default IMPORT_TEMPLATES;
