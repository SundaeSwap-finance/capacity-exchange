import { ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types';

/** Routes each circuit's key/zkir lookup to its contract's provider, so one
 *  proof provider can serve a multi-contract transaction. The proof provider
 *  looks up by circuit name, so circuit names must be unique across the
 *  contracts in one transaction. */
export class CompositeZkConfigProvider extends ZKConfigProvider<string> {
  readonly #routes: Record<string, ZKConfigProvider<string>>;

  constructor(routes: Record<string, ZKConfigProvider<string>>) {
    super();
    this.#routes = routes;
  }

  #pick(circuitId: string): ZKConfigProvider<string> {
    const provider = this.#routes[circuitId];
    if (!provider) {
      throw new Error(`No zk config route for circuit '${circuitId}'`);
    }
    return provider;
  }

  getZKIR(circuitId: string) {
    return this.#pick(circuitId).getZKIR(circuitId);
  }
  getProverKey(circuitId: string) {
    return this.#pick(circuitId).getProverKey(circuitId);
  }
  getVerifierKey(circuitId: string) {
    return this.#pick(circuitId).getVerifierKey(circuitId);
  }
}
