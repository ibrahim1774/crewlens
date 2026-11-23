import { Share } from 'react-native';

import { presentShare, SHEET_CLOSE_MS } from '@/lib/share-sheet';

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test('returns at once even when iOS never reports the sheet closed', () => {
  const spy = jest.spyOn(Share, 'share').mockReturnValue(new Promise(() => {}));
  expect(presentShare({ message: 'x' })).toBeUndefined();
  expect(spy).toHaveBeenCalledWith({ message: 'x' });
});

test('waits for a closing Sheet before presenting', () => {
  jest.useFakeTimers();
  const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  presentShare({ message: 'x' }, true);
  expect(spy).not.toHaveBeenCalled();
  jest.advanceTimersByTime(SHEET_CLOSE_MS);
  expect(spy).toHaveBeenCalledTimes(1);
});

test('a share sheet error never escapes', async () => {
  jest.spyOn(Share, 'share').mockRejectedValue(new Error('boom'));
  expect(() => presentShare({ message: 'x' })).not.toThrow();
  await Promise.resolve();
});
