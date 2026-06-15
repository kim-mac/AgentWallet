import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { getJsonRpcFullnodeUrl, SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  formatSuiDeepBookBalanceManagerResult,
  parseSuiDeepBookBalanceManagerConfig,
  runSuiDeepBookBalanceManager
} from "./sui-deepbook";

type DeepBookAction = "create-balance-manager";

async function main() {
  const action = parseAction(process.argv[2]);
  const privateKey = process.env.SUI_AGENT_PRIVATE_KEY?.trim() || process.env.SUI_OWNER_PRIVATE_KEY?.trim();

  if (!privateKey) {
    throw new Error("Missing Sui signer env: SUI_AGENT_PRIVATE_KEY or SUI_OWNER_PRIVATE_KEY");
  }

  const decoded = decodeSuiPrivateKey(privateKey);

  if (decoded.scheme !== "ED25519") {
    throw new Error(`Unsupported Sui private key schema: ${decoded.scheme}. Use an ED25519 key.`);
  }

  if (action === "create-balance-manager") {
    const config = parseSuiDeepBookBalanceManagerConfig(process.env);
    const signer = Ed25519Keypair.fromSecretKey(decoded.secretKey);
    const network = config.network as "testnet" | "mainnet" | "devnet" | "localnet";
    const client = new SuiJsonRpcClient({
      network,
      url: getJsonRpcFullnodeUrl(network)
    });
    const result = await runSuiDeepBookBalanceManager({ client, signer, config });

    console.log(formatSuiDeepBookBalanceManagerResult(result));

    if (!result.ok) {
      process.exitCode = 1;
    }
  }
}

function parseAction(value: string | undefined): DeepBookAction {
  if (value === "create-balance-manager") {
    return value;
  }

  throw new Error("Usage: npm run sui:deepbook -w @agentwallet/sdk -- <create-balance-manager>");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
