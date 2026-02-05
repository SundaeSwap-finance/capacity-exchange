import type { StreamCallbacks, CounterIncrementResult, CounterQueryResult } from './types';
import { callApiWithStreaming } from './streaming';

export const counterApi = {
  increment: (networkId: string, contractAddress: string, callbacks: StreamCallbacks) =>
    callApiWithStreaming<CounterIncrementResult>({ route: 'counter/increment', networkId, contractAddress }, callbacks),

  query: (networkId: string, contractAddress: string, callbacks: StreamCallbacks) =>
    callApiWithStreaming<CounterQueryResult>({ route: 'counter/query', networkId, contractAddress }, callbacks),
};
