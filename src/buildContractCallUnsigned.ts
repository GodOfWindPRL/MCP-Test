import { TronWeb } from 'tronweb';
import { resolveFullHost } from './env.js';
import { isBase58TronAddress } from './tronGridRead.js';

export interface BuildContractCallUnsignedParameter {
  type: string;
  value: unknown;
}

export interface BuildContractCallUnsignedInput {
  /** Caller / issuer (owner_address) base58 */
  fromAddress: string;
  contractAddress: string;
  /**
   * Ví dụ: `transfer(address,uint256)` hoặc selector thuần như `transfer(address,uint256)`
   * (TronWeb sẽ tự strip whitespace cho functionSelector).
   */
  functionSelector: string;
  parameters?: BuildContractCallUnsignedParameter[];
  /**
   * feeLimit trong SUN (integer digits string).
   */
  feeLimitSun?: string;
  /**
   * callValue trong SUN (integer digits string).
   */
  callValueSun?: string;
}

export interface BuildContractCallUnsignedResult {
  fullHost: string;
  unSignedTransaction: unknown;
}

export async function buildContractCallUnsigned(
  input: BuildContractCallUnsignedInput,
): Promise<BuildContractCallUnsignedResult> {
  const fullHost = resolveFullHost();
  const tw = new TronWeb({ fullHost });

  const from = input.fromAddress.trim();
  const contractAddress = input.contractAddress.trim();

  if (!isBase58TronAddress(from)) throw new Error('Invalid fromAddress base58 address.');
  if (!isBase58TronAddress(contractAddress)) throw new Error('Invalid contractAddress base58 address.');

  const functionSelector = input.functionSelector.trim();
  if (!functionSelector) throw new Error('functionSelector is required.');

  const parameters = input.parameters ?? [];

  const options: { feeLimit?: number; callValue?: number } = {};
  if (input.feeLimitSun !== undefined) {
    const s = input.feeLimitSun.trim();
    if (!/^\d+$/.test(s)) throw new Error('feeLimitSun must be positive integer digits (SUN).');
    options.feeLimit = Number(s);
  }
  if (input.callValueSun !== undefined) {
    const s = input.callValueSun.trim();
    if (!/^\d+$/.test(s)) throw new Error('callValueSun must be positive integer digits (SUN).');
    options.callValue = Number(s);
  }

  const wrapper = await (tw.transactionBuilder as any).triggerSmartContract(
    contractAddress,
    functionSelector,
    options,
    parameters,
    from,
  );

  const unSignedTransaction = wrapper?.transaction ?? wrapper;
  return { fullHost, unSignedTransaction };
}

