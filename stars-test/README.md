# ELITEMOTION Telegram Stars test prototype

This branch is a **non-production prototype**. It is not deployed, has no credentials, does not create invoices, and must not deliver real poster files.

## Architecture
- Telegram Mini App remains a static catalogue.
- A Cloudflare Worker receives Telegram Bot API webhooks.
- D1 stores orders and payment-charge IDs for idempotency.
- Telegram Stars is the only payment currency for digital goods sold inside Telegram; invoices use currency `XTR`.
- An order is eligible for delivery only after a valid `successful_payment` update matches the server-side order's invoice payload, XTR currency, and exact amount.
- Real file delivery is intentionally not implemented here. Public GitHub images are previews only; originals must be stored privately (e.g. R2) and served using short-lived, order-bound delivery links.

## Cost guardrails
Cloudflare Workers Free currently includes 100,000 requests/day; D1 Free includes 5 million rows read/day, 100,000 rows written/day, and 5 GB total storage. R2 Free includes 10 GB-month storage, 1 million Class A operations/month and 10 million Class B operations/month. Limits and pricing can change; monitor usage. Do not upgrade to a paid plan or enable billing without explicit owner approval.

## Test-only setup (not completed)
1. Create a Telegram bot and use Telegram's dedicated test environment/test bot token for all payment tests.
2. Create a Cloudflare Worker and D1 database manually; no service has been provisioned by this repository.
3. Configure secrets only in Cloudflare's secret store: `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`. Never commit them.
4. Set `PAYMENT_MODE=test`; this prototype returns 503 for webhook processing unless test mode is explicitly enabled.
5. Register the webhook using Telegram's test environment and its `secret_token`.
6. Test invalid signatures, wrong payload, wrong currency/amount, repeated updates, and successful-payment idempotency before implementing private file delivery.

## Safety gates before launch
- Keep real payments disabled until the owner explicitly approves launch.
- Require `pre_checkout_query` validation and reply within Telegram's 10-second window.
- Process `successful_payment` only; never deliver on pre-checkout alone.
- Make payment processing idempotent using `telegram_payment_charge_id` and unique invoice payload.
- Provide `/terms`, `/support`, and `/paysupport`; implement refunds and customer support procedures.
- Never put bot tokens, webhook secrets, private file URLs, or original poster files in GitHub Pages.
