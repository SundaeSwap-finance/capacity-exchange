import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import type { PrivateStateProvider } from '@midnight-ntwrk/midnight-js-types';

const DB_PATH = '.midnight-private-state';

export function createPrivateStateProvider(): PrivateStateProvider {
  return levelPrivateStateProvider({
    midnightDbName: DB_PATH,
    privateStoragePasswordProvider: () => 'Demo-password-4-local-dev!',
    accountId: 'default',
  });
}
