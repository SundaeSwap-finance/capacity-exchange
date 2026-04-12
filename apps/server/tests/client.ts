import { ErrorResponse } from '../src/models/common';
import { HealthResponse, ReadyResponse } from '../src/models/health';
import { CreateOfferRequest, CreateOfferResponse } from '../src/models/offer';
import { PricesResponse } from '../src/models/prices';
import { RootResponse } from '../src/models/root';

export { CreateOfferResponse } from '../src/models/offer';
export { PricesResponse } from '../src/models/prices';

export interface ApiResponse<T> {
  status: number;
  data: T;
}

// TODO: Provide a generated client
export class CapacityExchangeClient {
  constructor(private readonly baseUrl: string) {}

  async getRoot(): Promise<ApiResponse<typeof RootResponse.static>> {
    const response = await fetch(`${this.baseUrl}/`);
    const data = (await response.json()) as typeof RootResponse.static;
    console.debug(`GET / -> ${response.status}`, data);
    return { status: response.status, data };
  }

  async getHealth(): Promise<ApiResponse<typeof HealthResponse.static>> {
    const response = await fetch(`${this.baseUrl}/health`);
    const data = (await response.json()) as typeof HealthResponse.static;
    console.debug(`GET /health -> ${response.status}`, data);
    return { status: response.status, data };
  }

  async getReadiness(): Promise<ApiResponse<typeof ReadyResponse.static>> {
    const response = await fetch(`${this.baseUrl}/health/ready`);
    const data = (await response.json()) as typeof ReadyResponse.static;
    console.debug(`GET /health/ready -> ${response.status}`, data);
    return { status: response.status, data };
  }

  async getPrices(
    specks: string,
  ): Promise<ApiResponse<typeof PricesResponse.static | typeof ErrorResponse.static>> {
    const response = await fetch(`${this.baseUrl}/api/prices?currency=DUST&amount=${specks}`);
    const data = (await response.json()) as
      | typeof PricesResponse.static
      | typeof ErrorResponse.static;
    console.debug(`GET /api/prices?currency=DUST&amount=${specks} -> ${response.status}`, data);
    return { status: response.status, data };
  }

  async createOffer(
    request: typeof CreateOfferRequest.static,
  ): Promise<ApiResponse<typeof CreateOfferResponse.static | typeof ErrorResponse.static>> {
    const response = await fetch(`${this.baseUrl}/api/offers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    const data = (await response.json()) as
      | typeof CreateOfferResponse.static
      | typeof ErrorResponse.static;
    console.debug(`POST /api/offers -> ${response.status}`, data);
    return { status: response.status, data };
  }
}
