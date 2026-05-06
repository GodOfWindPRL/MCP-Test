import { z } from 'zod';

/** Đồng bộ với frontend relay: chỉ các action được phép. */
export const tronWalletActionTypeSchema = z.enum([
  'isReady',
  'getDefaultAddress',
  'getBalance',
  'getAccount',
  'getCurrentBlock',
  'signMessage',
  'signTransaction',
  'requestAccounts',
  'sendTrx',
  'sendToken',
]);

export type TronWalletActionType = z.infer<typeof tronWalletActionTypeSchema>;

export const tronWalletActionSchema = z.object({
  id: z.string().min(1),
  type: tronWalletActionTypeSchema,
  params: z.record(z.string(), z.any()).optional(),
});

export type TronWalletAction = z.infer<typeof tronWalletActionSchema>;

// ------------------------------
// Shared numeric parsing helpers
// ------------------------------

const TRX_DECIMALS = 6;

function trimToString(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'string') {
    const s = v.trim();
    return s ? s : undefined;
  }
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return undefined;
    // Avoid scientific notation that would break strict decimal parsing.
    const s = String(v);
    if (s.includes('e') || s.includes('E')) return undefined;
    return s.trim() || undefined;
  }
  const s = String(v).trim();
  return s ? s : undefined;
}

/** Parse positive integer string (no decimals) -> canonical digits string. */
function parsePositiveIntString(v: unknown): string | undefined {
  const s = trimToString(v);
  if (!s) return undefined;
  if (!/^\d+$/.test(s)) return undefined;
  const withoutLeadingZeros = s.replace(/^0+/, '') || '0';
  if (withoutLeadingZeros === '0') return undefined;
  return withoutLeadingZeros;
}

/** Parse human TRX (decimal string up to 6 decimals) -> sun (integer digits string). */
function parseTrxHumanToSun(v: unknown, decimals = TRX_DECIMALS): string | undefined {
  const s = trimToString(v);
  if (!s) return undefined;
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;

  const [intPartRaw, fracPartRaw = ''] = s.split('.');
  const intPart = intPartRaw.replace(/^0+/, '') || '0';
  if (intPart === '0' && fracPartRaw === '') return undefined;
  if (decimals < 0) return undefined;

  if (fracPartRaw.length > decimals) return undefined; // reject fractional precision overflow
  const fracPadded = fracPartRaw.padEnd(decimals, '0');

  const intBig = BigInt(intPart);
  const fracBig = fracPadded ? BigInt(fracPadded) : 0n;
  const sun = intBig * 10n ** BigInt(decimals) + fracBig;
  if (sun <= 0n) return undefined;
  return sun.toString();
}

/** Format sun digits string -> human decimal string (up to 6 decimals). */
function formatSunToTrx(sun: string, decimals = TRX_DECIMALS): string {
  const sunStr = sun.replace(/^0+/, '') || '0';
  if (sunStr === '0') return '0';
  const padded = sunStr.padStart(decimals + 1, '0');
  const intPart = padded.slice(0, padded.length - decimals);
  const fracPart = padded.slice(padded.length - decimals).replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

function parseTokenDecimals(v: unknown): number | undefined {
  const s = trimToString(v);
  if (!s) return undefined;
  const n = typeof v === 'number' ? v : Number(s);
  if (!Number.isFinite(n)) return undefined;
  // decimals must be integer
  if (!Number.isInteger(n)) return undefined;
  if (n < 0 || n > 36) return undefined;
  return n;
}

/**
 * Validate token human amount string is positive and uses <= `decimals` fractional digits.
 * Returns normalized human string (trim trailing zeros in fraction).
 */
function parseTokenHumanAmount(v: unknown, decimals: number): string | undefined {
  const s = trimToString(v);
  if (!s) return undefined;
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;

  const [intPartRaw, fracPartRaw = ''] = s.split('.');
  if (fracPartRaw.length > decimals) return undefined;

  const intPart = intPartRaw.replace(/^0+/, '') || '0';
  const fracPartPadded = fracPartRaw.padEnd(decimals, '0');

  const scaled =
    BigInt(intPart) * 10n ** BigInt(decimals) + (fracPartPadded ? BigInt(fracPartPadded) : 0n);
  if (scaled <= 0n) return undefined;

  const fracTrim = fracPartRaw.replace(/0+$/, '');
  return fracTrim ? `${intPart}.${fracTrim}` : intPart;
}

// --- tron_signMessage ---

export function resolveSignMessageInput(data: Record<string, unknown>): { message: string } | undefined {
  const raw = data.message ?? data.msg ?? data.text ?? data.payload;
  if (raw === undefined || raw === null) return undefined;
  const message = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  if (!message) return undefined;
  return { message };
}

export const tronSignMessageInputSchema = z
  .object({
    message: z.string().optional().describe('Nội dung cần ký (text hoặc hex tùy frontend/TronLink)'),
    msg: z.string().optional(),
    text: z.string().optional(),
    payload: z.string().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (resolveSignMessageInput(data as Record<string, unknown>)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cần message không rỗng (message | msg | text | payload).',
    });
  });

// --- tron_signTransaction ---

export function resolveUnSignedTransaction(data: Record<string, unknown>): { transaction: unknown } | undefined {
  const raw =
    data.unSignedTransaction ??
    data.unsignTransaction ??
    data.unsignedTransaction ??
    data.transaction;
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return undefined;
    try {
      return { transaction: JSON.parse(s) as unknown };
    } catch {
      return undefined;
    }
  }
  if (typeof raw === 'object') return { transaction: raw };
  return undefined;
}

export const tronSignTransactionInputSchema = z
  .object({
    unSignedTransaction: z
      .any()
      .optional()
      .describe(
        'Giao dịch chưa ký — object cùng tên/trị với output `unSignedTransaction` của tron_buildTrxTransferUnsigned',
      ),
    unsignTransaction: z.any().optional().describe('Alias của unSignedTransaction'),
    unsignedTransaction: z.any().optional(),
    transaction: z.any().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (resolveUnSignedTransaction(data as Record<string, unknown>)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Cần unSignedTransaction (object hoặc chuỗi JSON) — payload chưa ký cho tronWeb.trx.sign (ví dụ từ tron_buildTrxTransferUnsigned).',
    });
  });

// --- tron_getBalance / tron_getAccount: bắt buộc address — đọc TronGrid trên MCP, không delegate ---

export function resolveAddressInput(data: Record<string, unknown>): string | undefined {
  const raw = data.address ?? data.addr;
  if (raw === undefined || raw === null) return undefined;
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  return s || undefined;
}

export const tronGetBalanceInputSchema = z
  .object({
    address: z.string().optional().describe('Địa chỉ TRON base58 — bắt buộc'),
    addr: z.string().optional().describe('Alias của address'),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (resolveAddressInput(data as Record<string, unknown>)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Bắt buộc `address` (base58). MCP đọc số dư qua TronGrid — không qua TronLink. Nếu chưa có địa chỉ, lấy từ `tron_getAddress` trên app rồi gọi lại.',
    });
  });

export const tronGetAccountInputSchema = z
  .object({
    address: z.string().optional().describe('Địa chỉ base58 — bắt buộc'),
    addr: z.string().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (resolveAddressInput(data as Record<string, unknown>)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Bắt buộc `address` (base58). MCP đọc account qua TronGrid — không qua TronLink. Chưa có địa chỉ → `tron_getAddress` trên app trước.',
    });
  });

// --- tron_sendTrx / tron_sendToken (delegate → window.tronWeb.transactionBuilder + sign + broadcast) ---

export function resolveSendTrx(
  data: Record<string, unknown>,
): { to: string; amountSun: string; amountTrxHuman: string; amountTrx?: number } | undefined {
  const toRaw = data.to ?? data.toAddress ?? data.recipient ?? data.destination;
  const amountSunRaw = data.amountSun ?? data.amount_sun ?? data.valueSun ?? data.value_sun;
  const amountRaw = data.amount ?? data.amountTrx ?? data.value;

  let to = '';
  if (typeof toRaw === 'string') to = toRaw.trim();
  else if (typeof toRaw === 'number' && Number.isFinite(toRaw)) to = String(toRaw);

  const amountSun =
    amountSunRaw !== undefined && amountSunRaw !== null && amountSunRaw !== ''
      ? parsePositiveIntString(amountSunRaw)
      : parseTrxHumanToSun(amountRaw);

  if (!to || !amountSun) return undefined;

  const amountTrxHuman = formatSunToTrx(amountSun);
  const amountTrx = Number.isFinite(Number(amountTrxHuman)) ? Number(amountTrxHuman) : undefined;

  return { to, amountSun, amountTrxHuman, amountTrx };
}

export const sendTrxInputSchema = z
  .object({
    amount: z.union([z.string(), z.number()]).optional().describe('Số TRX gửi (đơn vị TRX, dạng decimal)'),
    amountTrx: z.union([z.string(), z.number()]).optional(),
    value: z.union([z.string(), z.number()]).optional(),
    amountSun: z.union([z.string(), z.number()]).optional().describe('Số TRX gửi (đơn vị sun, integer)'),
    amount_sun: z.union([z.string(), z.number()]).optional(),
    to: z.string().optional().describe('Địa chỉ nhận base58'),
    toAddress: z.string().optional(),
    recipient: z.string().optional(),
    destination: z.string().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (resolveSendTrx(data as Record<string, unknown>)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cần amount > 0 (amount | amountTrx | value) và to (to | toAddress | recipient | …).',
    });
  });

// --- tron_buildTrxTransferUnsigned (MCP + TronGrid: unsigned TRX transfer) ---

export function resolveBuildTrxTransaction(
  data: Record<string, unknown>,
): { from: string; to: string; amountSun: string; amountTrxHuman: string; amountTrx?: number } | undefined {
  const base = resolveSendTrx(data);
  if (!base) return undefined;
  const fromRaw = data.from ?? data.fromAddress ?? data.owner ?? data.sender;
  let from = '';
  if (typeof fromRaw === 'string') from = fromRaw.trim();
  else if (typeof fromRaw === 'number' && Number.isFinite(fromRaw)) from = String(fromRaw);
  if (!from) return undefined;
  return { from, to: base.to, amountSun: base.amountSun, amountTrxHuman: base.amountTrxHuman, amountTrx: base.amountTrx };
}

export const buildTrxTransactionInputSchema = z
  .object({
    from: z.string().optional().describe('Địa chỉ gửi (owner) base58'),
    fromAddress: z.string().optional(),
    owner: z.string().optional(),
    sender: z.string().optional(),
    amount: z.union([z.string(), z.number()]).optional().describe('Số TRX (đơn vị TRX, dạng decimal)'),
    amountTrx: z.union([z.string(), z.number()]).optional(),
    value: z.union([z.string(), z.number()]).optional(),
    amountSun: z.union([z.string(), z.number()]).optional().describe('Số TRX (đơn vị sun, integer)'),
    amount_sun: z.union([z.string(), z.number()]).optional(),
    to: z.string().optional().describe('Địa chỉ nhận base58'),
    toAddress: z.string().optional(),
    recipient: z.string().optional(),
    destination: z.string().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (resolveBuildTrxTransaction(data as Record<string, unknown>)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Cần from (from | fromAddress | owner | sender), amount > 0 (amount | amountTrx | value), và to (to | toAddress | …).',
    });
  });

export function resolveSendToken(data: Record<string, unknown>):
  | {
      to: string;
      contractAddress: string;
      /** Chuỗi số lượng token (human, ví dụ "10.5") để client nhân theo decimals */
      amount: string;
      decimals: number;
    }
  | undefined {
  const toRaw = data.to ?? data.toAddress ?? data.recipient ?? data.destination;
  const contractRaw =
    data.contractAddress ?? data.tokenAddress ?? data.contract ?? data.token ?? data.tokenContract;
  const amountRaw = data.amount ?? data.value;
  const decRaw = data.decimals ?? data.tokenDecimals;

  let to = '';
  if (typeof toRaw === 'string') to = toRaw.trim();
  else if (typeof toRaw === 'number' && Number.isFinite(toRaw)) to = String(toRaw);

  let contractAddress = '';
  if (typeof contractRaw === 'string') contractAddress = contractRaw.trim();

  const decimals = decRaw !== undefined && decRaw !== null && decRaw !== '' ? parseTokenDecimals(decRaw) : undefined;
  if (decimals === undefined) return undefined;

  const amountNormalized = parseTokenHumanAmount(amountRaw, decimals);
  if (!to || !contractAddress || !amountNormalized) return undefined;
  return { to, contractAddress, amount: amountNormalized, decimals };
}

export const sendTokenInputSchema = z
  .object({
    to: z.string().optional(),
    toAddress: z.string().optional(),
    recipient: z.string().optional(),
    contractAddress: z.string().optional().describe('Địa chỉ hợp đồng TRC20 (base58)'),
    tokenAddress: z.string().optional(),
    tokenContract: z.string().optional(),
    amount: z.union([z.string(), z.number()]).optional().describe('Số lượng token (human, không phải sun)'),
    value: z.union([z.string(), z.number()]).optional(),
    decimals: z.union([z.string(), z.number()]).optional().describe('Decimals TRC20 (bắt buộc, 0–36)'),
    tokenDecimals: z.union([z.string(), z.number()]).optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (resolveSendToken(data as Record<string, unknown>)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Cần to, contractAddress (tokenAddress | …), amount > 0 (chuỗi decimal), và decimals hợp lệ (0–36, bắt buộc).',
    });
  });
