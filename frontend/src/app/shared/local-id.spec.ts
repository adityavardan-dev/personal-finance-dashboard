import { vi } from 'vitest';
import { createLocalId } from './local-id';

describe('createLocalId', () => {
  it('creates an ID when randomUUID is unavailable on an HTTP device', () => {
    const browserCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', {
      getRandomValues(bytes: Uint8Array) {
        bytes.forEach((_, index) => { bytes[index] = index; });
        return bytes;
      },
    });

    try {
      expect(createLocalId()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    } finally {
      vi.stubGlobal('crypto', browserCrypto);
    }
  });
});
