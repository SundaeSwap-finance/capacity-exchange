import { describe, expect, it } from 'vitest';
import { SUPPORTED_NETWORK_IDS } from '@sundaeswap/capacity-exchange-core';
import { parseAppConfig } from '../src/config/appConfig';

describe('parseAppConfig', () => {
  it.each(SUPPORTED_NETWORK_IDS)('accepts %s', (networkId) => {
    expect(parseAppConfig({ networkId })).toEqual({ networkId });
  });

  it('drops keys it does not know', () => {
    expect(parseAppConfig({ networkId: 'preview', extra: 1 })).toEqual({ networkId: 'preview' });
  });

  it('keeps the dev overrides', () => {
    const config = {
      networkId: 'undeployed',
      capacityExchangeUrl: 'http://localhost:3000',
      proofServerUrl: 'http://127.0.0.1:6300',
      mockDemo: true,
    };
    expect(parseAppConfig(config)).toEqual(config);
  });

  it.each([{ capacityExchangeUrl: 'not a url' }, { capacityExchangeUrl: '' }, { proofServerUrl: 6300 }])(
    'rejects a malformed url in %j',
    (override) => {
      expect(() => parseAppConfig({ networkId: 'preview', ...override })).toThrow(/Must be a URL/);
    }
  );

  it('rejects a mockDemo that is not a boolean', () => {
    expect(() => parseAppConfig({ networkId: 'preview', mockDemo: 'true' })).toThrow(/Must be a boolean/);
  });

  // A page whose placeholder was never filled fails to parse its config script, so the
  // assignment never runs and the config arrives unset.
  it.each([undefined, null, 'preview'])('names interpolation when the config is %j', (raw) => {
    expect(() => parseAppConfig(raw)).toThrow(/interpolated/);
  });

  it.each([{}, { networkId: 'testnet' }, { networkId: 1 }])('rejects networkId in %j', (raw) => {
    expect(() => parseAppConfig(raw)).toThrow(/Invalid networkId/);
  });
});
