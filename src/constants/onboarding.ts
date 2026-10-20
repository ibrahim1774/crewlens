/**
 * Where "completed registration" (AppsFlyer → Meta) fires. A guest has no contact details until the
 * account is saved, so counting them at the company step would feed ad optimisation throwaway sign-ups.
 */
export function registersAt(s: { step: 'company' | 'save'; guest: boolean }): boolean {
  return s.step === 'save' ? s.guest : !s.guest;
}
