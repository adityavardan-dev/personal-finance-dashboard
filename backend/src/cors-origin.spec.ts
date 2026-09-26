import { isAllowedOrigin } from './cors-origin';

describe('isAllowedOrigin', () => {
  it('allows requests without a browser origin', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
  });

  it.each([
    'http://127.0.0.1:4200',
    'http://127.0.0.1:64815',
    'http://localhost:4200',
  ])('allows loopback development origin %s', (origin) => {
    expect(isAllowedOrigin(origin)).toBe(true);
  });

  it.each([
    'https://example.com',
    'http://127.0.0.1.example.com:4200',
    'http://192.168.1.10:4200',
  ])('rejects non-loopback origin %s', (origin) => {
    expect(isAllowedOrigin(origin)).toBe(false);
  });
});
