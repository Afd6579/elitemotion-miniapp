# ELITEMOTION Mini App & Telegram Bot

A lightweight Telegram launcher bot for the ELITEMOTION digital automotive poster gallery.

## Included files

- `index.html` — existing Persian RTL storefront / gallery.
- `ton-test.html` — isolated TON Connect connection test; it does not send transactions.
- `tonconnect-manifest.json` — TON Connect manifest.
- `bot.js` — Telegram bot with `/start` and `/help`, including a Mini App button.
- `package.json` — Node.js scripts and runtime requirement.
- `.env.example` — configuration template. Never commit your real bot token.

## Run the Telegram bot locally

1. Install Node.js 20 or newer.
2. Create a bot with **@BotFather** and copy its token privately.
3. Copy `.env.example` to `.env`.
4. Set `TELEGRAM_BOT_TOKEN` in your environment to your token. Never publish it or paste it into source files.
5. Set `WEB_APP_URL` to the HTTPS URL where the storefront is hosted.
6. Run:

```sh
npm run check
npm start
```

The bot uses Node.js built-in `fetch` and long polling; no extra npm package is required. Run only one polling instance per bot token. Stop with Ctrl+C.

## Important limitations

- The bot token is not included in this repository.
- The bot only opens the storefront and replies to basic commands. It does not accept payments or deliver paid files.
- TON Connect testing is separate. A connected wallet does not prove a payment was made.
- Do not enable automatic delivery until payment verification and secure file access are implemented and tested.
- Never put card details, passwords, API keys, or real tokens in public repository files.
