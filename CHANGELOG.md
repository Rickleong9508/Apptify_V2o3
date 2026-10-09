# Changelog

All notable changes to Apptify are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [2.3.0] — BingGo

The assistant era. Ask Apptify is replaced by **BingGo**, a resident assistant
that can actually operate the app rather than only discuss it — with a face, a
voice, and a memory.

### Added

**The character**
- BingGo: a blue rounded square with two white pill eyes, rebuilt as live DOM
  rather than an image reference. Proportions measured off the source artwork
  (462×444) and expressed as percentages, so one component serves every size
  from 28px to 190px.
- Seven expressions — `idle`, `blink`, `think`, `happy`, `sad`, `listen`,
  `speak` — plus **eight idle gestures** fired at random intervals: glance left,
  glance right, look up, double blink, wink, tilt left, tilt right, squash. The
  cadence is deliberately irregular and never repeats the previous gesture,
  because a fixed rhythm reads as an animation loop and a random one reads as a
  creature.
- Every motion animates `transform` and `border-radius` only, so each morph is
  GPU-composited, triggers no layout, and can be interrupted mid-flight.
- **Pettable.** Tap the character and it is pleased, with a shake that settles.
  A tap overrides any held expression, because it is a direct response to being
  touched. Keyboard-reachable (Tab + Enter/Space).
- Full `prefers-reduced-motion` support.

**The assistant**
- `BingGoHomeCard` — the launcher entry: a brand-blue panel with the body
  dropped out so only the signature eyes remain, and exactly one action.
- `BingGoFab` — a borderless summon button on every screen except the launcher.
  Draggable anywhere, with the position persisted, and clamped so it can never
  come to rest underneath the dock.
- `BingGoAssistant` — one sheet, two modes sharing a single state machine:
  - **chat** — transcript, composer, image attachments, microphone
  - **call** — the whole page in brand blue, where the body disappears into the
    background and only the eyes remain, emoting as the conversation moves
- **Voice**: speech synthesis and recognition through the browser's native
  APIs. No extra key, no extra service. Markdown is stripped before speaking;
  long replies are chunked sentence-aware. Unsupported browsers degrade quietly.
- **Memory**: conversations persist across reloads, recall earlier context by
  embedding similarity with a keyword fallback, and sync with Google Drive.
- **Vision**: image attachments via the existing multimodal path.
- **Skill coverage** extended with `ADD_BUDGET`, `ADD_LOAN`, `REPAY_LOAN`,
  `SEARCH_NOTES`, `QUERY_NOTES`, `UPDATE_NOTE`, `DELETE_NOTE` and `DELETE_TASK`.
- Voice replies toggle, live status, bilingual (English / Chinese).

**Infrastructure**
- `services/skillExecutor.ts` — the skill engine lifted out of the 1164-line
  `AskApptify` component into a shared service, so the assistant and the old
  component could never become two copies of the same logic drifting apart.
  Navigation is now an injected `ctx.navigate` callback.
- `services/voiceService.ts`, `services/memoryService.ts`.
- `docs/BINGGO.md` — the plan, the decisions, and a per-round record of what was
  verified and how.

### Changed

- **Launcher** rebuilt: BingGo leads, the MyWealth hero is ink, the two module
  tiles are equal halves, and the NoteDown card is now clickable anywhere rather
  than only from its footer link.
- **Colour balance** settled on blue as the mass, ink for weight, and yellow
  reserved for emphasis — including the rule that on a blue surface, emphasis is
  yellow.
- The AI service no longer folds model reasoning into its return value. It was
  written for a UI that renders raw markdown, but it polluted every caller: the
  news summariser printed reasoning into summaries, and every caller parsing the
  reply as data failed and fell back to showing raw text.
- `aiService.chat` returns the answer alone; reasoning is used only as a last
  resort when the model produced no answer at all.

### Fixed

Three pre-existing defects, all found by driving the feature rather than by
reading it:

- **The skill engine replied "done" to intents it never implemented.**
  `skillRegistry` advertised `ADD_BUDGET`, `ADD_LOAN`, `REPAY_LOAN` and
  `SEARCH_NOTES` from the beginning, but `executeAction` had no branch for any
  of them and the fallback claimed success. The fallback now reports honestly
  and is verified to leave data untouched when it cannot act.
- **A note created through the assistant crashed the NoteDown screen.** The
  engine stored the field as `tag`; the screen reads `category`. The resulting
  `CATEGORY_MAP[undefined]` took the whole page down. Fixed on both sides: the
  engine writes both fields, and the screen falls back to a neutral chip for any
  category it does not recognise.
- **Navigating from the assistant left the full-screen sheet covering the page
  it had just routed to.**

And two found after release:

- **The close button was unreachable on a notched phone.** The top safe area had
  never been handled — the headers used a fixed `pt-3`/`pt-4` against a ~59px
  iPhone inset, so the button sat inside the status bar and there was no way out
  of the call screen. Verified by injecting a real 59px inset through CDP, not
  by reading the CSS.
- **`Speak` and `End` looked identical.** Both were white-filled, so the primary
  action and the hang-up action were indistinguishable. They are now three
  distinct treatments using only the four pigments.

Also: the reasoning leak into the transcript (fixed by robust balanced-brace
JSON extraction with a reasoning-stripping pass, verified against the exact
response that caused it plus five other shapes); the call-view preview cutting
mid-word; and emoji inherited from the old assistant copy, which was changing
the assistant's voice mid-conversation.

### Notes for local setup

- **Use `http://localhost:3001`, not `http://127.0.0.1:3001`.** They are
  different origins to Google. The OAuth client is registered for `localhost`,
  and `127.0.0.1` returns `origin_mismatch`. To use the IP form, add it to the
  authorised JavaScript origins in Google Cloud Console as well.

---

## [2.2.0] — Ink & Signal

The redesign. Four pigments and nothing else: `#2600FD` blue as the mass,
`#0A0A0B` ink for weight, `#FFBF00` yellow for emphasis, `#FFFFFF` canvas.

- Full palette remap; the entire `dark:` layer retired along with dark mode.
- iPhone 17 Pro Max content gutter via `env(safe-area-inset-*)`.
- A global bottom dock: black capsule, 288×56, mathematically centred Home.
- MyWealth, NoteDown, NewsHub and Settings rebuilt against the new system;
  typography moved to Geist and Geist Mono.
- Monthly cash-flow chart, yellow identity plates on every module, and a
  black net-worth hero.

---

## [2.0.0] — Baseline

Multi-account wealth tracking, budgeting, loan amortisation, portfolio and
multi-currency holdings, AI valuation modelling, NoteDown notes and tasks,
NewsHub with a 24-prompt investment research library, and 100% private Google
Drive BYOS sync.
