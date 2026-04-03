#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { fetchTrxUsdPrice } from './getTrxPrice.js';
import { runSendFunds } from './sendFundsLogic.js';

const sendFundsInputSchema = z.object({
  amount: z.coerce.number().positive(),
  to: z.string().min(1, 'Recipient address required'),
  privateKey: z.string().optional(),
});

const server = new McpServer({
  name: 'mcp-test',
  version: '0.1.0',
});

server.registerTool(
  'get_trx_price',
  {
    description: 'Lấy giá TRX hiện tại (USD) từ CoinGecko.',
  },
  async () => {
    const price = await fetchTrxUsdPrice();
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              trxUsd: price.trxUsd,
              source: price.source,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

server.registerTool(
  'send_funds',
  {
    description: [
      'Gửi TRX on-chain.',
      'Ưu tiên: TRONLINK_MCP_AVAILABLE=true và (TRONLINK_API_PRIVATE_KEY | TL_MINIMAL_TEST_PRIVATE_KEY) → dùng ví đó.',
      'Không thì dùng privateKey trong input.',
      'Nếu không có cả hai nguồn key: lỗi có lý do.',
      'Cần `to` (địa chỉ nhận) và `amount` (TRX).',
    ].join('\n'),
    inputSchema: sendFundsInputSchema,
  },
  async (args: z.infer<typeof sendFundsInputSchema>) => {
    const outcome = await runSendFunds({
      amount: args.amount,
      to: args.to,
      privateKey: args.privateKey,
    });

    if (!outcome.ok) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                ok: false,
                source: outcome.source,
                error: outcome.message ?? 'send_funds failed',
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(
            {
              ok: true,
              source: outcome.source,
              result: outcome.result,
            },
            null,
            2,
          ),
        },
      ],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
