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
  // get the most recent one
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
  getRecentExpenses,
  deleteLastExpense,
};
