import { initialsFor, TRADES } from '@/lib/company';

test('initials from one name take three letters', () => {
  expect(initialsFor('Ibrahim')).toBe('IBR');
  expect(initialsFor('Jo')).toBe('JO');
});

test('initials from two names', () => {
  expect(initialsFor('Jo Smith')).toBe('JOS');
});

test('initials from three names', () => {
  expect(initialsFor('Ana Maria Lopez')).toBe('AML');
});

test('empty name gives placeholder', () => {
  expect(initialsFor('   ')).toBe('???');
});

test('trade list has Other last', () => {
  expect(TRADES[TRADES.length - 1]).toBe('Other');
  expect(TRADES.length).toBe(12);
});
