/** The onboarding screens in order. Questions first, the plan next, the account last. */
export const ONBOARDING_STEPS = ['name', 'company', 'tailor', 'pains', 'cost', 'permissions', 'paywall', 'save', 'first-job', 'crew', 'share-docs'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function stepLabel(step: OnboardingStep): string {
  return `Step ${ONBOARDING_STEPS.indexOf(step) + 1} of ${ONBOARDING_STEPS.length}`;
}
