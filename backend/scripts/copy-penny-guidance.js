/** Copies the source-of-truth PENNY guidance into the deployable backend build. */
const { copyFileSync, mkdirSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

const source = resolve(__dirname, '../../docs/AGENTS.md');
const target = resolve(__dirname, '../dist/docs/AGENTS.md');
mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
