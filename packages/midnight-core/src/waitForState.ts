import * as Rx from 'rxjs';
import type { FacadeState } from '@midnight-ntwrk/wallet-sdk-facade';

/** Wait for a synced wallet state matching an optional predicate. */
export function waitForState(
  state$: Rx.Observable<FacadeState>,
  predicate: (s: FacadeState) => boolean = () => true
): Promise<FacadeState> {
  return Rx.firstValueFrom(state$.pipe(Rx.filter((s) => s.isSynced && predicate(s))));
}
