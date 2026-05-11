const axios = require("axios");

const BASE_URL = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

// HTML parse_mode is more predictable than Markdown — no escaping surprises
// with special chars like !, -, (, ) that break MarkdownV2
async function sendMessage(chatId, text, options = {}) {
  await axios.post(`${BASE_URL}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...options,
  });
}

async function setWebhook(appUrl) {
  const webhookUrl = `${appUrl}/webhook`;
  const res = await axios.post(`${BASE_URL}/setWebhook`, {
    url: webhookUrl,
    secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message"],
  });
  console.log("Webhook set:", res.data);
}

module.exports = { sendMessage, setWebhook };
