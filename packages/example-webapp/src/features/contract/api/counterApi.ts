import type { StreamCallbacks, CounterDeployResult, CounterIncrementResult, CounterQueryResult } from './types';
import { callApiWithStreaming } from './streaming';

export const counterApi = {
  deploy: (networkId: string, callbacks: StreamCallbacks) =>
    callApiWithStreaming<CounterDeployResult>({ route: 'counter/deploy', networkId }, callbacks),

  increment: (networkId: string, contractAddress: string, callbacks: StreamCallbacks) =>
    callApiWithStreaming<CounterIncrementResult>({ route: 'counter/increment', networkId, contractAddress }, callbacks),

  query: (networkId: string, contractAddress: string, callbacks: StreamCallbacks) =>
    callApiWithStreaming<CounterQueryResult>({ route: 'counter/query', networkId, contractAddress }, callbacks),
};
