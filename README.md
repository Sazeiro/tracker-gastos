# gastos-bot 💸

Telegram bot that tracks your expenses using Claude for parsing and categorization.

## Stack
- **Node.js + Express** — backend
- **Railway** — hosting
- **Claude API (Sonnet)** — natural language parsing
- **Supabase** — Postgres database

---

## Setup

### 1. Create a Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts
3. Copy your **bot token** — looks like `123456789:ABCdef...`

---

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Go to **SQL Editor** and run the contents of `supabase_migration.sql`
3. Go to **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role key** (under "Project API keys") → `SUPABASE_SERVICE_KEY`

---

### 3. Get your Anthropic API key

Go to [console.anthropic.com](https://console.anthropic.com) and create an API key.

---

### 4. Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) and create a **New Project → Deploy from GitHub repo**
3. Select your repo
4. Go to **Variables** and add all the env vars from `.env.example`:

```
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=any_random_string_you_choose
ANTHROPIC_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
APP_URL=https://your-app.up.railway.app   ← set AFTER first deploy
```

5. Deploy. Once it's live, copy the Railway URL and set it as `APP_URL`, then redeploy.
   The server registers the Telegram webhook automatically on startup.

---

## Usage

Send messages to your bot:

| Message | What happens |
|---|---|
| `uber 2500` | Logs ARS 2500 transport |
| `café 850 pesos` | Logs ARS 850 food |
| `netflix 15 usd` | Logs USD 15 subscription |
| `supermercado 12000` | Logs ARS 12000 groceries |
| `¿cuánto gasté este mes?` | Claude answers from your data |
| `/resumen` | Monthly summary by category |
| `/ultimos` | Last 5 expenses |
| `/borrar` | Delete last expense |

---

## Project structure

```
src/
  index.js    — Express server + webhook registration
  handler.js  — Routes Telegram messages to actions
  claude.js   — Parses expenses + answers queries
  db.js       — Supabase operations
```
