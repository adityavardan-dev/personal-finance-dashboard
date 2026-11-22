import { loadPennyGuidance } from './penny-guidance';

describe('PENNY runtime guidance', () => {
  it('loads the model section from docs/AGENTS.md without coding instructions', () => {
    const guidance = loadPennyGuidance();
    expect(guidance).toContain('You are PENNY');
    expect(guidance).toContain('Never claim that a transaction has been saved');
    expect(guidance).not.toContain('Run the relevant backend Jest tests');
  });
});
