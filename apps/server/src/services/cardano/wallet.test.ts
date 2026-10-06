import { Code, ConnectError } from '@connectrpc/connect';
import { describe, expect, it, vi } from 'vitest';
import { submitUntilSettled } from './wallet.js';

const timedOut = () => new ConnectError('The operation timed out.', Code.Internal);
const refused = (message: string) => new ConnectError(message, Code.InvalidArgument);

function run(outcomes: (Error | undefined)[], landed = false) {
  const submit = vi.fn(async () => {
    const outcome = outcomes.shift();
    if (outcome) {
      throw outcome;
    }
  });
  const sleep = vi.fn(async () => {});
  const landedFn = vi.fn(async () => landed);
  return {
    submit,
    sleep,
    landed: landedFn,
    settle: () => submitUntilSettled({ submit, landed: landedFn, sleep, delaysMs: [2_000, 5_000] }),
  };
}

describe('submitUntilSettled', () => {
  it('retries a submission that timed out', async () => {
    const r = run([timedOut(), undefined]);
    await r.settle();
    expect(r.submit).toHaveBeenCalledTimes(2);
    expect(r.sleep).toHaveBeenCalledWith(2_000);
  });

  it('gives up after the last delay', async () => {
    const r = run([timedOut(), timedOut(), timedOut()]);
    await expect(r.settle()).rejects.toThrow('timed out');
    expect(r.submit).toHaveBeenCalledTimes(3);
  });

  it('takes a refusal of the first attempt as final', async () => {
    const r = run([refused('could not process tx: invalid tx: bad')], true);
    await expect(r.settle()).rejects.toThrow('invalid tx');
    expect(r.landed).not.toHaveBeenCalled();
  });

  it('counts a duplicate after a timed-out attempt as submitted', async () => {
    const r = run([timedOut(), refused('could not process tx: duplicate tx')]);
    await r.settle();
    expect(r.landed).not.toHaveBeenCalled();
  });

  it('counts a refusal after a timed-out attempt as submitted once the transaction has landed', async () => {
    await run([timedOut(), refused('could not process tx: inputs spent')], true).settle();

    const r = run([timedOut(), refused('could not process tx: inputs spent')], false);
    await expect(r.settle()).rejects.toThrow('inputs spent');
  });
});
