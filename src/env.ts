/**
 * Phát hiện “đã cấu hình TronLink MCP” + “có private key API / ví” qua biến môi trường
 * (Cursor/IDE inject env trong mcp.json). Không có cách chuẩn để MCP này gọi MCP khác trực tiếp.
 */

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

export function isTruthyEnv(v: string | undefined): boolean {
  if (!v) return false;
  return TRUTHY.has(v.trim().toLowerCase());
}

/** Agent đã bật cờ: có cài / dùng chung TronLink MCP (đặt trong mcp.json). */
export function isTronLinkMcpMarkedAvailable(): boolean {
  return isTruthyEnv(process.env.TRONLINK_MCP_AVAILABLE);
}

/** Private key “ví API” khi TronLink MCP đã tạo / cấp (trùng tên với minimal / test). */
export function getTronLinkDelegatedPrivateKey(): string | undefined {
  const raw =
    process.env.TRONLINK_API_PRIVATE_KEY?.trim() ||
    process.env.TL_MINIMAL_TEST_PRIVATE_KEY?.trim() ||
    '';
  const pk = raw.replace(/^0x/i, '');
  if (!pk || pk.length !== 64 || !/^[0-9a-fA-F]+$/.test(pk)) return undefined;
  return pk;
}

export function hasTronLinkWalletForApi(): boolean {
  return !!getTronLinkDelegatedPrivateKey();
}

export function resolveFullHost(): string {
  return (
    process.env.TL_TRONGRID_URL?.trim() ||
    process.env.TL_MINIMAL_TEST_FULLHOST?.trim() ||
    process.env.TRON_FULL_HOST?.trim() ||
    'https://nile.trongrid.io'
  );
}

export function normalizePrivateKey(input: unknown): string | undefined {
  if (typeof input !== 'string') return undefined;
  const pk = input.trim().replace(/^0x/i, '');
  if (!pk || pk.length !== 64 || !/^[0-9a-fA-F]+$/.test(pk)) return undefined;
  return pk;
}
