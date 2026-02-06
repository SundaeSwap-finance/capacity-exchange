import type { ApiResult, StreamCallbacks } from './types';

function createErrorResult<T>(error: string): ApiResult<T> {
  return { success: false, error };
}

type SSEEvent =
  | { type: 'log'; data: { text: string; stream: 'stdout' | 'stderr' } }
  | { type: 'done'; data: ApiResult<unknown> };

const EVENT_PREFIX = 'event: ';
const DATA_PREFIX = 'data: ';

/** Parses SSE lines and extracts complete events */
function parseSSEEvents(lines: string[]): SSEEvent[] {
  const events: SSEEvent[] = [];
  let eventType = '';

  for (const line of lines) {
    if (line.startsWith(EVENT_PREFIX)) {
      eventType = line.slice(EVENT_PREFIX.length);
    } else if (line.startsWith(DATA_PREFIX) && eventType) {
      try {
        const data = JSON.parse(line.slice(DATA_PREFIX.length));
        if (eventType === 'log') {
          events.push({ type: 'log', data });
        } else if (eventType === 'done') {
          events.push({ type: 'done', data });
        }
      } catch {
        // Ignore parse errors
      }
      eventType = '';
    }
  }

  return events;
}

/** Creates an SSE processor that buffers partial lines and emits complete events */
function createSSEProcessor() {
  let buffer = '';

  return (chunk: string): SSEEvent[] => {
    buffer += chunk;
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    return parseSSEEvents(lines);
  };
}

/** Reads all chunks from a stream and processes them */
async function readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (text: string) => void
): Promise<void> {
  const decoder = new TextDecoder();

  const read = async (): Promise<void> => {
    const { done, value } = await reader.read();
    if (done) {
      return;
    }
    onChunk(decoder.decode(value, { stream: true }));
    return read();
  };

  await read();
}

/** Posts to /api/contract and returns the response */
async function postContract(body: Record<string, unknown>): Promise<Response> {
  return fetch('/api/contract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Gets stream reader from response, returns error result if not available */
function getStreamReader<T>(response: Response): ReadableStreamDefaultReader<Uint8Array> | ApiResult<T> {
  const reader = response.body?.getReader();
  if (!reader) {
    return createErrorResult<T>('No response body');
  }
  return reader;
}

/** Processes SSE stream, dispatching events to callbacks and resolving on done */
async function processSSEStream<T>(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: StreamCallbacks,
  resolve: (result: ApiResult<T>) => void
): Promise<void> {
  const processSSE = createSSEProcessor();

  await readStream(reader, (chunk) => {
    for (const event of processSSE(chunk)) {
      switch (event.type) {
        case 'log':
          callbacks.onLog(event.data.text, event.data.stream);
          break;
        case 'done':
          resolve(event.data as ApiResult<T>);
          break;
      }
    }
  });
}

export async function callApiWithStreaming<T>(
  body: Record<string, unknown>,
  callbacks: StreamCallbacks
): Promise<ApiResult<T>> {
  return new Promise((resolve) => {
    postContract(body)
      .then(async (response) => {
        if (!response.ok) {
          return resolve(createErrorResult(await response.text()));
        }

        const reader = getStreamReader<T>(response);
        if ('success' in reader) {
          return resolve(reader);
        }

        await processSSEStream(reader, callbacks, resolve);
      })
      .catch((error) => {
        resolve(createErrorResult(error instanceof Error ? error.message : 'Unknown error'));
      });
  });
}
