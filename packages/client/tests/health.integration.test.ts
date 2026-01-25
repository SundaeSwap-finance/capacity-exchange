import { HealthGet200Response } from '@client/models/HealthGet200Response';
import { HealthReadyGet200Response } from '@client/models/HealthReadyGet200Response';
import { getApi } from './api';

describe('Health API', () => {
  const api = getApi();

  it('should get a valid response from healthGet', async () => {
    const response: HealthGet200Response = await api.healthGet();

    expect(response).toBeDefined();
    expect(response.status).toEqual('ok');
    expect(response.uptime).toBeDefined();
  });

  it('should get a valid response from healthReadyGet', async () => {
    const response: HealthReadyGet200Response = await api.healthReadyGet();

    expect(response).toBeDefined();
    expect(response.status).toBeDefined();
  });
});
