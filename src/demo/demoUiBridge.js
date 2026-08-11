import { getDemoExperience, getDemoOnboardingState, completeDemoOnboarding } from './demoExperience.js';

/**
 * Small, dependency-free bridge for the Demo 1 presentation layer.
 * It intentionally does not replace existing pages or services.
 */
export function getDemoUiModel() {
  const experience = getDemoExperience();
  return {
    brand: experience.config.branding,
    pulse: experience.pulse,
    actions: experience.actions,
    products: experience.products,
    onboarding: {
      ...experience.config.onboarding,
      completed: getDemoOnboardingState().completed
    }
  };
}

export function finishDemoIntro() {
  completeDemoOnboarding();
  window.dispatchEvent(new CustomEvent('beltanee:demo-onboarding-complete'));
}

export function installDemoUiBridge() {
  window.BELTANEE_DEMO = Object.freeze({
    getModel: getDemoUiModel,
    finishIntro: finishDemoIntro
  });
  return window.BELTANEE_DEMO;
}

if (typeof window !== 'undefined') installDemoUiBridge();
