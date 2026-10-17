import { parseAuthCallback } from '@/lib/auth';

test('ignores URLs that are not the exact auth callback', () => {
  expect(parseAuthCallback('crewlens://job/abc')).toBeNull();
  expect(parseAuthCallback('crewlens://auth/other?code=abcdefgh')).toBeNull();
  expect(parseAuthCallback('https://crewlens-share.vercel.app/s/abc')).toBeNull();
});

test('reads a PKCE code from the query', () => {
  expect(parseAuthCallback('crewlens://auth/callback?code=3f2a9c1e-7b1d-4c2a-9a1f-1234567890ab')).toEqual({ code: '3f2a9c1e-7b1d-4c2a-9a1f-1234567890ab' });
});

test('rejects raw session tokens, so a crafted link cannot plant a session', () => {
  expect(parseAuthCallback('crewlens://auth/callback#access_token=A.B.C&refresh_token=r1&token_type=bearer')).toEqual({ error: 'missing_code' });
  expect(parseAuthCallback('crewlens://auth/callback?code=<script>')).toEqual({ error: 'missing_code' });
});

test('surfaces Supabase errors', () => {
  expect(parseAuthCallback('crewlens://auth/callback#error=access_denied&error_description=Email+link+is+invalid+or+has+expired')).toEqual({ error: 'Email link is invalid or has expired' });
  expect(parseAuthCallback('crewlens://auth/callback?error=otp_expired')).toEqual({ error: 'otp_expired' });
});
