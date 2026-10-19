import { importFromLibrary } from '@/lib/photos';

const mockUpsert = jest.fn(async (_p: { takenAt: string }) => {});
const mockRunQueue = jest.fn(async () => {});

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: () => ({
      resize: () => {},
      renderAsync: async () => ({ saveAsync: async () => ({ uri: 'file:///cache/out.jpg', width: 1536, height: 2048 }), release: () => {} }),
    }),
  },
}));
jest.mock('expo-media-library', () => ({
  getAssetInfoAsync: async () => ({
    localUri: 'file:///library/IMG_0020.JPG',
    width: 1536,
    height: 2048,
    creationTime: Date.parse('2026-10-05T12:14:05Z'),
    location: { latitude: 35.86, longitude: -78.73 },
  }),
}));
jest.mock('expo-video-thumbnails', () => ({}));
jest.mock('@/lib/company', () => ({
  getCompany: () => ({ id: 'c1' }),
  getMember: () => ({ userId: 'u1', initials: 'JS' }),
}));
jest.mock('@/lib/db', () => ({
  photos: { upsert: (p: { takenAt: string }) => mockUpsert(p) },
  jobs: { get: async () => ({ coverPhotoId: 'p0' }), setCover: async () => {} },
}));
jest.mock('@/lib/uploader', () => ({ runQueue: () => mockRunQueue() }));
jest.mock('@/lib/supabase', () => ({ supabaseConfigured: true, supabase: {} }));
jest.mock('@/lib/store', () => ({ useVersion: () => 0 }));

test('an imported photo keeps the day it was taken, from the very first write the uploader can see', async () => {
  const photo = await importFromLibrary('j1', 'asset-1', null);
  expect(photo.takenAt).toBe('2026-10-05T12:14:05.000Z');
  // The uploader starts right after the first write and later saves its own copy back,
  // so a second write with the corrected date would be overwritten.
  expect(mockUpsert).toHaveBeenCalledTimes(1);
  expect(mockUpsert.mock.calls[0][0].takenAt).toBe('2026-10-05T12:14:05.000Z');
  expect(mockRunQueue).toHaveBeenCalled();
});
