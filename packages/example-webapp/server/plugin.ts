/**
 * Vite plugin that adds API middleware for contract operations.
 *
 * This plugin intercepts HTTP requests during development and provides two endpoints:
 *
 * 1. GET /api/contracts/:networkId
 *    Returns the deployed contracts config for a network, or an error if not deployed.
 *
 * 2. POST /api/contract
 *    Executes contract CLI scripts (increment, query, mint, verify, etc.) and streams
 *    the output back to the client via Server-Sent Events (SSE).
 *
 */

import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin, ViteDevServer } from 'vite';
import type { RequestBody } from './types.js';
import { loadContractsConfig, runScript } from './lib/index.js';
import { getScriptConfig } from './routes/index.js';

const VALID_ROUTES = [
  'counter/deploy',
  'counter/increment',
  'counter/query',
  'token-mint/deploy',
  'token-mint/mint',
  'token-mint/verify',
] as const;

/**
 * Parses JSON from the request body.
 */
function parseJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * Type guard that validates the request body has the required shape.
 * Checks for a valid `route` discriminant and required `networkId` field.
 */
function isValidRequestBody(body: unknown): body is RequestBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const obj = body as Record<string, unknown>;
  if (typeof obj.route !== 'string') {
    return false;
  }
  if (!VALID_ROUTES.includes(obj.route as (typeof VALID_ROUTES)[number])) {
    return false;
  }
  if (typeof obj.networkId !== 'string') {
    return false;
  }
  return true;
}

/** Sends a JSON response with the given status code */
function sendJson(res: ServerResponse, data: unknown, status = 200): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

/** Pattern for GET /api/contracts/:networkId */
const CONTRACTS_PATH_PATTERN = /^\/api\/contracts\/([^/]+)$/;

/** Handles GET /api/contracts/:networkId - returns contracts config or error */
function handleGetContracts(res: ServerResponse, networkId: string): void {
  const result = loadContractsConfig(networkId);

  switch (result.status) {
    case 'loaded':
      sendJson(res, result.config);
      break;
    case 'not-found':
      sendJson(res, { error: 'Not deployed', networkId });
      break;
    case 'error':
      sendJson(res, { error: result.error, networkId }, 500);
      break;
  }
}

/** Handles POST /api/contract - executes CLI script with SSE streaming */
async function handlePostContract(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const json = await parseJson(req);
  if (!isValidRequestBody(json)) {
    sendJson(res, { success: false, error: 'Invalid request body' }, 400);
    return;
  }

  const config = getScriptConfig(json);
  runScript(req, res, config);
}

/**
 * Main request handler for the middleware.
 * Routes to the appropriate handler based on method and path.
 */
async function handleRequest(req: IncomingMessage, res: ServerResponse, next: () => void): Promise<void> {
  if (!req.url) {
    return next();
  }

  const method = req.method;
  const path = req.url.split('?')[0];

  // GET /api/contracts/:networkId
  const contractsMatch = path.match(CONTRACTS_PATH_PATTERN);
  if (method === 'GET' && contractsMatch) {
    return handleGetContracts(res, contractsMatch[1]);
  }

  // POST /api/contract
  if (method === 'POST' && path === '/api/contract') {
    return handlePostContract(req, res);
  }

  return next();
}

/**
 * Creates a Vite plugin that adds contract API middleware.
 * The middleware is added to the dev server and intercepts API requests.
 */
export function contractsApiPlugin(): Plugin {
  return {
    name: 'contracts-api',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(handleRequest);
    },
  };
}
