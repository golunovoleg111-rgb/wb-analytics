export const IMPORT_TEMPLATES={
 products:{title:'Номенклатура',description:'Карточки товаров, варианты, цены и себестоимость.',required:['Артикул'],optional:['Название','Цена','Себестоимость','Комиссия','Логистика','Цвет','Размер','Статус']},
 sales:{title:'Продажи',description:'Заказы и выручка за выбранный период.',required:['Артикул','Дата'],optional:['Заказы','Выкупы','Выручка','Цена','Склад']},
 stocks:{title:'Остатки WB',description:'Остатки по складам, размерам и цветам.',required:['Артикул'],optional:['Дата','Склад','Остаток','Размер','Цвет']},
 ads:{title:'Реклама',description:'Фактические расходы и показатели рекламных кампаний.',required:['Дата'],optional:['Кампания','Расход','Показы','Клики','Заказы','Артикул']},
 fbs:{title:'FBS заказы',description:'Очередь заказов для сборки и отгрузки.',required:['Артикул'],optional:['Дата','Статус','Склад','Штрихкод','Сумма','Количество']}
};
const csv=v=>`"${String(v??'').replaceAll('"','""')}"`;
export function downloadTemplate(type){const t=IMPORT_TEMPLATES[type];if(!t)return;const headers=[...t.required,...t.optional];const blob=new Blob(['\ufeff'+headers.map(csv).join(';')+'\n'],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`StockFlow_${type}_template.csv`;a.click();URL.revokeObjectURL(a.href);}
export function templatesHtml(){return `<div class="template-grid">${Object.entries(IMPORT_TEMPLATES).map(([id,t])=>`<article class="template-card"><div class="template-kicker">${id.toUpperCase()}</div><h3>${t.title}</h3><p>${t.description}</p><div class="template-fields"><b>Обязательно:</b> ${t.required.join(', ')}<br><b>Можно добавить:</b> ${t.optional.join(', ')}</div><button class="btn btn-secondary" data-template="${id}">Скачать шаблон</button></article>`).join('')}</div>`;}
