import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { getJsonRpcFullnodeUrl, SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  buildSuiPolicyBootstrapPlan,
  buildSuiPolicyRevokePlan,
  buildSuiVaultDepositPlan,
  buildSuiVaultBootstrapPlan,
  formatSuiBootstrapResult,
  parseSuiPolicyBootstrapConfig,
  parseSuiPolicyRevokeConfig,
  parseSuiVaultDepositConfig,
  parseSuiVaultBootstrapConfig,
  runSuiPlan
} from "./sui-bootstrap";

type OwnerAction = "create-policy" | "create-vault" | "fund-vault" | "revoke-policy";

async function main() {
  const action = parseAction(process.argv[2]);
  const privateKey = process.env.SUI_OWNER_PRIVATE_KEY?.trim();

  if (!privateKey) {
    throw new Error("Missing Sui owner env: SUI_OWNER_PRIVATE_KEY");
  }

  const decoded = decodeSuiPrivateKey(privateKey);

  if (decoded.scheme !== "ED25519") {
    throw new Error(`Unsupported Sui private key schema: ${decoded.scheme}. Use an ED25519 key.`);
  }

  const { network, plan, label } = buildActionPlan(action);
  const signer = Ed25519Keypair.fromSecretKey(decoded.secretKey);
  const typedNetwork = network as "testnet" | "mainnet" | "devnet" | "localnet";
  const client = new SuiJsonRpcClient({
    network: typedNetwork,
    url: getJsonRpcFullnodeUrl(typedNetwork)
  });
  const result = await runSuiPlan({ client, signer, plan, network });

  console.log(formatSuiBootstrapResult(label, result));

  if (!result.ok) {
    process.exitCode = 1;
  }
}

function buildActionPlan(action: OwnerAction) {
  if (action === "create-policy") {
    const config = parseSuiPolicyBootstrapConfig(process.env);
    return {
      network: config.network,
      label: "create policy",
      plan: buildSuiPolicyBootstrapPlan(config)
    };
  }

  if (action === "create-vault") {
    const config = parseSuiVaultBootstrapConfig(process.env);
    return {
      network: config.network,
      label: "create vault",
      plan: buildSuiVaultBootstrapPlan(config)
    };
  }

  if (action === "fund-vault") {
    const config = parseSuiVaultDepositConfig(process.env);
    return {
      network: config.network,
      label: "fund vault",
      plan: buildSuiVaultDepositPlan(config)
    };
  }

  const config = parseSuiPolicyRevokeConfig(process.env);
  return {
    network: config.network,
    label: "revoke policy",
    plan: buildSuiPolicyRevokePlan(config)
  };
}

function parseAction(value: string | undefined): OwnerAction {
  if (
    value === "create-policy" ||
    value === "create-vault" ||
    value === "fund-vault" ||
    value === "revoke-policy"
  ) {
    return value;
  }

  throw new Error(
    "Usage: npm run sui:owner -w @agentwallet/sdk -- <create-policy|create-vault|fund-vault|revoke-policy>"
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
