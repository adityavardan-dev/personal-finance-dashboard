import type { CloudflareTransactionSegmentationProvider } from './cloudflare-transaction-segmentation.provider';
import { XpenseSemanticSdk } from '@adityavardan/xpense-semantics';
import { SemanticEngine } from '@adityavardan/semantic-core';
import type { CloudflareSplitInterpreter } from '../parser/cloudflare-split-interpreter';
import type { CloudflarePersonalFollowUp } from '../parser/cloudflare-personal-follow-up';

describe('XpenseSemanticSdk', () => {
  it('returns transaction segments through a provider-neutral engine', async () => {
    const provider = {
      name: 'test-provider',
      isConfigured: () => true,
      extract: jest.fn().mockResolvedValue({
        status: 'SUCCESS',
        value: { segments: ['coffee 180', 'metro 70'] },
      }),
    } as unknown as CloudflareTransactionSegmentationProvider;
    const sdk = new XpenseSemanticSdk(new SemanticEngine(), provider);

    await expect(sdk.segment('coffee 180 metro 70')).resolves.toEqual([
      'coffee 180',
      'metro 70',
    ]);
  });

  it('routes semantic operations through one request contract', async () => {
    const provider = {
      name: 'test-provider',
      isConfigured: () => true,
      extract: jest.fn().mockResolvedValue({
        status: 'SUCCESS',
        value: { segments: ['coffee 180', 'metro 70'] },
      }),
    } as unknown as CloudflareTransactionSegmentationProvider;
    const splitInterpreter = {
      isConfigured: () => true,
      interpret: jest
        .fn()
        .mockResolvedValue([{ amount: '900', peopleCount: '3' }]),
    } as unknown as CloudflareSplitInterpreter;
    const sdk = new XpenseSemanticSdk(
      new SemanticEngine(),
      provider,
      splitInterpreter,
    );

    await expect(
      sdk.interpret({
        kind: 'TRANSACTION_SEGMENTATION',
        text: 'coffee 180 metro 70',
      }),
    ).resolves.toEqual(['coffee 180', 'metro 70']);
    await expect(
      sdk.interpret({ kind: 'PEER_SPLIT', text: 'split 900 among three' }),
    ).resolves.toEqual([{ amount: '900', peopleCount: '3' }]);
  });

  it('returns null when XPENSE rejects invented provider text', async () => {
    const provider = {
      name: 'test-provider',
      isConfigured: () => true,
      extract: jest.fn().mockResolvedValue({
        status: 'SUCCESS',
        value: { segments: ['coffee 180', 'invented 999'] },
      }),
    } as unknown as CloudflareTransactionSegmentationProvider;
    const sdk = new XpenseSemanticSdk(new SemanticEngine(), provider);

    await expect(sdk.segment('coffee 180 metro 70')).resolves.toBeNull();
  });

  it('delegates peer-split interpretation through the XPENSE facade', async () => {
    const provider = {
      isConfigured: () => false,
    } as CloudflareTransactionSegmentationProvider;
    const splitInterpreter = {
      isConfigured: () => true,
      interpret: jest
        .fn()
        .mockResolvedValue([{ amount: '900', peopleCount: '3' }]),
    } as unknown as CloudflareSplitInterpreter;
    const sdk = new XpenseSemanticSdk(
      new SemanticEngine(),
      provider,
      splitInterpreter,
    );

    await expect(
      sdk.interpretPeerSplits('split 900 among three'),
    ).resolves.toEqual([{ amount: '900', peopleCount: '3' }]);
  });

  it('delegates personal follow-ups through the XPENSE facade', async () => {
    const provider = {
      isConfigured: () => false,
    } as CloudflareTransactionSegmentationProvider;
    const personalInterpreter = {
      isConfigured: () => true,
      interpret: jest
        .fn()
        .mockResolvedValue([{ ordinal: 2, action: 'DELETE' }]),
    } as unknown as CloudflarePersonalFollowUp;
    const sdk = new XpenseSemanticSdk(
      new SemanticEngine(),
      provider,
      undefined,
      personalInterpreter,
    );

    await expect(
      sdk.interpretPersonalFollowUp(
        'remove draft 2',
        [],
        '2026-11-27T00:00:00.000Z',
      ),
    ).resolves.toEqual([{ ordinal: 2, action: 'DELETE' }]);
  });
});
