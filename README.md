# MCP Test

MCP server (stdio) phục vụ tương tác ví TRON (TronLink) và thao tác giao dịch.

### Các tool chính

| Tool | Mô tả |
|------|--------|
| `tron_getBalance` / `tron_getAccount` | Đọc on-chain qua full node/TronGrid (không cần ví) |
| `tron_getAddress` / `tron_requestAccounts` / `tron_isReady` | Delegate lấy địa chỉ và kiểm tra TronLink (chạy trong browser) |
| `tron_sendTrx` / `tron_sendToken` | Gửi trực tiếp qua TronLink (client-side broadcast) |
| `tron_buildTrxTransferUnsigned` / `tron_buildTrc10TransferUnsigned` / `tron_buildContractCallUnsigned` | Build giao dịch unsigned (server-side) |
| `tron_signTransaction` | Delegate ký giao dịch unsigned qua TronLink |
| `tron_broadcastTransaction` | Broadcast giao dịch đã ký (server-side) |

## Cài đặt

```bash
cd /path/to/mcp-test
npm install
npm run build
```

## Cursor / MCP client

```json
{
  "mcpServers": {
    "mcp-test": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-test/dist/index.js"]
    }
  }
}
```

Tuỳ chọn: `TL_TRONGRID_URL` / `TRON_FULL_HOST` trong `env` nếu cần đổi full node (mặc định Nile).

### Luồng build → sign → broadcast

1. `tron_build...Unsigned` (unsigned)
2. `tron_signTransaction` (TronLink ký)
3. `tron_broadcastTransaction` (server broadcast)

## License

MIT
