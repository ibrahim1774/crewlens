export const APP_STORE_URL = 'https://apps.apple.com/app/id6823989964';

/** The text an owner sends a crew member: where to tap, the one-time code, and the download link. */
export function inviteText(company: string | undefined, code: string): string {
  return `Join ${company ?? 'our crew'} on Crew Lens. Install it, tap Get started, then "Joining a crew?" and enter code ${code}: ${APP_STORE_URL}`;
}
