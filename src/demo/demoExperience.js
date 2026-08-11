import { DEMO_CONFIG } from './demoConfig.js';
import { DEMO_PRODUCTS, DEMO_SUMMARY, DEMO_WAREHOUSES, DEMO_SALES_14D } from './demoData.js';

const STORAGE_KEY = 'beltanee_demo_onboarding_v1';

export function getDemoExperience() {
  return {
    config: DEMO_CONFIG,
    products: DEMO_PRODUCTS,
    summary: DEMO_SUMMARY,
    warehouses: DEMO_WAREHOUSES,
    sales14d: DEMO_SALES_14D,
    pulse: {
      title: DEMO_CONFIG.pulse.title,
      tone: DEMO_CONFIG.pulse.tone,
      headline: 'Продажи растут, но 3 позиции уже требуют внимания.',
      metrics: [
        { label: 'Продажи за 7 дней', value: `${DEMO_SUMMARY.orders} заказов`, trend: `+${DEMO_SUMMARY.growth}%` },
        { label: 'Остаток', value: `${DEMO_SUMMARY.stock} шт.`, trend: 'контроль' },
        { label: 'Требуют внимания', value: `${DEMO_SUMMARY.urgent} позиции`, trend: 'сейчас' }
      ]
    },
    actions: DEMO_CONFIG.demoActions.map(action => ({
      ...action,
      product: DEMO_PRODUCTS.find(product => product.article === action.article) || null
    }))
  };
}

export function getDemoOnboardingState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"completed":false}');
  } catch {
    return { completed: false };
  }
}

export function completeDemoOnboarding() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ completed: true, completedAt: Date.now() }));
}

export function resetDemoOnboarding() {
  localStorage.removeItem(STORAGE_KEY);
}

export function getDemoProduct(article) {
  return DEMO_PRODUCTS.find(product => product.article === article) || null;
}

export function getDemoStatusLabel(status) {
  return ({
    urgent: 'Срочно',
    good: 'Стабильно',
    growth: 'Растёт',
    surplus: 'Избыток',
    watch: 'Наблюдать'
  })[status] || 'Наблюдать';
}

// Панель Demo 1 относится только к главной странице.
// Синхронизация через MutationObserver также покрывает программную навигацию.
export function installDemoExperienceVisibility() {
  if (window.__BELTANEE_DEMO_VISIBILITY__) return;
  window.__BELTANEE_DEMO_VISIBILITY__ = true;

  const sync = () => {
    const bar = document.getElementById('demoExperienceBar');
    const dashboard = document.getElementById('page-dashboard');
    if (!bar || !dashboard) return;
    const isDashboard = dashboard.classList.contains('active');
    bar.style.display = isDashboard ? '' : 'none';
    bar.setAttribute('aria-hidden', isDashboard ? 'false' : 'true');
  };

  const start = () => {
    sync();
    const root = document.querySelector('main.content') || document.body;
    new MutationObserver(sync).observe(root, {
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    [50, 250, 600].forEach(delay => setTimeout(sync, delay));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

installDemoExperienceVisibility();
