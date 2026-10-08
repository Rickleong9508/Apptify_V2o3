> **Read this before reviewing the prototype.**
>
> The prototype in this folder is a **visual and interaction design layer only.**
> It contains **no application functionality**. Every figure on screen is hardcoded.
> It has no persistence, no AI, no network, no cloud sync, no calculations.
>
> The existing Apptify application in `../src` has **not** been touched and **still has
> every feature it had before.** Nothing has been lost or replaced.

# APPTIFY — FEATURE PARITY AUDIT

**Method:** static audit of `../src`, `../server.js` and `../api` — every module, service,
component and storage key read directly from source. Date of audit: this session.

**Conclusion:** the prototype covers **0 %** of the application's functionality.
It is a design proposal, not a functional build. The gap is the entire feature set.

---

## 1. WHAT THE PROTOTYPE ACTUALLY IS

| | Prototype (`redesign-preview/`) | Real app (`src/`) |
|---|---|---|
| Purpose | Show the proposed look and feel | Run the product |
| Data | Hardcoded strings in HTML | `localStorage` + Google Drive |
| Calculations | None — numbers are literals | Live, multi-currency, derived |
| AI | Canned replies in `app.js` | 6 providers + function-calling skills |
| Network | None | RSS, quotes, AI proxies, Drive REST |
| Persistence | None — refresh resets everything | 21 storage keys, auto-synced |
| Auth | A button that navigates | Google OAuth with silent refresh |

**This is expected and correct for a design review.** It becomes a problem only if it is
mistaken for a functional build. It must not be shipped as one.

---

## 2. COMPLETE FUNCTIONAL INVENTORY OF THE REAL APP

Everything below exists today and **must survive the redesign.**

### A. Launcher (`src/App.tsx`)
- Hash router: `#launcher` · `#mywealth` · `#knowledgevault` · `#settings` · `#newshub`
- Live net worth = cash + investments, **excluding loans**, in three switchable views
  (`total` / `cash` / `invest`)
- **Quick-Jot scratchpad** — one input that files straight into NoteDown as a task or a note
- Live note count and task count badges, updated from the vault
- Live clock
- Theme: auto-follows the OS, plus a manual override flag
- Bilingual EN / 中文 throughout
- Global AI provider + model picker with favourites, recents, and a cached SiliconFlow catalogue
- First-run welcome / login modal, dismissible per session

### B. MyWealth (`MyWealthApp.tsx` + 8 components)
- **Dashboard** — multi-currency cash (MYR / USD / HKD) converted through a live exchange
  rate and a separate HKD rate; net-worth aggregation; pie chart; actual-vs-budget toggle;
  show-all expansion
- **Accounts** — create / edit / delete accounts; interest rate with DAILY / MONTHLY /
  YEARLY / NONE compounding; per-account transaction ledger; **reserve amounts with a
  reason**; a built-in calculator; inline rename and rate editing; delete confirmation
- **Budget** — monthly income, expense-category enum, recurring-expense flag, per-line limits
- **Investments** — multi-currency holdings; buy / sell / edit transactions; drag-to-reorder;
  live quotes; cost basis and unrealised P/L aggregated in MYR; quote refresh; broker idle cash
- **Loans** — create / edit / delete; principal, monthly payment, repayment records
- **AiValuation / AutoCount** — AI valuation and investment research skills that read the
  prompt library in `invest-skills/` (12 skill files) and produce saved HTML reports
- Persisted to `mw_data_main`, synced to Drive

### C. NoteDown (`KnowledgeVault.tsx`)
- **Notes** — CRUD, categories `work / idea / meeting / life`, full-text search
- **Tasks** — CRUD, `high / medium / low` priority, `all / pending / completed` filters
- **Focus** — 25-minute Pomodoro, `work / break` modes, completed-session counter
- **Vector embeddings** (`app_notes_embeddings`) supporting semantic retrieval
- Listens for external writes from the Copilot, from Drive sync, and from logout
- Persisted to `apptify_notes` / `apptify_tasks`

### D. NewsHub (`NewsHub.tsx`)
- 6 preset RSS sources per language (EN + 中文), including Google News, Yahoo Finance, BBC,
  and Oriental Daily
- User-defined custom RSS sources (`app_custom_news_sources`)
- **AI per-article translation** of title and summary
- **AI summarisation** of any article
- Server-side feed fetching through `/api/news` (cheerio + RSS parsing)

### E. Ask Apptify Copilot (`AskApptify.tsx` + `skillRegistry.ts`)
- Draggable button whose position persists (`apptify_copilot_coords`)
- **6 AI providers:** Google · DeepSeek · OpenAI · Anthropic · SiliconFlow · OpenRouter
- **Function-calling skill registry with three skill groups:**
  - *MyWealth* — deposit, record expense, transfer between wallets, add budget line,
    add loan, record loan repayment, query net worth / wallets / budget / loans
  - *NoteDown* — create and manage notes and tasks
  - *System* — navigation and app control
- **Confirmation step before any write** (`pendingConfirm`)
- **Multimodal image input**
- Bilingual

### F. Settings (`GlobalSettings.tsx`)
- API key management for all 6 providers
- **SiliconFlow model hub** — search, capability filter, sub-provider filter, context-length
  filter, favourites, recents, catalogue caching
- Connection test with status states
- Google Drive connect / disconnect and Client ID configuration

### G. Cloud sync and account (`AuthProvider.tsx`, `driveService.ts`)
- Google Drive BYOS, file `Apptify_Cloud_Data.json` (legacy `MyWealth_Backup.json`)
- Silent token refresh, a 20-minute keep-alive, and auto-sync on tab visibility
- Re-auth detection
- **Logout wipes all local user data**
- A secondary Supabase sync path (`syncService.ts`) retained as a fallback

### H. Server (`server.js` + `api/`)
- `/api/news` — RSS fetch proxy
- `/api/process_input` — file / PDF input parsing
- `/api/invest_skills/*` — list, read, and save investment reports
- `/api/obsidian/*` — local vault read/write (still used by the video-summary skill)
- Stock data: Nasdaq company + quote endpoints, Yahoo quote endpoint
- Vite dev proxies for DeepSeek, OpenAI, Anthropic, SiliconFlow

### I. Persistence surface — 21 keys that must keep working
```
mw_data_main              all wealth data
mw_theme / mw_theme_manual
apptify_notes / apptify_tasks / apptify_language
apptify_copilot_coords    apptify_welcome_dismissed
gn_notes / gn_todos / gn_meta
app_notes_embeddings
app_global_ai_provider / app_global_ai_model / app_global_api_key
app_api_key_{google,deepseek,openai,anthropic,siliconflow,openrouter}
app_ai_favorites / app_ai_recent / app_siliconflow_models_cache
app_custom_news_sources
```

---

## 3. THE GAP

| Area | Prototype | Real app | Gap |
|---|---|---|---|
| Screens and layout | 7 fully designed | 5 modules | **Prototype leads** |
| Visual system | Complete | Old glassmorphism | **Prototype leads** |
| Data model | none | `mw_data_main` etc. | 100 % missing |
| Persistence | none | 21 keys | 100 % missing |
| Wealth calculations | none | live multi-currency | 100 % missing |
| CRUD on every entity | none | complete | 100 % missing |
| AI integration | canned strings | 6 providers, tools | 100 % missing |
| Copilot skills | none | 3 skill groups | 100 % missing |
| News pipeline | static cards | live RSS + AI | 100 % missing |
| Search / embeddings | none | vector search | 100 % missing |
| Drive sync / OAuth | none | full | 100 % missing |
| i18n | English only | EN + 中文 | 100 % missing |
| Server APIs | none | 8 endpoints | 100 % missing |

---

## 4. THE CORRECT PLAN — PORT THE DESIGN IN, NEVER REWRITE THE APP

The prototype is **not** a replacement codebase. It is a **specification**. The design gets
applied *onto* the existing React app, so no logic, service, state or storage key is ever
rewritten.

### Why this is safe

The existing app separates concerns cleanly: `globals.css` holds the token layer,
`index.html` holds the Tailwind theme, and the components hold the logic. **Restyling
touches only the first two plus JSX class names — never the state or service layers.**

### Phases

| # | Work | Files touched | Logic touched | Reversible |
|---|---|---|---|---|
| 0 | Branch + verify baseline | — | none | — |
| 1 | **Token swap only** — four-pigment ladder, Geist, new radii | `globals.css`, `index.html` | **none** | yes |
| 2 | Add new primitive classes (`.cbtn`, `.seg`, `.chip`, `.panel*`) | `globals.css` | **none** | yes |
| 3 | Re-skin launcher shell | `App.tsx` JSX only | none | yes |
| 4 | Re-skin MyWealth (5 sub-views) | `MyWealthApp` + children JSX | none | yes |
| 5 | Re-skin NoteDown | `KnowledgeVault.tsx` JSX | none | yes |
| 6 | Re-skin NewsHub | `NewsHub.tsx` JSX | none | yes |
| 7 | Re-skin Settings | `GlobalSettings.tsx` JSX | none | yes |
| 8 | Re-skin Ask Apptify | `AskApptify.tsx` JSX | none | yes |
| 9 | Re-skin Auth / onboarding | `AuthModal.tsx` JSX | none | yes |
| 10 | Remove the dead visual layer (orbs, Inter, glass tokens) | `globals.css`, `index.html` | none | yes |

### Phase 1 is the proof

After Phase 1 the app **looks completely new but behaves identically** — same data, same
sync, same AI, same 21 storage keys. That is the moment to verify nothing was lost, before
any component is touched.

### Commit discipline

One commit per phase, message `style(<module>): ink & signal redesign`. Any phase can be
reverted in isolation. The existing
`Apptify_V2o3_backup_before_redesign_20261007` folder and `backup/backup_before_googledrive_source.tar.gz`
remain untouched as a second safety net.

### Definition of done for the port

Not "it looks like the prototype." It is: **every item in section 2 still works, verified
by walking each one in the running app**, plus the 18 automated interaction checks passing
against the real build.

---

## 5. WHAT I NEED FROM YOU

1. **Confirm the port approach** — design applied onto the existing app, logic untouched.
2. **Or** tell me if you would rather I first rebuild the prototype to be functional
   (I would advise against it — that is duplicated work that gets thrown away).
3. **Confirm Phase 1 scope** — token swap only, so you can check that every feature still
   works before I touch a single component.
