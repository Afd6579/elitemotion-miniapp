import process from "node:process";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_APP_URL = process.env.WEB_APP_URL || "https://afd6579.github.io/elitemotion-miniapp/";
const BOT_NAME = process.env.BOT_NAME || "ELITEMOTION";

if (!TOKEN) {
  console.error("Missing TELEGRAM_BOT_TOKEN. Copy .env.example to .env and set your bot token.");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
let offset = 0;
let stopping = false;

async function telegram(method, payload = {}) {
  const response = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(35_000)
  });
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram API error: ${response.status}`);
  }
  return data.result;
}

function welcomeText(firstName = "") {
  const greeting = firstName ? `سلام ${firstName} عزیز!\n\n` : "سلام!\n\n";
  return greeting +
    "به ELITEMOTION خوش آمدی. 🏁\n" +
    "پوسترهای دیجیتال خودرو با سبک لوکس و سینمایی.\n\n" +
    "از دکمه زیر برای مشاهده گالری استفاده کن.\n" +
    "پرداخت آنلاین در این نسخه فعال نیست؛ سفارش را فقط پس از هماهنگی و تأیید دستی پرداخت نهایی کن.";
}

async function handleUpdate(update) {
  const message = update.message;
  if (!message?.chat?.id || !message.text) return;

  const chatId = message.chat.id;
  const text = message.text.trim();
  const firstName = message.from?.first_name || "";

  if (text === "/start" || text.startsWith("/start ")) {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: welcomeText(firstName),
      reply_markup: {
        inline_keyboard: [[
          { text: "🏎️ مشاهده فروشگاه ELITEMOTION", web_app: { url: WEB_APP_URL } }
        ], [
          { text: "باز کردن فروشگاه در مرورگر", url: WEB_APP_URL }
        ]]
      }
    });
    return;
  }

  if (text === "/help") {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: "راهنما\n/start — نمایش خوش‌آمدگویی و دکمه فروشگاه\n/help — نمایش این راهنما\n\nاین ربات فعلاً فقط فروشگاه را باز می‌کند؛ پرداخت و تحویل خودکار فایل فعال نیست."
    });
    return;
  }

  await telegram("sendMessage", {
    chat_id: chatId,
    text: `برای باز کردن فروشگاه ${BOT_NAME}، دستور /start را بفرست.`
  });
}

async function poll() {
  while (!stopping) {
    try {
      const updates = await telegram("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message"]
      });
      for (const update of updates) {
        offset = update.update_id + 1;
        try {
          await handleUpdate(update);
        } catch (error) {
          console.error("Failed to handle update:", error.message);
        }
      }
    } catch (error) {
      if (!stopping) {
        console.error("Telegram polling error:", error.message);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }
}

function shutdown() {
  stopping = true;
  console.log("Stopping ELITEMOTION bot...");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("ELITEMOTION Telegram bot is starting...");
console.log("Mini App URL:", WEB_APP_URL);
poll();
