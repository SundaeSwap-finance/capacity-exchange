import { parseEnvelope } from '@capacity-exchange/cardano-core';

export interface OfferResponse {
  offerId: string;
}

export type CreateOfferResult = { status: 'ok'; response: OfferResponse } | OfferError;

export type OfferError =
  { status: 'malformed'; reason: string } | { status: 'unsupported-version' };

export class CardanoOfferService {
  async createOffer(envelope: Uint8Array): Promise<CreateOfferResult> {
    const parseResult = parseEnvelope(envelope);
    if (parseResult.status !== 'ok') {
      return parseResult;
    }

    throw new Error('todo');
  }
}
