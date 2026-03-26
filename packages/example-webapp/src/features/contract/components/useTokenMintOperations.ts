import { useCallback, useState } from "react";
import {
  deriveTokenColor,
  getShieldedBalance,
  sendShieldedTokens,
} from "@capacity-exchange/midnight-core";
import { sponsoredTransactionsWalletProvider } from "@capacity-exchange/components";
import { findAndMintTokens } from "../../ces/tokenMintContract";
import { useSubmit } from "../../../lib/hooks/useSubmit";
import { useNetworkConfig } from "../../../config";
import type { TokenMintConfig } from "../hooks/useContractsConfig";
import type { WalletCapabilities } from "../../wallet/types";
import {
  MidnightBech32m,
  ShieldedAddress,
} from "@midnight-ntwrk/wallet-sdk-address-format";
import type { ServerWallet } from "../../faucet";

export function useTokenMintOperations(
  config: TokenMintConfig,
  wallet: WalletCapabilities | null,
  serverWallet: ServerWallet,
) {
  const networkConfig = useNetworkConfig();
  const [balance, setBalance] = useState<string | null>(null);
  const [sendTxHash, setSendTxHash] = useState<string | null>(null);
  const [mintAmount, setMintAmount] = useState(1000);
  const [sendAmount, setSendAmount] = useState(1000);
  const { run, state } = useSubmit();

  const serverReady = serverWallet.status === "ready";
  const derivedColor = deriveTokenColor(
    config.tokenColor,
    config.contractAddress,
  );

  const handleMint = useCallback(async () => {
    if (
      mintAmount <= 0 || !serverWallet.midnightProvider ||
      !serverWallet.walletProvider
    ) {
      return;
    }

    const walletProvider = sponsoredTransactionsWalletProvider({
      walletProvider: wallet!,
      capacityExchangeUrl: networkConfig.capacityExchangeUrl,
    });

    await run("Minting", () =>
      findAndMintTokens(
        serverWallet.midnightProvider!,
        walletProvider,
        config.contractAddress,
        BigInt(mintAmount),
        networkConfig,
      ));
  }, [config, mintAmount, serverWallet, networkConfig, run]);

  const handleVerify = useCallback(async () => {
    if (!serverWallet.walletFacade) {
      return;
    }

    await run(
      "Checking balance",
      async () => {
        const bal = await getShieldedBalance(
          serverWallet.walletFacade!,
          derivedColor,
        );
        return bal.toString();
      },
      setBalance,
    );
  }, [derivedColor, serverWallet, run]);

  const handleSend = useCallback(async () => {
    if (
      !wallet || !serverWallet.walletFacade || !serverWallet.keys ||
      sendAmount <= 0
    ) {
      return;
    }

    const { shieldedAddress } = await wallet.getShieldedAddresses();

    await run(
      "Sending",
      () =>
        sendShieldedTokens(serverWallet.walletFacade!, serverWallet.keys!, [
          {
            type: derivedColor,
            receiverAddress: MidnightBech32m.parse(shieldedAddress).decode(
              ShieldedAddress,
              networkConfig.networkId,
            ),
            amount: BigInt(sendAmount),
          },
        ]),
      setSendTxHash,
    );
  }, [derivedColor, wallet, serverWallet, sendAmount, run]);

  return {
    state,
    balance,
    sendTxHash,
    mintAmount,
    setMintAmount,
    sendAmount,
    setSendAmount,
    handleMint,
    handleVerify,
    handleSend,
    serverReady,
  };
}
