import { formatCoords } from '@/lib/geo';

export interface Stampable {
  takenAt: string;
  lat: number | null;
  lng: number | null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function parts(iso: string, timeZone?: string) {
  const d = new Date(iso);
  if (!timeZone) {
    return { h: d.getHours(), m: d.getMinutes(), mo: d.getMonth(), day: d.getDate(), y: d.getFullYear() };
  }
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    hour: 'numeric',
    minute: 'numeric',
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });
  const get = (type: string) => Number(f.formatToParts(d).find((p) => p.type === type)?.value ?? 0);
  return { h: get('hour') % 24, m: get('minute'), mo: get('month') - 1, day: get('day'), y: get('year') };
}

/**
 * The two lines of a photo stamp: when, then where and who.
 * ["14:42 · OCT 17 2026", "40.7128N 74.0060W · IBR"]
 */
export function stampLines(p: Stampable, initials: string, timeZone?: string): [string, string] {
  const { h, m, mo, day, y } = parts(p.takenAt, timeZone);
  const when = `${pad(h)}:${pad(m)} · ${MONTHS[mo]} ${pad(day)} ${y}`;
  const where = p.lat != null && p.lng != null ? formatCoords(p.lat, p.lng) : 'NO GPS';
  return [when, `${where} · ${initials}`];
}
