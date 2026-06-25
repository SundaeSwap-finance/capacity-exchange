import * as path from 'path';
import { fileURLToPath } from 'url';

import type { Logger } from '@sundaeswap/capacity-exchange-core';

export function getContractOutDir(logger: Logger) {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const contractOutDir = path.resolve(moduleDir, '../contract/out');
  logger.debug(`Contract output directory: ${contractOutDir}`);
  return contractOutDir;
}
