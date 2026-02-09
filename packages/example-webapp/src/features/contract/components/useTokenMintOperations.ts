import { useState, useCallback } from 'react';
import { tokenMintApi, type TokenMintVerifyResult, type TokenMintSendResult } from '../api';
import { useContractOperation } from '../hooks/useContractOperation';
import type { TokenMintConfig } from '../hooks/useContractsConfig';
import type { WalletCapabilities } from '../../wallet/types';

export function useTokenMintOperations(networkId: string, config: TokenMintConfig, wallet: WalletCapabilities | null) {
  const [verifyResult, setVerifyResult] = useState<TokenMintVerifyResult | null>(null);
  const [sendResult, setSendResult] = useState<TokenMintSendResult | null>(null);
  const [mintAmount, setMintAmount] = useState(1000);
  const [sendAmount, setSendAmount] = useState(1000);
  const [state, { runOperation }] = useContractOperation();

  const handleMint = useCallback(async () => {
    if (mintAmount <= 0) {
      return;
    }

    await runOperation(
      'Minting',
      (callbacks) => tokenMintApi.mint(networkId, config.contractAddress, config.privateStateId, mintAmount, callbacks),
      () => {}
    );
  }, [networkId, config, mintAmount, runOperation]);

  const handleVerify = useCallback(async () => {
    await runOperation(
      'Verifying',
      (callbacks) => tokenMintApi.verify(networkId, config.contractAddress, config.tokenColor, callbacks),
      setVerifyResult
    );
  }, [networkId, config, runOperation]);

  const handleSend = useCallback(async () => {
    if (!wallet || sendAmount <= 0) {
      return;
    }

    const { shieldedAddress } = await wallet.getShieldedAddresses();

    await runOperation(
      'Sending',
      (callbacks) =>
        tokenMintApi.send(networkId, config.contractAddress, config.tokenColor, shieldedAddress, sendAmount, callbacks),
      setSendResult
    );
  }, [networkId, config, wallet, sendAmount, runOperation]);

  return {
    state,
    verifyResult,
    sendResult,
    mintAmount,
    setMintAmount,
    sendAmount,
    setSendAmount,
    handleMint,
    handleVerify,
    handleSend,
  };
}
