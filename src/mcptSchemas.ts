import { z } from 'zod';

/** Đồng bộ với frontend relay: chỉ các action được phép. */
export const mcptWalletActionTypeSchema = z.enum([
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

export type McptWalletActionType = z.infer<typeof mcptWalletActionTypeSchema>;

export const mcptWalletActionSchema = z.object({
  id: z.string().min(1),
  type: mcptWalletActionTypeSchema,
  params: z.record(z.string(), z.any()).optional(),
});

export type McptWalletAction = z.infer<typeof mcptWalletActionSchema>;

// --- mcpt_signMessage ---

export function resolveMcptMessage(data: Record<string, unknown>): { message: string } | undefined {
  const raw = data.message ?? data.msg ?? data.text ?? data.payload;
  if (raw === undefined || raw === null) return undefined;
  const message = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  if (!message) return undefined;
  return { message };
}

export const mcptSignMessageInputSchema = z
  .object({
    message: z.string().optional().describe('Nội dung cần ký (text hoặc hex tùy frontend/TronLink)'),
    msg: z.string().optional(),
    text: z.string().optional(),
    payload: z.string().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (resolveMcptMessage(data as Record<string, unknown>)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cần message không rỗng (message | msg | text | payload).',
    });
  });

// --- mcpt_signTransaction ---

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

export const mcptSignTransactionInputSchema = z
  .object({
    unSignedTransaction: z.any().optional().describe('Object giao dịch chưa ký (từ transactionBuilder)'),
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
        'Cần unSignedTransaction (object hoặc chuỗi JSON) — giao dịch TRON chưa ký để tronWeb.trx.sign(...).',
    });
  });

// --- mcpt_getBalance / mcpt_getAccount: bắt buộc address — đọc TronGrid trên MCP, không delegate ---

export function resolveMcptAddress(data: Record<string, unknown>): string | undefined {
  const raw = data.address ?? data.addr;
  if (raw === undefined || raw === null) return undefined;
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim();
  return s || undefined;
}

export const mcptGetBalanceInputSchema = z
  .object({
    address: z.string().optional().describe('Địa chỉ TRON base58 — bắt buộc'),
    addr: z.string().optional().describe('Alias của address'),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (resolveMcptAddress(data as Record<string, unknown>)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Bắt buộc `address` (base58). MCP đọc số dư qua TronGrid — không qua TronLink. Nếu chưa có địa chỉ, lấy từ `mcpt_getAddress` trên app rồi gọi lại.',
    });
  });

export const mcptGetAccountInputSchema = z
  .object({
    address: z.string().optional().describe('Địa chỉ base58 — bắt buộc'),
    addr: z.string().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (resolveMcptAddress(data as Record<string, unknown>)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Bắt buộc `address` (base58). MCP đọc account qua TronGrid — không qua TronLink. Chưa có địa chỉ → `mcpt_getAddress` trên app trước.',
    });
  });

// --- send_trx / send_token (delegate → window.tronWeb.transactionBuilder + sign + broadcast) ---

export function resolveSendTrx(data: Record<string, unknown>): { to: string; amountTrx: number } | undefined {
  const toRaw = data.to ?? data.toAddress ?? data.recipient ?? data.destination;
  const amountRaw = data.amount ?? data.amountTrx ?? data.value;

  let to = '';
  if (typeof toRaw === 'string') to = toRaw.trim();
  else if (typeof toRaw === 'number' && Number.isFinite(toRaw)) to = String(toRaw);

  let amountTrx: number | undefined;
  if (amountRaw !== undefined && amountRaw !== null && amountRaw !== '') {
    const n = typeof amountRaw === 'number' ? amountRaw : Number(String(amountRaw).trim());
    if (Number.isFinite(n) && n > 0) amountTrx = n;
  }

  if (!to || amountTrx === undefined) return undefined;
  return { to, amountTrx };
}

export const sendTrxInputSchema = z
  .object({
    amount: z.coerce.number().optional().describe('Số TRX gửi (đơn vị TRX)'),
    amountTrx: z.coerce.number().optional(),
    value: z.coerce.number().optional(),
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

  let amountStr = '';
  if (amountRaw !== undefined && amountRaw !== null && amountRaw !== '') {
    if (typeof amountRaw === 'number' && Number.isFinite(amountRaw)) amountStr = String(amountRaw);
    else amountStr = String(amountRaw).trim();
  }

  let decimals = 6;
  if (decRaw !== undefined && decRaw !== null && decRaw !== '') {
    const d = typeof decRaw === 'number' ? decRaw : Number(String(decRaw).trim());
    if (Number.isFinite(d) && d >= 0 && d <= 36) decimals = Math.floor(d);
    else return undefined;
  }

  const amtNum = Number(amountStr);
  if (!to || !contractAddress || !amountStr || !Number.isFinite(amtNum) || amtNum <= 0) return undefined;
  return { to, contractAddress, amount: amountStr, decimals };
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
    decimals: z.coerce.number().optional().describe('Decimals TRC20 (mặc định 6, ví dụ USDT)'),
    tokenDecimals: z.coerce.number().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (resolveSendToken(data as Record<string, unknown>)) return;
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        'Cần to, contractAddress (tokenAddress | …), amount > 0, và decimals hợp lệ (0–36, mặc định 6).',
    });
  });
