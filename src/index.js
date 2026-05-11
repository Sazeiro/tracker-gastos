require("dotenv").config();

const express = require("express");
const { setWebhook } = require("./telegram");
const { handleMessage } = require("./handler");

const app = express();
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "gastos-bot" });
});

// Telegram webhook
app.post("/webhook", (req, res) => {
  // Verify secret token
  const secret = req.headers["x-telegram-bot-api-secret-token"];
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Respond to Telegram immediately (required within 5s)
  res.sendStatus(200);

  // Process async
  const update = req.body;
  if (update.message) {
    handleMessage(update.message).catch((err) =>
      console.error("Unhandled error in handleMessage:", err)
    );
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`✅ gastos-bot running on port ${PORT}`);

  // Register webhook with Telegram on startup
  if (process.env.APP_URL) {
    try {
      await setWebhook(process.env.APP_URL);
      console.log(`✅ Webhook registered at ${process.env.APP_URL}/webhook`);
    } catch (err) {
      console.error("❌ Failed to set webhook:", err.message);
    }
  } else {
    console.warn("⚠️  APP_URL not set — webhook not registered");
  }
});
