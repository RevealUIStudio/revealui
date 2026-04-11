/**
 * Lightweight Solana JSON-RPC helpers for the RevealCoin app.
 *
 * Uses direct fetch() to avoid pulling in heavy SDK dependencies.
 * Only used in API routes (server-side), never in the browser.
 */

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

interface RpcResponse<T> {
  jsonrpc: string;
  id: number;
  result: T;
  error?: { code: number; message: string };
}

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });

  if (!res.ok) {
    throw new Error(`Solana RPC error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as RpcResponse<T>;
  if (data.error) {
    throw new Error(`Solana RPC: ${data.error.message}`);
  }

  return data.result;
}

export interface TokenSupply {
  amount: string;
  decimals: number;
  uiAmount: number;
  uiAmountString: string;
}

export async function getTokenSupply(mintAddress: string): Promise<TokenSupply> {
  const result = await rpcCall<{ context: unknown; value: TokenSupply }>('getTokenSupply', [
    mintAddress,
  ]);
  return result.value;
}

interface TokenAccountInfo {
  parsed: {
    info: {
      tokenAmount: {
        amount: string;
        decimals: number;
        uiAmount: number;
        uiAmountString: string;
      };
    };
  };
}

interface TokenAccount {
  account: { data: TokenAccountInfo };
  pubkey: string;
}

export interface WalletBalance {
  wallet: string;
  balance: number;
  raw: string;
}

export async function getTokenBalance(
  walletAddress: string,
  mintAddress: string,
): Promise<WalletBalance> {
  const result = await rpcCall<{ value: TokenAccount[] }>('getTokenAccountsByOwner', [
    walletAddress,
    { mint: mintAddress },
    { encoding: 'jsonParsed' },
  ]);

  if (result.value.length === 0) {
    return { wallet: walletAddress, balance: 0, raw: '0' };
  }

  const account = result.value[0];
  if (!account) {
    return { wallet: walletAddress, balance: 0, raw: '0' };
  }
  const tokenAmount = account.account.data.parsed.info.tokenAmount;

  return {
    wallet: walletAddress,
    balance: tokenAmount.uiAmount,
    raw: tokenAmount.amount,
  };
}
