import type { ServerResponse } from 'http';

type SSEEvent =
  | { type: 'log'; data: { stream: 'stdout' | 'stderr'; text: string } }
  | {
      type: 'done';
      data: { success: true; data?: unknown; exitCode: number } | { success: false; error: string; exitCode: number };
    };

export function setupSSE(res: ServerResponse): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

export function sendEvent(
  res: ServerResponse,
  type: SSEEvent['type'],
  data: Extract<SSEEvent, { type: typeof type }>['data']
): void {
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
