import { z } from 'zod';

/** Chuẩn hoá amount / địa chỉ / key từ một lần gọi tool (hỗ trợ alias). */
export function resolveSendFundsFields(data: Record<string, unknown>): {
  amount: number;
  to: string;
  privateKey?: string;
} | undefined {
  const amountRaw =
    data.amount ?? data.amountTrx ?? data.amount_trx ?? data.value;
  const toRaw =
    data.to ??
    data.toAddress ??
    data.to_address ??
    data.recipient ??
    data.address ??
    data.destination;

  let amount: number | undefined;
  if (amountRaw !== undefined && amountRaw !== null && amountRaw !== '') {
    const n = typeof amountRaw === 'number' ? amountRaw : Number(String(amountRaw).trim());
    if (Number.isFinite(n) && n > 0) amount = n;
  }

  let to = '';
  if (typeof toRaw === 'string') to = toRaw.trim();
  else if (typeof toRaw === 'number' && Number.isFinite(toRaw)) to = String(toRaw);

  if (amount === undefined || !to) return undefined;

  const pkRaw = data.privateKey ?? data.private_key ?? data.pk ?? data.key;
  const privateKey =
    typeof pkRaw === 'string' && pkRaw.trim().length > 0 ? pkRaw.trim() : undefined;

  return { amount, to, privateKey };
}

/**
 * Giữ dạng z.object + superRefine (không dùng preprocess/transform ở ngoài)
 * để MCP SDK vẫn export JSON Schema đầy đủ trong tools/list.
 */
export const sendFundsInputSchema = z
  .object({
    amount: z.coerce.number().optional().describe('Số TRX gửi (ưu tiên nếu có nhiều field amount)'),
    amountTrx: z.coerce.number().optional().describe('Alias của amount'),
    amount_trx: z.coerce.number().optional(),
    value: z.coerce.number().optional().describe('Alias của amount'),
    to: z.string().optional().describe('Địa chỉ TRON base58 nhận TRX'),
    toAddress: z.string().optional(),
    to_address: z.string().optional(),
    recipient: z.string().optional().describe('Alias của to'),
    address: z.string().optional(),
    destination: z.string().optional(),
    privateKey: z.string().optional().describe('64 ký tự hex để ký giao dịch trong mcp-test'),
    private_key: z.string().optional(),
    pk: z.string().optional(),
    key: z.string().optional(),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    const resolved = resolveSendFundsFields(data as Record<string, unknown>);
    if (resolved) return;
    ctx.addIssue(
      'Cần amount > 0 (amount | amountTrx | value) và địa chỉ nhận (to | recipient | toAddress | address | …).',
    );
  });

export type SendFundsInput = z.infer<typeof sendFundsInputSchema>;
