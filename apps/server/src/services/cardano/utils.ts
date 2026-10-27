import { Slot, Transaction } from '@capacity-exchange/cardano-core';

// The deepest rollback the service can undo: mainnet's security parameter k.
// A deeper one stops the service, since its history does not reach back that far.
export const MAX_ROLLBACK_DEPTH = 2160;

interface State<T> {
  slot: Slot;
  value: T;
}
export abstract class ChainIndex<T> {
  #states: State<T>[] = [];

  constructor(startSlot: Slot, startValue: T) {
    this.#states.push({ slot: startSlot, value: startValue });
  }

  currentValue(): T {
    return this.#states[this.#states.length - 1].value;
  }

  applyTransaction(slot: Slot, tx: Transaction) {
    const lastState = this.#states[this.#states.length - 1];
    if (lastState.slot === slot) {
      this.doApplyTransaction(tx, lastState.value);
    } else {
      const newState = { slot, value: this.copyValue(lastState.value) };
      this.doApplyTransaction(tx, newState.value);
      this.#states.push(newState);
      // One state more keeps the one before a rollback of the full depth.
      if (this.#states.length > MAX_ROLLBACK_DEPTH + 1) {
        this.#states.shift();
      }
    }
  }

  rollBack(slot: Slot) {
    while (this.#states.length && this.#states[this.#states.length - 1].slot > slot) {
      this.#states.pop();
    }
    if (!this.#states.length) {
      throw new Error(`Rolled back too far (to slot ${slot})`);
    }
  }

  protected abstract doApplyTransaction(tx: Transaction, value: T): void;
  protected abstract copyValue(old: T): T;
}
