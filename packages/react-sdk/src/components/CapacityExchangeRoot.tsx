import { PropsWithChildren, useEffect, useReducer, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ConfirmOfferProps, DefaultConfirmOffer } from './ConfirmOffer';
import { DefaultPromptForCurrency, PromptForCurrencyProps } from './PromptForCurrency';
import { CapacityExchangeContext } from '../stores/CapacityExchangeContext/context';
import { capacityExchangeReducer } from '../stores/CapacityExchangeContext/reducer';
import { injectStyles } from '../styles';
import { WaitForOfferProps, DefaultWaitForOffer } from './WaitForOffer';

injectStyles();

interface CapacityExchangeRootProps {
  PromptForCurrency?: React.FC<PromptForCurrencyProps>;
  WaitForOffer?: React.FC<WaitForOfferProps>;
  ConfirmOffer?: React.FC<ConfirmOfferProps>;
}

export function CapacityExchangeRoot(props: PropsWithChildren<CapacityExchangeRootProps>) {
  const {
    PromptForCurrency = DefaultPromptForCurrency,
    WaitForOffer = DefaultWaitForOffer,
    ConfirmOffer = DefaultConfirmOffer,
  } = props;
  const [state, dispatch] = useReducer(capacityExchangeReducer, { status: 'idle' });
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (state.status !== 'idle') {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [state.status]);

  return (
    <CapacityExchangeContext.Provider value={{ state, dispatch }}>
      {props.children}
      {createPortal(
        <dialog ref={dialogRef} data-ce-sdk>
          {state.status === 'prompting-for-currency' && (
            <PromptForCurrency
              prices={state.prices}
              dustRequired={state.dustRequired}
              onSelected={state.onSelected}
              onCancelled={state.onCancelled}
            />
          )}
          {state.status === 'waiting-for-offer' && (
            <WaitForOffer price={state.price} dustRequired={state.dustRequired} onCancelled={state.onCancelled} />
          )}
          {state.status === 'confirming-offer' && (
            <ConfirmOffer
              offer={state.offer}
              dustRequired={state.dustRequired}
              onConfirmed={state.onConfirmed}
              onBack={state.onBack}
              onCancelled={state.onCancelled}
            />
          )}
        </dialog>,
        document.body
      )}
    </CapacityExchangeContext.Provider>
  );
}
