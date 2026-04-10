import type { McptWalletAction } from './mcptSchemas.js';

export const TRON_WEB_BROWSER_ONLY =
  'Chỉ thực hiện trên trang có TronLink (`window.tronWeb`). MCP không có ví — trả `clientWalletActions` cho frontend.';

export function mcptJsonText(payload: Record<string, unknown>): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

export function mcptError(message: string): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  return {
    ...mcptJsonText({ ok: false, error: message }),
    isError: true,
  };
}

/** Chỉ cho tool cần ví: ký / gửi / đọc defaultAddress trên tab. */
export function mcptDelegate(
  tool: string,
  actions: McptWalletAction[],
  userMessage: string,
  forAgent?: string,
): Record<string, unknown> {
  return {
    ok: true,
    tool,
    source: 'mcp-test',
    mode: 'browser_wallet',
    requirement: TRON_WEB_BROWSER_ONLY,
    delegateToBrowser: true,
    clientWalletActions: actions,
    userMessage,
    forAgent: forAgent ?? TRON_WEB_BROWSER_ONLY,
  };
}
