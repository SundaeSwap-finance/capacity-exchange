import { Configuration, DefaultApi, ResponseError } from '@sundaeswap/capacity-exchange-client';
import { defaultCapacityExchangeUrls } from '@sundaeswap/capacity-exchange-core';
import { CapacityExchangeServerError } from './errors.js';

export interface CesApi {
  url: string;
  api: DefaultApi;
}

/**
 * Wraps a CES API call to translate ResponseError into CapacityExchangeServerError.
 */
async function wrapCesApi<T>(cesApi: () => Promise<T>): Promise<T> {
  try {
    return await cesApi();
  } catch (e) {
    if (!(e instanceof ResponseError)) {
      throw e;
    }

    // Handle ResponseError
    const errorText = await e.response.text().catch(() => 'Unknown error');
    throw new CapacityExchangeServerError(e.response.status, errorText);
  }
}

class WrappedDefaultApi extends DefaultApi {
  async apiPricesGet(requestParameters: Parameters<DefaultApi['apiPricesGet']>[0]) {
    return wrapCesApi(() => super.apiPricesGet(requestParameters));
  }

  async apiOffersPost(requestParameters: Parameters<DefaultApi['apiOffersPost']>[0]) {
    return wrapCesApi(() => super.apiOffersPost(requestParameters));
  }

  async apiSponsorPost(requestParameters: Parameters<DefaultApi['apiSponsorPost']>[0]) {
    return wrapCesApi(() => super.apiSponsorPost(requestParameters));
  }
}

export { getDefaultRegistryAddress } from '@sundaeswap/capacity-exchange-registry';

export function resolveCesUrls(
  networkId: string,
  additionalCapacityExchangeUrls: string[],
  registryUrls: string[] = []
): string[] {
  const servers = defaultCapacityExchangeUrls(networkId);
  for (const url of [...additionalCapacityExchangeUrls, ...registryUrls]) {
    if (!servers.includes(url)) {
      servers.push(url);
    }
  }
  return servers;
}

export function createCesApi(url: string): CesApi {
  return {
    url,
    api: new WrappedDefaultApi(new Configuration({ basePath: url })),
  };
}

export function createCesApis(urls: string[]): CesApi[] {
  return urls.map((url) => createCesApi(url));
}
