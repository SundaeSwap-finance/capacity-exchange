import * as p from "@clack/prompts";
import { parseMnemonic } from "@capacity-exchange/midnight-core";
import process from "node:process";

/**
 * Resolves a mnemonic from (in priority order): CLI flag, env var, interactive prompt.
 * Returns the parsed seed bytes.
 */
export async function resolveMnemonic(
  mnemonicFlag?: string,
  json = false,
): Promise<Uint8Array> {
  const mnemonic = mnemonicFlag ?? process.env.MNEMONIC;

  if (mnemonic) {
    return parseMnemonic(mnemonic.trim());
  }

  if (json) {
    throw new Error(
      "Mnemonic required in JSON mode. Provide --mnemonic flag or MNEMONIC env var.",
    );
  }

  const result = await p.password({
    message: "Enter your BIP39 mnemonic:",
  });

  if (p.isCancel(result)) {
    process.exit(130);
  }

  return parseMnemonic(result.trim());
}
