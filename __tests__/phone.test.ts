import { formatUSPhone, toE164US } from '@/lib/auth';

test('US numbers become +1 and ten digits however they are typed', () => {
  expect(toE164US('3476131906')).toBe('+13476131906');
  expect(toE164US('(347) 613-1906')).toBe('+13476131906');
  expect(toE164US('+1 347 613 1906')).toBe('+13476131906');
  expect(toE164US('1-347-613-1906')).toBe('+13476131906');
});

test('anything that is not a full US number is refused', () => {
  expect(toE164US('613-1906')).toBeNull();
  expect(toE164US('+44 20 7946 0958')).toBeNull();
  expect(toE164US('034 761 3190')).toBeNull(); // area codes never start with 0 or 1
  expect(toE164US('')).toBeNull();
});

test('the field shows the number as it is typed, US style', () => {
  expect(formatUSPhone('347')).toBe('(347');
  expect(formatUSPhone('3476')).toBe('(347) 6');
  expect(formatUSPhone('3476131906')).toBe('(347) 613-1906');
  expect(formatUSPhone('+1 (347) 613-1906')).toBe('(347) 613-1906');
});
