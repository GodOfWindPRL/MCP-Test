# MCP Test

MCP server (stdio) với hai tool:

| Tool | Mô tả |
|------|--------|
| `get_trx_price` | Giá TRX hiện tại (USD), nguồn CoinGecko. |
| `send_funds` | Gửi TRX on-chain; ưu tiên ví cấu hình chung với TronLink MCP, không thì `privateKey` trong input. |

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
      "args": ["/absolute/path/to/mcp-test/dist/index.js"],
      "env": {
        "TRONLINK_MCP_AVAILABLE": "true",
        "TL_MINIMAL_TEST_PRIVATE_KEY": "your64hex..."
      }
    }
  }
}
```

`send_funds` cần `amount`, `to` (địa chỉ nhận), và tuỳ chọn `privateKey` khi không dùng được ví từ env.

### Logic `send_funds`

1. Nếu `TRONLINK_MCP_AVAILABLE` là true **và** có `TRONLINK_API_PRIVATE_KEY` hoặc `TL_MINIMAL_TEST_PRIVATE_KEY` → gửi bằng key đó.
2. Ngược lại, nếu có `privateKey` trong input (64 hex) → gửi bằng key đó.
3. Nếu không thỏa (1) và không có (2) → lỗi kèm lý do.

Một MCP không thể “hỏi” MCP khác có cài hay không; cờ `TRONLINK_MCP_AVAILABLE` do bạn/agent đặt trong `env` khi đã bật TronLink MCP trong cùng workspace.

## License

MIT
