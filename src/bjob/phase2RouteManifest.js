export const PHASE2_ROUTE_MANIFEST = Object.freeze([
  ['dashboard', 'Главная'],
  ['reports', 'Отчёты'],
  ['analytics', 'Аналитика'],
  ['products', 'Товары'],
  ['shops', 'Магазины'],
  ['personal', 'Личный кабинет'],
  ['fbo', 'Склад FBO'],
  ['fbs', 'Склад FBS'],
  ['supplies', 'Поставки'],
  ['supplies-fbs', 'Поставки FBS'],
  ['production', 'Производство'],
  ['sales-history', 'История продаж'],
  ['api', 'Интеграция по API'],
  ['lan', 'Интеграция по LAN'],
  ['sync', 'Синхронизация'],
  ['access', 'Персональный доступ'],
  ['prices', 'Цены и скидки'],
  ['tables', 'Таблицы'],
  ['workspace', 'Рабочие пространства и личные кабинеты'],
  ['history', 'История изменений'],
  ['settings', 'Настройки'],
  ['organization', 'Организация'],
  ['users', 'Сотрудники'],
  ['backup', 'Резервные копии']
]);

export function routeIds() {
  return PHASE2_ROUTE_MANIFEST.map(([id]) => id);
}
