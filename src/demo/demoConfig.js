export const DEMO_CONFIG = {
  enabled: true,
  name: 'Demo 1',
  label: 'Демонстрационные данные',
  description: 'Готовая демонстрация BELTANEE: товары, продажи, остатки, реклама и рекомендации. Реальные импорты не изменяются.',
  onboarding: {
    title: 'Добро пожаловать в BELTANEE',
    subtitle: 'За минуту покажем, где деньги и где проблемы.',
    steps: [
      { title: 'Пульс бизнеса', text: 'Сразу видите продажи, остатки и позиции, требующие внимания.' },
      { title: 'Товары', text: 'Открываете артикул и видите продажи, остатки, динамику и экономику.' },
      { title: 'Рекомендации', text: 'Получаете конкретные действия вместо набора разрозненных показателей.' }
    ]
  },
  pulse: {
    title: 'Пульс бизнеса',
    text: 'Продажи растут, 3 позиции требуют пополнения, 1 позиция имеет риск избытка.',
    tone: 'attention',
    metrics: ['Продажи 7д', 'Остаток', 'Требуют внимания']
  },
  demoActions: [
    { type: 'replenish', article: '21_К_Вельвет_бирюзовый', title: 'Пополнить остаток', priority: 'high' },
    { type: 'replenish', article: '18_Платье_молочный', title: 'Подготовить поставку', priority: 'high' },
    { type: 'watch', article: '07_Юбка_графит', title: 'Проверить избыток', priority: 'medium' }
  ],
  branding: {
    productName: 'BELTANEE',
    productLine: 'Business Intelligence',
    badge: 'DEMO 1'
  }
};
