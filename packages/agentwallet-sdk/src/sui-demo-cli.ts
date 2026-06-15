import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { getJsonRpcFullnodeUrl, SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { formatSuiDemoResult, parseSuiDeepBookDemoConfig, runSuiDeepBookDemo } from "./sui-demo";

async function main() {
  const config = parseSuiDeepBookDemoConfig(process.env);
  const privateKey = process.env.SUI_AGENT_PRIVATE_KEY?.trim();

  if (!privateKey) {
    throw new Error("Missing Sui demo env: SUI_AGENT_PRIVATE_KEY");
  }

  const decoded = decodeSuiPrivateKey(privateKey);

  if (decoded.scheme !== "ED25519") {
    throw new Error(`Unsupported Sui private key schema: ${decoded.scheme}. Use an ED25519 key.`);
  }

  const signer = Ed25519Keypair.fromSecretKey(decoded.secretKey);
  const network = config.network as "testnet" | "mainnet" | "devnet" | "localnet";
  const client = new SuiJsonRpcClient({
    network,
    url: getJsonRpcFullnodeUrl(network)
  });
  const result = await runSuiDeepBookDemo({ config, client, signer });

  console.log(formatSuiDemoResult(result));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
