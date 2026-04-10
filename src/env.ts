/** Full node / TronGrid (gửi TRX), không liên quan private key. */
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
