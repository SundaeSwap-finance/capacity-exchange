import { ApiPricesGet200Response } from '@client/models/ApiPricesGet200Response';
import { getApi } from './api';

describe('Prices API', () => {
  const api = getApi();

  it('should get a valid response from apiPricesGet', async () => {
    const response: ApiPricesGet200Response = await api.apiPricesGet({ dust: "1" });

    expect(response).toBeDefined();
    expect(response.prices).toBeDefined();
  });
});
