import { ApiOffersPost201Response } from '@client/models/ApiOffersPost201Response';
import { ApiOffersPostRequest } from '@client/models/ApiOffersPostRequest';
import { getApi } from './api';

describe('Offers API', () => {
  const api = getApi();

  it('should be able to post an offer and get a valid response from apiOffersPost', async () => {
    const offer: ApiOffersPostRequest = {
      requestAmount: '10',
      offerCurrency: 'lovelace',
    };
    const response: ApiOffersPost201Response = await api.apiOffersPost({
      apiOffersPostRequest: offer,
    });

    expect(response).toBeDefined();
    expect(response.offerId).toBeDefined();
  });
});
