/** The onboarding screens in order. Questions first, then the plan, the account, and the permissions once they have paid. */
export const ONBOARDING_STEPS = ['name', 'company', 'tailor', 'moments', 'paywall', 'save', 'permissions', 'first-job', 'crew', 'share-docs'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function stepLabel(step: OnboardingStep): string {
  return `Step ${ONBOARDING_STEPS.indexOf(step) + 1} of ${ONBOARDING_STEPS.length}`;
}

/**
 * Where "completed registration" (AppsFlyer → Meta) fires. A guest has no contact details until the
 * account is saved, so counting them at the company step would feed ad optimisation throwaway sign-ups.
 */
export function registersAt(s: { step: 'company' | 'save'; guest: boolean }): boolean {
  return s.step === 'save' ? s.guest : !s.guest;
}
