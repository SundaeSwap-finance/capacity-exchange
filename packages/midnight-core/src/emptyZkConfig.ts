import { ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types';

/** For proving transactions with no contract calls (e.g. dust-only fragments). */
export class EmptyZkConfigProvider extends ZKConfigProvider<never> {
  getZKIR(): Promise<never> {
    return Promise.reject(new Error('No ZK circuits in this transaction'));
  }
  getProverKey(): Promise<never> {
    return Promise.reject(new Error('No ZK circuits in this transaction'));
  }
  getVerifierKey(): Promise<never> {
    return Promise.reject(new Error('No ZK circuits in this transaction'));
  }
}
