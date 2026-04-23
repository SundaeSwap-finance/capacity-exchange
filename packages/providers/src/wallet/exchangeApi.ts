import { Configuration, DefaultApi, ResponseError } from '@sundaeswap/capacity-exchange-client';
import { CapacityExchangeServerError } from './errors';

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

const DEFAULT_CAPACITY_EXCHANGE_SERVERS: Record<string, string[] | undefined> = {
  preview: ['https://capacity-exchange.preview.sundae.fi'],
  preprod: ['https://capacity-exchange.preprod.sundae.fi'],
  mainnet: ['https://capacity-exchange.sundae.fi'],
};

// TODO: populate preprod and mainnet as those registries get deployed.
const DEFAULT_REGISTRY_ADDRESSES: Record<string, string | undefined> = {
  preview: '031f39efac81c9b656f4d91ef291a4d1c981f460a100601ae1f6a1e7b20f1b1b',
};

export function getDefaultRegistryAddress(networkId: string): string | undefined {
  return DEFAULT_REGISTRY_ADDRESSES[networkId];
}

export function resolveCesUrls(
  networkId: string,
  additionalCapacityExchangeUrls: string[],
  registryUrls: string[] = []
): string[] {
  const servers = [...(DEFAULT_CAPACITY_EXCHANGE_SERVERS[networkId] ?? [])];
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
