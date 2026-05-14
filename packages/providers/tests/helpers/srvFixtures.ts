import { toDomainName } from '@sundaeswap/capacity-exchange-registry';

export const SRV_NAME = toDomainName('capacity-exchange.preview.sundae.fi');

/** Creates a DoH answer record shape (`"priority weight port target"`). */
export const makeDohAnswer = (priority: number, weight: number, port: number, target: string) => ({
  data: `${priority} ${weight} ${port} ${target}`,
});
