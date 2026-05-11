export type AgentWalletOptions = {
  baseUrl: string;
  apiKey: string;
  fetch?: typeof fetch;
};

export type AgentWalletPaymentInput = {
  recipient: string;
  amount: string;
  tokenMint?: string;
  decimals?: number;
  policyPda?: string;
  programId?: string;
};

export type AgentWalletPaymentResult = {
  ok: true;
  cluster: "devnet";
  agent: string;
  policyPda: string;
  tokenMint: string;
  amount: string;
  signature: string;
  explorerUrl: string;
  agentTokenAccount: string;
  recipientTokenAccount: string;
};

export type X402PaymentRequired = {
  x402Version: string;
  accepts: Array<{
    scheme: string;
    network: string;
    asset: string;
    payTo: string;
    amount: string;
    decimals?: number;
    resource?: string;
  }>;
};

export class AgentWallet {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(options: AgentWalletOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetcher = options.fetch ?? fetch;
  }

  async pay(input: AgentWalletPaymentInput): Promise<AgentWalletPaymentResult> {
    const response = await this.fetcher(`${this.baseUrl}/api/agent-wallet/pay`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(input)
    });

    return parseJsonResponse<AgentWalletPaymentResult>(response);
  }

  async getAgent() {
    const response = await this.fetcher(`${this.baseUrl}/api/agent-wallet/me`, {
      headers: { authorization: `Bearer ${this.apiKey}` }
    });
    return parseJsonResponse(response);
  }

  async getAudit() {
    const response = await this.fetcher(`${this.baseUrl}/api/agent-wallet/audit`, {
      headers: { authorization: `Bearer ${this.apiKey}` }
    });
    return parseJsonResponse(response);
  }

  async fetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const firstResponse = await this.fetcher(input, init);

    if (firstResponse.status !== 402) {
      return firstResponse;
    }

    const encodedRequired = firstResponse.headers.get("PAYMENT-REQUIRED");
    if (!encodedRequired) {
      return firstResponse;
    }

    const paymentRequired = decodeHeader<X402PaymentRequired>(encodedRequired);
    const requirement = paymentRequired.accepts[0];

    if (!requirement) {
      return firstResponse;
    }

    const payment = await this.pay({
      recipient: requirement.payTo,
      amount: requirement.amount,
      tokenMint: requirement.asset,
      decimals: requirement.decimals
    });

    const paymentPayload = encodeHeader({
      x402Version: paymentRequired.x402Version,
      scheme: requirement.scheme,
      network: requirement.network,
      payload: {
        transaction: payment.signature,
        policyPda: payment.policyPda,
        agent: payment.agent
      }
    });

    return this.fetcher(input, {
      ...init,
      headers: {
        ...(headersToObject(init.headers)),
        "PAYMENT-SIGNATURE": paymentPayload
      }
    });
  }
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(typeof body?.error === "string" ? body.error : "AgentWallet request failed.");
  }

  return body as T;
}

function encodeHeader(value: unknown) {
  return btoa(JSON.stringify(value));
}

function decodeHeader<T>(value: string): T {
  return JSON.parse(atob(value)) as T;
}

function headersToObject(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers;
}
