export const SRV_NAME = 'capacity-exchange.preview.sundae.fi';

/** Creates a DoH answer record shape (`"priority weight port target"`). */
export const makeDohAnswer = (priority: number, weight: number, port: number, target: string) => ({
  data: `${priority} ${weight} ${port} ${target}`,
});
