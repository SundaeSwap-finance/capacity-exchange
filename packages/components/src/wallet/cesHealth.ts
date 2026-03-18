import { Configuration, DefaultApi, ResponseError } from '@capacity-exchange/client';

export type CesHealthStatus =
  | { status: 'healthy' }
  | { status: 'syncing' }
  | { status: 'offline'; error: string };

/**
 * One-shot health check against a CES exchange server.
 * Checks both `/health` and `/health/ready` endpoints.
 *
 * Accepts either a DefaultApi instance or a URL string.
 */
export async function checkCesHealth(apiOrUrl: DefaultApi | string): Promise<CesHealthStatus> {
  const api =
    typeof apiOrUrl === 'string'
      ? new DefaultApi(new Configuration({ basePath: apiOrUrl }))
      : apiOrUrl;

  try {
    await api.healthGet();

    try {
      const readyData = await api.healthReadyGet();
      if (readyData.status === 'syncing') {
        return { status: 'syncing' };
      }
      if (readyData.status !== 'ok') {
        return { status: 'offline', error: `CES status: ${readyData.status}` };
      }
    } catch (err) {
      if (err instanceof ResponseError && err.response.status === 503) {
        return { status: 'syncing' };
      }
      throw err;
    }

    return { status: 'healthy' };
  } catch (err) {
    if (err instanceof ResponseError) {
      return { status: 'offline', error: `HTTP ${err.response.status}` };
    }
    return { status: 'offline', error: err instanceof Error ? err.message : 'Connection failed' };
  }
}
