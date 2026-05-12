export const SRV_NAME = 'capacity-exchange.preview.sundae.fi';

/** Creates a Node.js `dns.promises.resolveSrv` record shape. */
export const makeSrvRecord = (priority: number, weight: number, port: number, name: string) => ({
  priority,
  weight,
  port,
  name,
});

/** Creates a DoH answer record shape (`"priority weight port target"`). */
export const makeDohAnswer = (priority: number, weight: number, port: number, target: string) => ({
  data: `${priority} ${weight} ${port} ${target}`,
});
