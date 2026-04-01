#!/usr/bin/env bun

import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify from 'fastify';
import { writeFileSync } from 'fs';
import { registerRoutes } from '../packages/server/src/app.js';

const outputPath = new URL('../packages/client/openapi.json', import.meta.url).pathname;

const app = Fastify().withTypeProvider<TypeBoxTypeProvider>();
await registerRoutes(app);
await app.ready();

const schema = app.swagger();
writeFileSync(outputPath, JSON.stringify(schema));
console.log(`Schema written to ${outputPath}`);
await app.close();
