# MCP Test

MCP server (stdio) với hai tool:

| Tool | Mô tả |
|------|--------|
| `get_trx_price` | Giá TRX hiện tại (USD), nguồn CoinGecko. |
| `send_funds` | Gửi TRX từ mcp-test khi có `privateKey`; không có key thì có thể dùng tool TronLink nếu phiên có MCP đó (agent tự quyết). |

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

Tuỳ chọn: `TL_TRONGRID_URL` trong `env` nếu cần đổi full node (mặc định Nile).

**Agent:** có `privateKey` → gửi qua `send_funds`; không có → có thể gửi bằng tool TronLink nếu có trong phiên.

### Logic `send_funds` (server)

1. Có `privateKey` → broadcast từ mcp-test.
2. Không có → không broadcast; phản hồi `walletStatus: need_tronlink` (gợi ý dùng TronLink nếu có).

## License

MIT
