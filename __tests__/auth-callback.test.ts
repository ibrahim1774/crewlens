import { parseAuthCallback } from '@/lib/auth';

test('ignores URLs that are not the auth callback', () => {
  expect(parseAuthCallback('crewlens://job/abc')).toBeNull();
  expect(parseAuthCallback('https://crewlens-share.vercel.app/s/abc')).toBeNull();
});

test('reads implicit-flow tokens from the fragment', () => {
  expect(parseAuthCallback('crewlens://auth/callback#access_token=A.B.C&expires_in=3600&refresh_token=r1&token_type=bearer&type=magiclink')).toEqual({ accessToken: 'A.B.C', refreshToken: 'r1' });
});

test('reads a PKCE code from the query', () => {
  expect(parseAuthCallback('crewlens://auth/callback?code=xyz')).toEqual({ code: 'xyz' });
});

test('surfaces Supabase errors and missing tokens', () => {
  expect(parseAuthCallback('crewlens://auth/callback#error=access_denied&error_description=Email+link+is+invalid+or+has+expired')).toEqual({ error: 'Email link is invalid or has expired' });
  expect(parseAuthCallback('crewlens://auth/callback')).toEqual({ error: 'missing_tokens' });
});
