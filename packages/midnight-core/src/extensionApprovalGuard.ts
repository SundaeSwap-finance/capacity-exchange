import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

/**
 * Time to leave between two approval-requiring calls, so the wallet's popup
 * window from the previous call has actually gone away first.
 */
const DEFAULT_SETTLE_DELAY_MS = 1000;

/**
 * A rejection that arrives faster than this was not a person clicking "deny" —
 * it is the wallet resolving the request against a popup that was already closing.
 */
const DEFAULT_IMMEDIATE_REJECTION_WINDOW_MS = 750;

const DEFAULT_MAX_RETRIES = 1;

/** Methods that make the wallet ask the user for approval. */
const APPROVAL_METHODS = ['balanceUnsealedTransaction', 'balanceSealedTransaction', 'makeTransfer'] as const;

export interface ExtensionApprovalRetryInfo {
  method: string;
  /** 1 for the first retry. */
  attempt: number;
  /** How long the rejected call took before failing. */
  elapsedMs: number;
  error: unknown;
}

export interface ExtensionApprovalGuardOptions {
  /** Gap to leave after an approval-requiring call before starting the next one. */
  settleDelayMs?: number;
  /** Rejections faster than this are treated as spurious and retried. */
  immediateRejectionWindowMs?: number;
  /** How many times to retry a spurious rejection. Defaults to 1. */
  maxRetries?: number;
  onRetry?: (info: ExtensionApprovalRetryInfo) => void;
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Recognises the wallet's "user rejected" error across the extension messaging
 * boundary, where the error may arrive as a plain object rather than an instance
 * of the connector's own `APIError` class.
 */
function isRejectionError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) {
    return false;
  }
  const { code, message, reason } = err as { code?: unknown; message?: unknown; reason?: unknown };
  if (code === 'Rejected' || code === 'PermissionRejected') {
    return true;
  }
  const text = [message, reason].filter((value): value is string => typeof value === 'string').join(' ');
  return /reject/i.test(text);
}

/**
 * Works around a popup-teardown race in the Midnight dapp connector.
 *
 * Lace opens one popup window per confirmation location and only forgets about
 * it once the window has actually been removed by the browser. Its confirmation
 * side effect latches onto whichever prove-transaction view is in its store when
 * the request arrives — a replayed value — and then resolves the request as
 * *rejected* as soon as that view disappears.
 *
 * A capacity exchange transaction needs two approvals back to back
 * (`balanceUnsealedTransaction`, then `balanceSealedTransaction`) with only local
 * transaction work in between. The second request therefore routinely reaches the
 * wallet while the first popup is still closing: it latches onto the dying popup,
 * never renders a prompt, and fails immediately with "User rejected transaction"
 * even though the user approved everything they were shown.
 *
 * This wrapper avoids that from the dapp side by
 *   1. serialising approval-requiring calls, so two can never be in flight at once,
 *   2. leaving {@link ExtensionApprovalGuardOptions.settleDelayMs} after each one
 *      to give the popup time to finish closing, and
 *   3. retrying a rejection that came back too fast to have been a real person.
 *
 * Read-only methods (balances, addresses, configuration) are passed straight
 * through — they need no approval and must not be delayed.
 */
export function withExtensionApprovalGuard(
  api: ConnectedAPI,
  options: ExtensionApprovalGuardOptions = {}
): ConnectedAPI {
  const {
    settleDelayMs = DEFAULT_SETTLE_DELAY_MS,
    immediateRejectionWindowMs = DEFAULT_IMMEDIATE_REJECTION_WINDOW_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    onRetry,
  } = options;

  // Tail of the queue of approval-requiring calls, and when the last one settled.
  let queue: Promise<unknown> = Promise.resolve();
  let lastSettledAt: number | null = null;

  const waitForPopupToSettle = async (): Promise<void> => {
    if (lastSettledAt === null) {
      return;
    }
    const remaining = settleDelayMs - (Date.now() - lastSettledAt);
    if (remaining > 0) {
      await delay(remaining);
    }
  };

  const runGuarded = async <T>(method: string, call: () => Promise<T>): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      await waitForPopupToSettle();

      const startedAt = Date.now();
      try {
        const result = await call();
        lastSettledAt = Date.now();
        return result;
      } catch (err) {
        lastSettledAt = Date.now();
        const elapsedMs = lastSettledAt - startedAt;
        const spurious = isRejectionError(err) && elapsedMs <= immediateRejectionWindowMs;
        if (!spurious || attempt >= maxRetries) {
          throw err;
        }
        onRetry?.({ method, attempt: attempt + 1, elapsedMs, error: err });
      }
    }
  };

  const enqueue = <T>(method: string, call: () => Promise<T>): Promise<T> => {
    const result = queue.then(() => runGuarded(method, call));
    // Swallow failures on the queue itself so one rejected approval does not
    // poison every later call; callers still see the original rejection.
    queue = result.catch((): void => undefined);
    return result;
  };

  // A Proxy keeps every other method — including ones added by newer connector
  // versions — working, and binds to the original so private fields stay reachable.
  return new Proxy(api, {
    get(target, property) {
      // Receiver is deliberately the target, not the proxy, so getters on
      // class-based implementations can still reach their private fields.
      const value = Reflect.get(target, property, target) as unknown;
      if (typeof value !== 'function') {
        return value;
      }
      const method = value.bind(target) as (...args: unknown[]) => Promise<unknown>;
      if (!APPROVAL_METHODS.includes(property as (typeof APPROVAL_METHODS)[number])) {
        return method;
      }
      return (...args: unknown[]) => enqueue(String(property), () => method(...args));
    },
  });
}
