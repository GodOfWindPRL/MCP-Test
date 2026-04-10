import { z } from 'zod';

/** Đồng bộ với backend/utils/tronWalletRelay.js ALLOWED_ACTION_TYPES */
/** Giữ đồng bộ với `mcptSchemas.mcptWalletActionTypeSchema` / relay frontend. */
const actionTypeSchema = z.enum([
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

const singleActionSchema = z.object({
  id: z.string().min(1),
  type: actionTypeSchema,
  params: z.record(z.string(), z.any()).optional(),
});

export const browserTronWalletInputSchema = z
  .object({
    preset: z
      .enum(['address', 'address_balance', 'ready', 'current_block', 'custom'])
      .describe(
        'address=chỉ địa chỉ ví; address_balance=chỉ địa chỉ (số dư lấy bằng mcpt_getBalance sau khi có address); ready=tronWeb.ready; current_block=block — ưu tiên gọi mcpt_getCurrentBlock (TronGrid); custom=dùng actions',
      ),
    actions: z.array(singleActionSchema).optional().describe('Bắt buộc khi preset=custom'),
  })
  .refine((data) => data.preset !== 'custom' || (data.actions != null && data.actions.length > 0), {
    message: 'preset=custom yêu cầu actions (mảng không rỗng)',
    path: ['actions'],
  });

export type BrowserTronWalletInput = z.infer<typeof browserTronWalletInputSchema>;

function buildActionsFromPreset(preset: BrowserTronWalletInput['preset'], custom?: z.infer<typeof singleActionSchema>[]) {
  switch (preset) {
    case 'ready':
      return [{ id: 'r1', type: 'isReady' as const }];
    case 'address':
      return [{ id: 'a1', type: 'getDefaultAddress' as const }];
    case 'address_balance':
      return [{ id: 'a1', type: 'getDefaultAddress' as const }];
    case 'current_block':
      return [{ id: 'b1', type: 'getCurrentBlock' as const }];
    case 'custom':
      return custom ?? [];
    default:
      return [];
  }
}

export function resolveBrowserTronWalletActions(
  raw: Record<string, unknown>,
): { ok: true; actions: z.infer<typeof singleActionSchema>[] } | { ok: false; error: string } {
  const parsed = browserTronWalletInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const { preset } = parsed.data;
  const customActions = preset === 'custom' ? parsed.data.actions : undefined;
  const built = buildActionsFromPreset(preset, customActions);
  if (built.length === 0) {
    return { ok: false, error: 'Không sinh được actions từ preset' };
  }
  return { ok: true, actions: built };
}
