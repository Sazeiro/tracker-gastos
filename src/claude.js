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
- If no date is mentioned, use today's date
- "ayer" = yesterday, "anteayer" = two days ago

If the message is a question about spending (e.g. "cuánto gasté?", "how much on food?"), set type to "query" and all other fields to null.
If you cannot parse it as an expense or query, set type to "unknown".

Examples:
"uber 2500" → { "type": "expense", "amount": 2500, "currency": "ARS", "merchant": "Uber", "category": "Transport", "description": "Uber ride", "date": "2026-05-11" }
"netflix 15 usd" → { "type": "expense", "amount": 15, "currency": "USD", "merchant": "Netflix", "category": "Subscriptions", "description": "Netflix subscription", "date": "2026-05-11" }
"café con medialunas 850" → { "type": "expense", "amount": 850, "currency": "ARS", "merchant": null, "category": "Food & Coffee", "description": "Café con medialunas", "date": "2026-05-11" }
"cuánto gasté este mes?" → { "type": "query", "amount": null, "currency": null, "merchant": null, "category": null, "description": null, "date": null }
`;

async function parseExpense(userMessage) {
  const today = new Date().toISOString().split("T")[0];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 500,
    system: SYSTEM_PROMPT.replace("2026-05-11", today), // inject real today
    messages: [{ role: "user", content: userMessage }],
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

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 800,
    system: `Eres un asistente financiero personal. El usuario te hará preguntas sobre sus gastos.
Responde siempre en el mismo idioma que el usuario (español o inglés).
Sé conciso, amigable, y usa emojis con moderación.
Aquí están los gastos del usuario este mes:

${summary}`,
    messages: [{ role: "user", content: userMessage }],
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
