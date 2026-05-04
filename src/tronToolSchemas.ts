import { z } from 'zod';

export const tronBroadcastSignedTransactionInputSchema = z
  .object({
    signedTransaction: z
      .any()
      .optional()
      .describe('Signed transaction object (có signature)'),
    signedHexTransaction: z
      .string()
      .optional()
      .describe('Signed transaction hex (nếu có)'),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (!data.signedTransaction && !data.signedHexTransaction) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Cần signedTransaction hoặc signedHexTransaction.',
      });
      return;
    }
    if (data.signedHexTransaction) {
      const s = data.signedHexTransaction.trim();
      if (!/^(0x)?[0-9a-fA-F]+$/.test(s)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'signedHexTransaction phải là chuỗi hex.',
        });
      }
    }
  });

export const buildTrc10TransferUnsignedInputSchema = z
  .object({
    fromAddress: z.string().min(1).describe('Địa chỉ base58 của caller/issuer'),
    toAddress: z.string().min(1).describe('Địa chỉ base58 recipient'),
    tokenId: z.string().min(1).describe('TRC10 token id'),
    amount: z
      .string()
      .min(1)
      .describe('Số lượng base unit (integer digits string, không decimal)'),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (!/^\d+$/.test(data.amount.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'amount phải là integer digits string (base unit).',
        path: ['amount'],
      });
    }
    if (data.amount.trim() === '0') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'amount phải > 0.',
        path: ['amount'],
      });
    }
  });

export const buildContractCallUnsignedParameterSchema = z
  .object({
    type: z.string().min(1),
    value: z.any(),
  })
  .passthrough();

export const buildContractCallUnsignedInputSchema = z
  .object({
    fromAddress: z.string().min(1).describe('Địa chỉ base58 của caller/issuer'),
    contractAddress: z.string().min(1).describe('Địa chỉ base58 hợp đồng'),
    functionSelector: z.string().min(1).describe('Ví dụ: transfer(address,uint256)'),
    parameters: z.array(buildContractCallUnsignedParameterSchema).optional(),
    feeLimitSun: z
      .string()
      .optional()
      .describe('Fee limit trong SUN (integer digits string)'),
    callValueSun: z
      .string()
      .optional()
      .describe('Call value trong SUN (integer digits string)'),
  })
  .passthrough()
  .superRefine((data, ctx) => {
    if (data.feeLimitSun !== undefined) {
      const s = data.feeLimitSun.trim();
      if (!/^\d+$/.test(s)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'feeLimitSun phải là integer digits string.' });
      }
    }
    if (data.callValueSun !== undefined) {
      const s = data.callValueSun.trim();
      if (!/^\d+$/.test(s)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'callValueSun phải là integer digits string.' });
      }
    }
  });

