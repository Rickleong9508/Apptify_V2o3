# APPTIFY — INK & SIGNAL

**Redesign proposal · status: DRAFT, awaiting Product Owner review**

This folder is a **self-contained, isolated design prototype**. It does not import from,
build with, or modify `../src`, `../index.html`, `../vite.config.ts`, or the shipping
bundle. Nothing here ships until the Owner approves it.

```
redesign-preview/
├─ index.html   markup for all 7 screens
├─ app.css      the design system (tokens + components)
├─ app.js       interaction layer, zero dependencies
└─ DESIGN.md    this document
```

Open `index.html` directly in a browser — no build, no server required.
Arrow keys (`←` `→`) step through every screen when reviewing on desktop.

---

## 1. THE BRIEF

| Requirement | Decision |
|---|---|
| Interactive, minimal, mobile-first web app | Device-locked 390×844 canvas that goes full-bleed below 520px |
| Palette limited to four pigments | `#2600FD` · `#0A0A0B` · `#FFBF00` · `#FFFFFF` — nothing else |
| Rework layout and structure, not just colour | New information architecture, new component set, new motion model |
| Do not touch the existing design | Isolated folder, original `src/` untouched |

**Reference read.** The TRANTOR board supplied the structural grammar: white canvas, ink
mass carrying oversized numerals, capsule segmented controls, circular icon buttons,
hairline rules instead of card walls, and a floating dock with a raised centre. The
finance board supplied the information architecture: balance hero, category breakdown,
activity ledger. Both were reinterpreted into one system rather than copied.

---

## 2. PALETTE LAW

Four pigments. Every neutral in the system is black or white carrying alpha — there is no
third hue anywhere, including the greys.

```
--blue    #2600FD   primary action · brand · positive delta · live signal · active state
--ink     #0A0A0B   mass · data panels · typography · structure
--yellow  #FFBF00   attention · warning · over-budget · the raised dock button
--white   #FFFFFF   canvas
```

### The surface rule (resolves blue-vs-yellow for "positive")

Blue on ink fails contrast, so the role of "positive" is carried by a different pigment
depending on the surface it sits on. This is deliberate and consistent, not drift:

| Surface | Positive / gain | Attention / warning |
|---|---|---|
| White or paper | **blue** | **yellow** |
| Ink (`#0A0A0B`) | **yellow** | **yellow** |

Examples: `+$1,284.20` on a white ledger row is blue. `+2.74% today` inside the black hero
panel is yellow. `+11.4% YTD` on the black portfolio panel is yellow.

### Ladders

Neutrals are never hard-coded twice. They are declared once as alpha steps of ink:
`--ink-88 / 72 / 56 / 40 / 24 / 14 / 08 / 05 / 03`, plus the on-ink ladder
`--on-ink-70 / 45 / 20 / 10`. Blue and yellow appear only as tints for fills:
`--blue-12/08/04`, `--yellow-16/08`.

---

## 3. TYPOGRAPHY

**Geist** + **Geist Mono** (system sans fallback). No Inter — it is the default AI look and
it is banned from this system.

| Role | Class | Spec |
|---|---|---|
| Oversized figure | `.figure` | 46px / −0.055em / 600 / tabular |
| Panel figure | `.figure--sm` | 32px / −0.05em |
| Screen title | `.h1` | 27px / −0.038em / 600 |
| Section title | `.sec-head__title` | 15px / −0.02em / 600 |
| Body | `.body` | 14px / 1.5 / `--ink-56` |
| Caption | `.small` | 12.5px / `--ink-56` |
| Micro label | `.micro` | 10.5px / 0.1em / uppercase / mono |

**Rule:** every number that represents money or time is set in `--font-mono` with
`font-variant-numeric: tabular-nums`, so columns never jitter as values animate.

---

## 4. STRUCTURE

Cards are deliberately scarce. Where a border would only decorate, a hairline rule is used
instead (`.rows`, `.row-item`, `.ledger`). Surfaces earn a border or a radius only when
they carry elevation or a distinct data context.

```
Surfaces     .panel (white + 1px hairline)   .panel--ink (black mass)
             .panel--blue (primary)          .panel--yellow (attention)
Controls     .cbtn  circular icon button     .btn  pill button
             .seg   capsule segmented control with sliding indicator
             .chip  filter / tag              .toggle  switch
             .field  input                    .rail  draggable allocation
Data         .figure / .ledger / .bars / .ring / .spark / .bar-mini
             .tile  bento module tile         .rows  hairline group
```

**Radii ladder:** 10 / 14 / 18 / 24 / 30 / 36 / full. Panels use 24, ink heroes use 30,
sheets use 36.

**Spacing:** 4 / 8 / 12 / 14 / 16 / 20 / 24 / 28 / 32 / 40. Page gutter is a single token,
`--gutter: 20px`.

### Depth

No outer neon glows. Depth comes from a tinted shadow (`--lift-1..3`, all neutral) plus a
1px inner edge highlight on ink and blue surfaces, simulating a physical refracted rim:

```css
box-shadow: inset 0 1px 0 rgba(255,255,255,0.09);
```

---

## 5. INFORMATION ARCHITECTURE

Seven screens, replacing the previous launcher-card grid.

| # | Screen | Contents |
|---|---|---|
| 1 | **Launcher** | Ink net-worth hero with sparkline → Ask bar → live ticker → 3-tile bento (MyWealth / NoteDown / NewsHub) → activity ledger → attention strip |
| 2 | **MyWealth** | 5 sub-tabs: Overview, Accounts, Budget, Invest, Loans |
| 3 | **NoteDown** | 3 sub-tabs: Notes, Tasks, Focus |
| 4 | **NewsHub** | Live ticker, filter segments, ink lead story, following feed |
| 5 | **Settings** | Profile, Google Drive sync, appearance, model pickers, preferences |
| 6 | **Ask Apptify** | Full-screen conversation. Dock hidden. |
| 7 | **Onboarding** | Ink full-bleed auth screen with Drive connect |

**Navigation.** A single black dock with four destinations and a raised centre Home button
(the reference's signature move; it turns yellow when Home is active). Ask Apptify left the
dock and became a draggable blue FAB — preserving the original app's "movable copilot"
behaviour while freeing the dock for navigation.

---

## 6. INTERACTION & MOTION

Baseline configuration from the design skill: `DESIGN_VARIANCE 8`, `MOTION_INTENSITY 6`,
`VISUAL_DENSITY 4`.

| Interaction | Where |
|---|---|
| View transitions (fade + 14px rise + 0.985 scale) | Every route change |
| Sliding capsule indicator, spring easing | All segmented controls |
| Number count-up, cubic ease-out over 1.15s | Every `[data-count]` |
| Bar growth, 55ms stagger | Cash flow, focus week |
| Ring stroke draw | Budget |
| Sparkline stroke draw + area fade | Launcher hero |
| Drag-to-rebalance allocation rail | Invest, live label update |
| Drag-to-move FAB with pulse ring | Ask Apptify, any screen |
| Thinking-dots → resolved answer | Ask Apptify intro |
| Infinite market ticker, seamless `-50%` loop | Launcher + NewsHub |
| Task tick fill + strike-through | NoteDown → Tasks |
| Countdown timer | NoteDown → Focus |
| Toast, bottom sheet with scrim | Global |

**Performance guardrails honoured:** animations run only on `transform` / `opacity` /
`stroke-dashoffset`; the grain layer is a fixed `pointer-events:none` overlay, never on a
scrolling container; the ticker and FAB are isolated so they never re-render the page; and
`prefers-reduced-motion` collapses all of it to static.

**States.** Loading (`skeleton` shimmer), empty (`.empty`), and error affordances exist in
CSS. Every interactive surface has an `:active` press state.

---

## 7. RESPONSIVE

- **≥ 520px** — centred device mock on an ink studio stage, with a caption strip naming the
  palette. Review chrome only.
- **< 520px** — full-bleed. Bezel, island and caption disappear; safe-area insets are
  respected; the dock lifts above the home indicator.
- No horizontal overflow at either width (verified).

Two asymmetric layouts fall back to single column below `md`, per the skill's mobile
override.

---

## 8. VERIFICATION

Automated Playwright pass — **18/18, zero console errors**:

dock routing · sub-tab switching · segment indicator measurement · proportion bars filling ·
ring progress · allocation rail drag · task toggle + score · sheet open/close · toast ·
oracle routing · chat intro · chat send · chat reply · toggle switch · status-bar contrast
on ink · no horizontal overflow (mobile + desktop).

### Defects found in review and fixed

1. Proportion bars never filled — inline `width` was parsed against the wrong string.
2. Ledger name and subtitle rendered inline instead of stacked (ellipsis never engaged).
3. Toggles nested inside tappable rows were swallowed by the row's toast handler — a real
   interaction bug in the delegated click order.
4. Status bar was invisible (ink on ink) on the onboarding screen.
5. Logo mark disappeared on ink backgrounds — rebuilt as a blue plate.
6. Five-tab segment control clipped "Loans" — switched to equal-width tabs.
7. Floating handle covered headings on every screen — replaced with a dock-adjacent FAB.
8. Outer glow on the handle violated the anti-glow rule — replaced with a 1px signal ring.
9. Cash-flow bars alternated three colours arbitrarily — reduced to latest (blue) + peak (yellow).
10. Stock photography as a person's avatar — replaced with typographic plates.

---

## 9. MIGRATION PLAN (proposal — not started)

This is a proposal only. Nothing below happens without explicit Owner approval.

**Phase 1 — Tokens.** Replace the light/dark token blocks in `src/styles/globals.css` with
the four-pigment ladder. The existing `--color-*` custom properties keep their names so
Tailwind's `tailwind.config` in `index.html` needs no change.

**Phase 2 — Primitives.** Port `.cbtn`, `.btn`, `.seg`, `.chip`, `.toggle`, `.field`,
`.panel*` into `globals.css`. These are drop-in classes any component can adopt.

**Phase 3 — Shell.** Rebuild the launcher in `src/App.tsx` against the dock + FAB model.
Routing stays hash-based (`#home`, `#wealth`, …) so no router dependency is added.

**Phase 4 — Modules.** Re-skin `MyWealthApp`, `KnowledgeVault`, `NewsHub`,
`GlobalSettings`, `AskApptify`, `AuthModal` one at a time, verifying each in isolation.

**Phase 5 — Remove the old visual layer.** Delete the ambient orb system, the `Inter` font
link (already dead — `index.html` loads it twice but uses Plus Jakarta Sans), and the
glassmorphism token block.

**Deliberately out of scope for this proposal:** dark mode. The brief specifies one palette;
a dark inversion would need its own ink-ladder pass and should be a separate decision.

---

## 10. OPEN QUESTIONS FOR THE OWNER

1. **Scope of adoption** — full replacement, or token-swap first to judge risk?
2. **Dark mode** — the brief implies a single palette. Keep it single, or commission a dark pass?
3. **Brand mark** — the blue plate with the signal glyph is a placeholder; is there a real mark?
4. **Dock vs. FAB** — moving Ask Apptify out of the dock is the biggest navigation change here.
5. **Numbers** — all figures are invented except the user's own name placeholder. Real data
   shape (currency, decimal conventions, CNY vs USD) should be confirmed before porting.
