import { startServer } from '../global-setup.js';

export { teardown } from '../global-setup.js';

export function setup() {
  return startServer('.env.test.cardano');
}
