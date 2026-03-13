import * as fs from 'fs';
import * as path from 'path';

export const rootDir = path.resolve(import.meta.dirname, '..', '..');

export function contractsConfigPath(networkId: string): string {
  return path.join(rootDir, 'packages', 'example-webapp', 'contracts', `.contracts.${networkId}.json`);
}

export function priceConfigPath(networkId: string): string {
  return path.join(rootDir, 'packages', 'server', `price-config.${networkId}.json`);
}

export function priceConfigExamplePath(): string {
  return path.join(rootDir, 'packages', 'server', 'price-config.example.json');
}

export function readJsonFile(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

export function requireFile(filePath: string, networkId: string, label: string): void {
  if (!fs.existsSync(filePath)) {
    console.error(`Missing ${label}: ${filePath}`);
    console.error(`Run: NETWORK_ID=${networkId} task deploy`);
    process.exit(1);
  }
}
