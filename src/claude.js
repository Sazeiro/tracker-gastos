const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expense parsing assistant. The user will send messages in Spanish or English describing a purchase or expense.

Your job is to extract structured data and return ONLY a valid JSON object — no markdown, no explanation, no extra text.

Return this exact shape:
{
  "type": "expense" | "query" | "unknown",
  "amount": number | null,
  "currency": "ARS" | "USD" | "EUR" | null,
  "merchant": string | null,
  "category": string | null,
  "description": string | null,
  "date": "YYYY-MM-DD" | null
}

Category must be one of: Food & Coffee, Transport, Groceries, Shopping, Health, Subscriptions, Entertainment, Developer Tools, Travel, Utilities, Transfers, Fees, Other.

Currency rules:
- If the user says "pesos", "ars", "$" with no qualifier → ARS
- If the user says "dólares", "usd", "u$d", "USD" → USD
- If no currency is mentioned, default to ARS

Date rules:
- If no date is mentioned, use today's date (provided in the user message)
- "ayer" = yesterday, "anteayer" = two days ago

If the message is a question about spending (e.g. "cuánto gasté?", "how much on food?"), set type to "query" and all other fields to null.
If you cannot parse it as an expense or query, set type to "unknown".

Examples:
"uber 2500" → { "type": "expense", "amount": 2500, "currency": "ARS", "merchant": "Uber", "category": "Transport", "description": "Uber ride", "date": "<today>" }
"netflix 15 usd" → { "type": "expense", "amount": 15, "currency": "USD", "merchant": "Netflix", "category": "Subscriptions", "description": "Netflix subscription", "date": "<today>" }
"café con medialunas 850" → { "type": "expense", "amount": 850, "currency": "ARS", "merchant": null, "category": "Food & Coffee", "description": "Café con medialunas", "date": "<today>" }
"cuánto gasté este mes?" → { "type": "query", "amount": null, "currency": null, "merchant": null, "category": null, "description": null, "date": null }
`;

async function parseExpense(userMessage) {
  const today = new Date().toISOString().split("T")[0];

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001", // haiku: faster + cheaper for structured parsing
    max_tokens: 500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }, // cache the static system prompt
      },
    ],
    messages: [
      {
        role: "user",
        // inject today's date in the message, not by mangling the system prompt
        content: `Today is ${today}.\n\n${userMessage}`,
      },
    ],
  });

  const raw = response.content[0].text.trim();

  try {
    return JSON.parse(raw);
  } catch {
    console.error("Failed to parse Claude response:", raw);
    return { type: "unknown" };
  }
}

async function answerQuery(userMessage, expenses) {
  const summary = buildSummaryContext(expenses);
  const today = new Date().toISOString().split("T")[0];

  const response = await client.messages.create({
    model: "claude-sonnet-4-6", // sonnet for richer natural language answers
    max_tokens: 800,
    system: [
      {
        type: "text",
        text: `Eres un asistente financiero personal. El usuario te hará preguntas sobre sus gastos.
Responde siempre en el mismo idioma que el usuario (español o inglés).
Sé conciso, amigable, y usa emojis con moderación.`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Hoy es ${today}. Aquí están mis gastos de este mes:\n\n${summary}\n\n${userMessage}`,
      },
    ],
  });

  return response.content[0].text;
}

function buildSummaryContext(expenses) {
  if (!expenses || expenses.length === 0) return "No hay gastos registrados aún.";

  const byCategory = expenses.reduce((acc, e) => {
    const key = `${e.category} (${e.currency})`;
    acc[key] = (acc[key] || 0) + e.amount;
    return acc;
  }, {});

  const lines = Object.entries(byCategory)
    .map(([cat, total]) => `- ${cat}: ${total.toLocaleString()}`)
    .join("\n");

  const total_ars = expenses
    .filter((e) => e.currency === "ARS")
    .reduce((s, e) => s + e.amount, 0);

  const total_usd = expenses
    .filter((e) => e.currency === "USD")
    .reduce((s, e) => s + e.amount, 0);

  return `Por categoría:\n${lines}\n\nTotal ARS: ${total_ars.toLocaleString()}\nTotal USD: ${total_usd.toLocaleString()}`;
}

module.exports = { parseExpense, answerQuery };
