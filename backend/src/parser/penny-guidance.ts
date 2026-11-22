/** Loads PENNY's model-facing guidance from the repository's docs/AGENTS.md. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const START = '<!-- PENNY_RUNTIME_START -->';
const END = '<!-- PENNY_RUNTIME_END -->';

/** Reads the marked runtime section so coding instructions never enter model prompts. */
export function loadPennyGuidance(): string | null {
  const candidates = [
    resolve(process.cwd(), 'docs/AGENTS.md'),
    resolve(process.cwd(), '../docs/AGENTS.md'),
    resolve(__dirname, '../../docs/AGENTS.md'),
    resolve(__dirname, '../../../docs/AGENTS.md'),
    resolve(__dirname, '../../../../docs/AGENTS.md'),
  ];
  for (const path of candidates) {
    try {
      const document = readFileSync(path, 'utf8');
      const start = document.indexOf(START);
      const end = document.indexOf(END);
      if (start < 0 || end <= start) return null;
      const guidance = document.slice(start + START.length, end).trim();
      return guidance || null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return null;
    }
  }
  return null;
}
