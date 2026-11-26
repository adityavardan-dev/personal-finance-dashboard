import type { SemanticDomain, SemanticModelProvider } from './contracts';
import { SemanticEngine } from './semantic-engine';

interface Input {
  text: string;
}
interface Proposal {
  values: string[];
}

const domain: SemanticDomain<Input, Proposal> = {
  name: 'test-domain',
  schemaVersion: 1,
  validate: (proposal) => proposal.values.length > 0,
};

const provider = (
  name: string,
  result: Awaited<
    ReturnType<SemanticModelProvider<Input, Proposal>['extract']>
  >,
  configured = true,
): SemanticModelProvider<Input, Proposal> => ({
  name,
  isConfigured: () => configured,
  extract: jest.fn().mockResolvedValue(result),
});

describe('SemanticEngine', () => {
  it('accepts a schema-valid proposal from the primary provider', async () => {
    const result = await new SemanticEngine().interpret(
      { text: 'hello' },
      domain,
      [provider('primary', { status: 'SUCCESS', value: { values: ['one'] } })],
    );

    expect(result).toMatchObject({
      status: 'ACCEPTED',
      provider: 'primary',
      providerAttempted: true,
      providerAccepted: true,
    });
  });

  it('uses one fallback only when the primary is unavailable', async () => {
    const primary = provider('primary', { status: 'UNAVAILABLE' });
    const fallback = provider('fallback', {
      status: 'SUCCESS',
      value: { values: ['two'] },
    });

    const result = await new SemanticEngine().interpret(
      { text: 'hello' },
      domain,
      [primary, fallback],
    );

    expect(result).toMatchObject({ status: 'ACCEPTED', provider: 'fallback' });
    expect(result.attempts).toEqual([
      { provider: 'primary', outcome: 'UNAVAILABLE' },
      { provider: 'fallback', outcome: 'ACCEPTED' },
    ]);
  });

  it('does not let a fallback legitimize an invalid primary response', async () => {
    const fallback = provider('fallback', {
      status: 'SUCCESS',
      value: { values: ['two'] },
    });
    const result = await new SemanticEngine().interpret(
      { text: 'hello' },
      domain,
      [provider('primary', { status: 'INVALID_RESPONSE' }), fallback],
    );

    expect(result.status).toBe('REJECTED');
    expect(fallback.extract).not.toHaveBeenCalled();
  });

  it('rejects output that fails the domain validator', async () => {
    const result = await new SemanticEngine().interpret(
      { text: 'hello' },
      domain,
      [provider('primary', { status: 'SUCCESS', value: { values: [] } })],
    );

    expect(result).toMatchObject({
      status: 'REJECTED',
      providerAccepted: false,
    });
    expect(result.attempts).toEqual([
      { provider: 'primary', outcome: 'DOMAIN_REJECTED' },
    ]);
  });
});
