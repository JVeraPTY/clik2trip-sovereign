import { policyDenialCodes } from '@clik2trip/policy-engine';
import { settlementDenialCodes } from '@clik2trip/usdt-verifier';
import { describe, expect, it } from 'vitest';

import { hasReadableMessage, toReadableError } from './error-messages';

describe('readable errors', () => {
  it('covers every deterministic denial code the app can surface', () => {
    const uncovered = [...policyDenialCodes, ...settlementDenialCodes].filter(
      (code) => !hasReadableMessage(code),
    );

    expect(uncovered).toEqual([]);
  });

  it('unwraps the JSON envelope WDK and the bundler throw', () => {
    const raw = JSON.stringify({
      code: 'BUNDLER_ERROR',
      message: 'bundler eth_estimateUserOperationGas rpc call failed',
      error: 'bundler eth_estimateUserOperationGas rpc call failed',
    });

    expect(toReadableError(raw)).toEqual({
      code: 'BUNDLER_ERROR',
      message: 'El servicio de red no respondió. Vuelve a intentarlo.',
    });
  });

  it('keeps the original identifier alongside the sentence', () => {
    const readable = toReadableError('SALDO_USDT_PRUEBA_INSUFICIENTE');

    expect(readable.code).toBe('SALDO_USDT_PRUEBA_INSUFICIENTE');
    expect(readable.message).toContain('USD₮ de prueba');
  });

  it('falls back without losing an unmapped or malformed error', () => {
    expect(toReadableError('Invalid key provided to SecureStore.')).toEqual({
      code: 'Invalid key provided to SecureStore.',
      message: 'Algo no salió como esperábamos. El detalle técnico está abajo.',
    });
    expect(toReadableError('{"not":"json-with-code"}').code).toBe('{"not":"json-with-code"}');
    expect(toReadableError('{broken').code).toBe('{broken');
  });
});
