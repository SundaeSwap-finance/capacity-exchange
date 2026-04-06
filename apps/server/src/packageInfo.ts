import { readFileSync } from 'fs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

export const packageName: string = packageJson.name;
export const packageVersion: string = packageJson.version;
