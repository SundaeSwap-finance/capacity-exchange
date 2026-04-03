#!/usr/bin/env bun

import { writeFileSync } from 'fs';
import { generateSchema } from '@capacity-exchange/server';

const outputPath = new URL('../packages/client/openapi.json', import.meta.url).pathname;

const schema = await generateSchema();
writeFileSync(outputPath, JSON.stringify(schema, null, 2));
console.log(`Schema written to ${outputPath}`);
