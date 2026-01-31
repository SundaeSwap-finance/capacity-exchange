import type { EndpointStatus } from './types';

async function checkUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export interface HealthCheckConfig {
  healthPath: string;
  readyPath?: string;
}

export async function checkEndpointHealth(baseUrl: string, config: HealthCheckConfig): Promise<EndpointStatus> {
  const healthUrl = `${baseUrl}${config.healthPath}`;
  const isHealthy = await checkUrl(healthUrl);

  if (!isHealthy) {
    return 'offline';
  }

  if (!config.readyPath) {
    return 'online';
  }

  const readyUrl = `${baseUrl}${config.readyPath}`;
  const isReady = await checkUrl(readyUrl);

  return isReady ? 'online' : 'starting';
}
