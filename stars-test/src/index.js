/**
 * ELITEMOTION Telegram Stars webhook scaffold.
 * SAFETY: test-only. Does not create invoices or deliver original files.
 * Configure BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET as Cloudflare secrets.
 * Bind a D1 database as DB. Keep PAYMENT_MODE=test until explicitly approved.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({
        ok: true,
        app: "elitemotion-stars-test",
        mode: env.PAYMENT_MODE === "test" ? "test" : "disabled",
        realPaymentsEnabled: false,
        originalFileDeliveryEnabled: false
      });
    }

    if (url.pathname !== "/telegram/webhook" || request.method !== "POST") {
      return new Response("Not found", { status: 404 });
    }

    if (env.PAYMENT_MODE !== "test") {
      return new Response("Payment processing disabled", { status: 503 });
    }

    const expected = env.TELEGRAM_WEBHOOK_SECRET;
    const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (!expected || !supplied || !constantTimeEqual(supplied, expected)) {
      return new Response("Unauthorized", { status: 401 });
    }

    if (!env.BOT_TOKEN || !env.DB) {
      return new Response("Test configuration incomplete", { status: 503 });
    }

    let update;
    try {
      update = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    // This scaffold deliberately refuses all payment updates until the full
    // order-creation and test-invoice flow has been reviewed and implemented.
    if (update.pre_checkout_query || update.message?.successful_payment) {
      return Response.json({
        ok: false,
        mode: "test",
        message: "Payment flow is intentionally disabled in this scaffold."
      }, { status: 501 });
    }

    // Non-payment updates are acknowledged but not processed.
    return Response.json({ ok: true, mode: "test", processed: false });
  }
};

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
