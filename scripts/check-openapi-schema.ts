#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { generateSchema } from '@capacity-exchange/server';
import diff from 'fast-diff';

const outputPath = new URL('../packages/client/openapi.json', import.meta.url).pathname;

const newSchema = JSON.stringify(await generateSchema(), null, 2);
const oldSchema = readFileSync(outputPath, 'utf-8');

if (newSchema === oldSchema) {
  console.log('OpenAPI schema is up to date.');
  process.exit(0);
}

const RESET = '\x1b[0m', RED = '\x1b[31m', GREEN = '\x1b[32m';

// Build an array of lines, each annotated with whether it contains a change
const lines: [string, boolean][] = [['', false]];
for (const [op, text] of diff(oldSchema, newSchema)) {
  const color = op === diff.INSERT ? GREEN : op === diff.DELETE ? RED : '';
  const parts = text.split('\n');
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) { lines.push(['', false]); }
    const [cur, changed] = lines[lines.length - 1];
    lines[lines.length - 1] = [cur + (color ? `${color}${parts[i]}${RESET}` : parts[i]), changed || op !== 0];
  }
}

// Print changed lines with surrounding context
const CONTEXT = 3;
const show = new Set<number>();
lines.forEach(([, changed], i) => {
  if (changed) {
    for (let j = Math.max(0, i - CONTEXT); j <= Math.min(lines.length - 1, i + CONTEXT); j++) { show.add(j); }
  }
});

console.log('OpenAPI schema has changed:\n');
let prev = -1;
for (const i of [...show].sort((a, b) => a - b)) {
  if (prev >= 0 && i > prev + 1) { console.log('  ...'); }
  console.log(lines[i][0]);
  prev = i;
}

process.exit(1);
