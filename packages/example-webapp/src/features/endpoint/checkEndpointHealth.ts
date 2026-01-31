import type { EndpointConfig, EndpointStatus } from './types';

interface CheckResult {
  ok: boolean;
  details?: string;
}

function getErrorDetails(err: unknown): string {
  if (err instanceof DOMException) {
    return `${err.name}: ${err.message}`;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return String(err);
}

async function checkUrl(url: string): Promise<CheckResult> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      return { ok: true };
    }
    return { ok: false, details: `HTTP ${response.status} ${response.statusText}` };
  } catch (err) {
    return { ok: false, details: getErrorDetails(err) };
  }
}

async function checkGraphql(endpoint: EndpointConfig & { type: 'graphql' }): Promise<EndpointStatus> {
  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return { status: 'offline', details: `HTTP ${response.status} ${response.statusText}` };
    }
    const data = await response.json();
    if (data?.data?.__typename === 'Query') {
      return { status: 'online' };
    }
    return { status: 'offline', details: 'Invalid GraphQL response' };
  } catch (err) {
    return { status: 'offline', details: getErrorDetails(err) };
  }
}

async function checkRest(endpoint: EndpointConfig & { type: 'rest' }): Promise<EndpointStatus> {
  const healthUrl = `${endpoint.url}${endpoint.healthPath}`;
  const healthResult = await checkUrl(healthUrl);

  if (!healthResult.ok) {
    return { status: 'offline', details: healthResult.details };
  }

  if (!endpoint.readyPath) {
    return { status: 'online' };
  }

  const readyUrl = `${endpoint.url}${endpoint.readyPath}`;
  const readyResult = await checkUrl(readyUrl);

  return readyResult.ok ? { status: 'online' } : { status: 'starting', details: readyResult.details };
}

export async function checkEndpointHealth(endpoint: EndpointConfig): Promise<EndpointStatus> {
  switch (endpoint.type) {
    case 'graphql':
      return checkGraphql(endpoint);
    case 'rest':
      return checkRest(endpoint);
  }
}
