const { parseExpense, answerQuery } = require("./claude");
const { saveExpense, getExpensesThisMonth, getRecentExpenses, deleteLastExpense } = require("./db");
const { sendMessage } = require("./telegram");

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text?.trim();

  if (!text) return;

  // --- Commands ---
  if (text === "/start") {
    return sendMessage(
      chatId,
      `👋 *Hola\\! Soy tu bot de gastos.*\n\nMandame tus gastos así:\n\n` +
        `• \`uber 2500\`\n` +
        `• \`café 850 pesos\`\n` +
        `• \`netflix 15 usd\`\n` +
        `• \`supermercado 12000\`\n\n` +
        `También podés preguntarme:\n` +
        `• _¿cuánto gasté este mes?_\n` +
        `• _¿en qué categoría gasté más?_\n\n` +
        `Comandos:\n` +
        `/resumen — ver resumen del mes\n` +
        `/ultimos — últimos 5 gastos\n` +
        `/borrar — borrar el último gasto`
    );
  }

  if (text === "/resumen") {
    return handleResumen(chatId, userId);
  }

  if (text === "/ultimos") {
    return handleUltimos(chatId, userId);
  }

  if (text === "/borrar") {
    return handleBorrar(chatId, userId);
  }

  // --- Parse with Claude ---
  try {
    await sendMessage(chatId, "⏳ Procesando...");
    const parsed = await parseExpense(text);

    if (parsed.type === "expense") {
      const saved = await saveExpense(userId, parsed);
      const emoji = categoryEmoji(saved.category);
      const amountStr = formatAmount(saved.amount, saved.currency);

      return sendMessage(
        chatId,
        `${emoji} *${saved.category}*\n` +
          `💰 ${amountStr}\n` +
          (saved.merchant ? `🏪 ${saved.merchant}\n` : "") +
          (saved.description ? `📝 ${saved.description}\n` : "") +
          `📅 ${saved.date}\n\n` +
          `_Guardado ✓ — mandá /borrar si fue un error_`
      );
    }

    if (parsed.type === "query") {
      const expenses = await getExpensesThisMonth(userId);
      const answer = await answerQuery(text, expenses);
      return sendMessage(chatId, answer);
    }

    // unknown
    return sendMessage(
      chatId,
      `🤔 No entendí ese gasto. Probá con algo como:\n\`uber 2500\` o \`café 850 pesos\``
    );
  } catch (err) {
    console.error("handleMessage error:", err);
    return sendMessage(chatId, "❌ Algo salió mal. Intentá de nuevo en un momento.");
  }
}

async function handleResumen(chatId, userId) {
  try {
    const expenses = await getExpensesThisMonth(userId);
    if (!expenses || expenses.length === 0) {
      return sendMessage(chatId, "📭 No tenés gastos registrados este mes.");
    }

    const byCategory = expenses.reduce((acc, e) => {
      const key = e.category;
      if (!acc[key]) acc[key] = { ARS: 0, USD: 0 };
      acc[key][e.currency] = (acc[key][e.currency] || 0) + e.amount;
      return acc;
    }, {});

    const lines = Object.entries(byCategory)
      .sort((a, b) => (b[1].ARS || 0) - (a[1].ARS || 0))
      .map(([cat, totals]) => {
        const emoji = categoryEmoji(cat);
        const parts = [];
        if (totals.ARS) parts.push(`$${totals.ARS.toLocaleString("es-AR")}`);
        if (totals.USD) parts.push(`USD ${totals.USD}`);
        return `${emoji} *${cat}*: ${parts.join(" + ")}`;
      })
      .join("\n");

    const totalARS = expenses
      .filter((e) => e.currency === "ARS")
      .reduce((s, e) => s + e.amount, 0);
    const totalUSD = expenses
      .filter((e) => e.currency === "USD")
      .reduce((s, e) => s + e.amount, 0);

    const month = new Date().toLocaleString("es-AR", { month: "long" });

    return sendMessage(
      chatId,
      `📊 *Resumen de ${month}*\n\n${lines}\n\n` +
        `─────────────────\n` +
        (totalARS ? `💵 Total ARS: *$${totalARS.toLocaleString("es-AR")}*\n` : "") +
        (totalUSD ? `💵 Total USD: *$${totalUSD}*\n` : "") +
        `📦 Transacciones: ${expenses.length}`
    );
  } catch (err) {
    console.error("handleResumen error:", err);
    return sendMessage(chatId, "❌ No pude cargar el resumen.");
  }
}

async function handleUltimos(chatId, userId) {
  try {
    const expenses = await getRecentExpenses(userId, 5);
    if (!expenses || expenses.length === 0) {
      return sendMessage(chatId, "📭 No tenés gastos registrados todavía.");
    }

    const lines = expenses
      .map((e) => {
        const emoji = categoryEmoji(e.category);
        const amount = formatAmount(e.amount, e.currency);
        const merchant = e.merchant ? ` — ${e.merchant}` : "";
        return `${emoji} ${amount}${merchant} _(${e.date})_`;
      })
      .join("\n");

    return sendMessage(chatId, `🕐 *Últimos gastos*\n\n${lines}`);
  } catch (err) {
    console.error("handleUltimos error:", err);
    return sendMessage(chatId, "❌ No pude cargar los gastos.");
  }
}

async function handleBorrar(chatId, userId) {
  try {
    const deleted = await deleteLastExpense(userId);
    if (!deleted) {
      return sendMessage(chatId, "📭 No hay gastos para borrar.");
    }
    return sendMessage(chatId, "🗑️ Último gasto borrado.");
  } catch (err) {
    console.error("handleBorrar error:", err);
    return sendMessage(chatId, "❌ No pude borrar el gasto.");
  }
}

function formatAmount(amount, currency) {
  if (currency === "USD") return `USD ${amount}`;
  return `$${amount.toLocaleString("es-AR")}`;
}

function categoryEmoji(category) {
  const map = {
    "Food & Coffee": "☕",
    Transport: "🚗",
    Groceries: "🛒",
    Shopping: "🛍️",
    Health: "💊",
    Subscriptions: "📱",
    Entertainment: "🎬",
    "Developer Tools": "💻",
    Travel: "✈️",
    Utilities: "💡",
    Transfers: "💸",
    Fees: "🏦",
    Other: "📦",
  };
  return map[category] || "📦";
}

module.exports = { handleMessage };
