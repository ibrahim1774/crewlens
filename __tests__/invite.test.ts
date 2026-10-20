import { APP_STORE_URL, inviteText } from '@/constants/invite';

test('the invite text says where to enter the code, with the code and the download link', () => {
  const t = inviteText('Smith Roofing', 'ABC234');
  expect(t).toContain('Smith Roofing');
  expect(t).toContain('ABC234');
  expect(t).toContain('Joining a crew?');
  expect(t).toContain(APP_STORE_URL);
});

test('a missing company name still reads naturally', () => {
  expect(inviteText(undefined, 'ABC234')).toMatch(/^Join our crew on Crew Lens/);
});
