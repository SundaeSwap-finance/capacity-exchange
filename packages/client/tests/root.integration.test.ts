import { Get200Response } from '@client/models/Get200Response';
import { getApi } from './api';

describe('Root API', () => {
  const api = getApi();

  it('should be able to connect to the service and get a valid response from rootGet', async () => {
    const response: Get200Response = await api.rootGet();

    expect(response).toBeDefined();
    expect(response.name).toBeDefined();
    expect(response.version).toBeDefined();
    expect(response.env).toBeDefined();
  });
});
