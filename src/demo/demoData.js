/* Demo 1 dataset: isolated seed data, never overwrites imported data. */
export const DEMO_PRODUCTS = [
  { article: '21_К_Вельвет_бирюзовый', category: 'Костюмы', price: 5490, cost: 2100, sales7: 47, stock: 8, status: 'urgent', trend: 18 },
  { article: '21_К_Вельвет_черный', category: 'Костюмы', price: 5490, cost: 2100, sales7: 62, stock: 31, status: 'good', trend: 24 },
  { article: '18_Платье_молочный', category: 'Платья', price: 4990, cost: 1900, sales7: 29, stock: 5, status: 'urgent', trend: 31 },
  { article: '18_Платье_черный', category: 'Платья', price: 4990, cost: 1900, sales7: 38, stock: 24, status: 'growth', trend: 14 },
  { article: '07_Юбка_графит', category: 'Юбки', price: 3290, cost: 1250, sales7: 14, stock: 76, status: 'surplus', trend: -11 },
  { article: '11_Блуза_белая', category: 'Блузы', price: 2990, cost: 1100, sales7: 21, stock: 18, status: 'watch', trend: -4 },
  { article: '14_Жакет_шоколад', category: 'Жакеты', price: 6790, cost: 2800, sales7: 34, stock: 12, status: 'urgent', trend: 22 },
  { article: '05_Брюки_молочный', category: 'Брюки', price: 4290, cost: 1650, sales7: 26, stock: 42, status: 'good', trend: 9 }
];

export const DEMO_SUMMARY = {
  period: '7 дней',
  revenue: 1187420,
  orders: 271,
  stock: 216,
  urgent: 3,
  growth: 12.8,
  recommendation: 'Пополнить 3 позиции и проверить рекламу у 2 товаров.'
};

export const DEMO_WAREHOUSES = [
  { name: 'Коледино', stock: 94 },
  { name: 'Электросталь', stock: 71 },
  { name: 'Казань', stock: 51 }
];

export const DEMO_SALES_14D = [18, 21, 19, 24, 27, 25, 31, 29, 34, 37, 35, 41, 44, 47];
