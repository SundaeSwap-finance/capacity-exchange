export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CounterDeployResult {
  contractAddress: string;
  txHash: string;
}

export interface CounterIncrementResult {
  txHash: string;
  contractAddress: string;
  blockHeight: string;
  blockHash: string;
}

export interface CounterQueryResult {
  contractAddress: string;
  round: string;
}

export interface TokenMintDeployResult {
  contractAddress: string;
  txHash: string;
  tokenColor: string;
  privateStateId: string;
}

export interface TokenMintMintResult {
  txHash: string;
  contractAddress: string;
  amount: string;
  derivedTokenColor: string;
}

export interface TokenMintVerifyResult {
  verified: boolean;
  contractAddress: string;
  tokenColor: string;
  derivedTokenColor: string;
  balance: string;
}

export interface StreamCallbacks {
  onLog?: (text: string, stream: 'stdout' | 'stderr') => void;
  onDone?: <T>(result: ApiResult<T>) => void;
}

/**
 * Call an API endpoint with SSE streaming for logs
 */
async function callApiWithStreaming<T>(
  endpoint: string,
  body: Record<string, unknown> = {},
  callbacks: StreamCallbacks = {},
): Promise<ApiResult<T>> {
  return new Promise((resolve) => {
    const controller = new AbortController();

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const text = await response.text();
          const result = { success: false, error: text } as ApiResult<T>;
          callbacks.onDone?.(result);
          resolve(result);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          const result = { success: false, error: 'No response body' } as ApiResult<T>;
          callbacks.onDone?.(result);
          resolve(result);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        const processEvents = (text: string) => {
          buffer += text;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let eventType = '';
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7);
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6);

              if (eventType && eventData) {
                try {
                  const parsed = JSON.parse(eventData);

                  if (eventType === 'log') {
                    callbacks.onLog?.(parsed.text, parsed.stream);
                  } else if (eventType === 'done') {
                    callbacks.onDone?.(parsed);
                    resolve(parsed as ApiResult<T>);
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }

              eventType = '';
              eventData = '';
            }
          }
        };

        const read = async (): Promise<void> => {
          const { done, value } = await reader.read();
          if (done) {
            return;
          }
          processEvents(decoder.decode(value, { stream: true }));
          return read();
        };

        await read();
      })
      .catch((error) => {
        const result = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        } as ApiResult<T>;
        callbacks.onDone?.(result);
        resolve(result);
      });
  });
}

export const counterApi = {
  deploy: (callbacks?: StreamCallbacks) =>
    callApiWithStreaming<CounterDeployResult>('/api/counter/deploy', {}, callbacks),

  increment: (contractAddress: string, callbacks?: StreamCallbacks) =>
    callApiWithStreaming<CounterIncrementResult>(
      '/api/counter/increment',
      { contractAddress },
      callbacks,
    ),

  query: (contractAddress: string, callbacks?: StreamCallbacks) =>
    callApiWithStreaming<CounterQueryResult>(
      '/api/counter/query',
      { contractAddress },
      callbacks,
    ),
};

export const tokenMintApi = {
  deploy: (tokenColor?: string, callbacks?: StreamCallbacks) =>
    callApiWithStreaming<TokenMintDeployResult>(
      '/api/token-mint/deploy',
      { tokenColor },
      callbacks,
    ),

  mint: (
    contractAddress: string,
    privateStateId: string,
    amount: number,
    callbacks?: StreamCallbacks,
  ) =>
    callApiWithStreaming<TokenMintMintResult>(
      '/api/token-mint/mint',
      { contractAddress, privateStateId, amount },
      callbacks,
    ),

  verify: (contractAddress: string, tokenColor: string, callbacks?: StreamCallbacks) =>
    callApiWithStreaming<TokenMintVerifyResult>(
      '/api/token-mint/verify',
      { contractAddress, tokenColor },
      callbacks,
    ),
};
