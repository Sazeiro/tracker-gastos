const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function saveExpense(telegramUserId, parsed) {
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      telegram_user_id: String(telegramUserId),
      amount: parsed.amount,
      currency: parsed.currency || "ARS",
      merchant: parsed.merchant,
      category: parsed.category || "Other",
      description: parsed.description,
      date: parsed.date || new Date().toISOString().split("T")[0],
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getExpensesThisMonth(telegramUserId) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("telegram_user_id", String(telegramUserId))
    .gte("date", firstDay)
    .order("date", { ascending: false });

  if (error) throw error;
  return data;
}

async function getExpensesLastNMonths(telegramUserId, months = 3) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - months, 1)
    .toISOString()
    .split("T")[0];

  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("telegram_user_id", String(telegramUserId))
    .gte("date", from)
    .order("date", { ascending: false });

  if (error) throw error;
  return data;
}

async function getSummaryForWidget(telegramUserId) {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];

  const { data: expenses, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("telegram_user_id", String(telegramUserId))
    .gte("date", firstDay)
    .order("date", { ascending: false });

  if (error) throw error;
  if (!expenses || expenses.length === 0) {
    return {
      month: now.toLocaleString("es-AR", { month: "long", year: "numeric" }),
      total_ars: 0,
      total_usd: 0,
      transaction_count: 0,
      by_category: [],
      recent: [],
    };
  }

  const total_ars = expenses
    .filter((e) => e.currency === "ARS")
    .reduce((s, e) => s + Number(e.amount), 0);
  const total_usd = expenses
    .filter((e) => e.currency === "USD")
    .reduce((s, e) => s + Number(e.amount), 0);

  const catMap = {};
  for (const e of expenses) {
    if (!catMap[e.category]) catMap[e.category] = { ARS: 0, USD: 0, count: 0 };
    catMap[e.category][e.currency] = (catMap[e.category][e.currency] || 0) + Number(e.amount);
    catMap[e.category].count++;
  }

  const by_category = Object.entries(catMap)
    .map(([name, totals]) => ({ name, ...totals }))
    .sort((a, b) => b.ARS - a.ARS);

  const recent = expenses.slice(0, 5).map((e) => ({
    date: e.date,
    category: e.category,
    merchant: e.merchant,
    description: e.description,
    amount: Number(e.amount),
    currency: e.currency,
  }));

  return {
    month: now.toLocaleString("es-AR", { month: "long", year: "numeric" }),
    total_ars,
    total_usd,
    transaction_count: expenses.length,
    by_category,
    recent,
  };
}

async function getRecentExpenses(telegramUserId, limit = 5) {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("telegram_user_id", String(telegramUserId))
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

async function deleteLastExpense(telegramUserId) {
  const { data: rows, error: fetchError } = await supabase
    .from("expenses")
    .select("id")
    .eq("telegram_user_id", String(telegramUserId))
    .order("created_at", { ascending: false })
    .limit(1);

  if (fetchError) throw fetchError;
  if (!rows || rows.length === 0) return null;

  const { error: deleteError } = await supabase
    .from("expenses")
    .delete()
    .eq("id", rows[0].id);

  if (deleteError) throw deleteError;
  return rows[0].id;
}

module.exports = {
  saveExpense,
  getExpensesThisMonth,
  getExpensesLastNMonths,
  getRecentExpenses,
  deleteLastExpense,
  getSummaryForWidget,
};