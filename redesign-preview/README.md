# Apptify — Redesign Preview (Ink & Signal)

**DRAFT — awaiting Owner approval. Nothing here is wired into the app.**

> ## ⚠️ THIS IS A DESIGN MOCK, NOT A WORKING APP
>
> It has **no functionality**. Every number is hardcoded. No storage, no AI, no sync,
> no calculations. Tapping things only plays an animation.
>
> **Your real app is untouched and still has every feature.** `src/` is unchanged —
> `git status` shows only this new folder.
>
> Read [`FEATURE_PARITY.md`](FEATURE_PARITY.md) for the full audit of what the real app
> does, what this prototype is missing, and the plan to apply this design onto the real
> codebase without losing anything.

A standalone, dependency-free interactive prototype of a proposed Apptify redesign.

## View it

**Option A — just open it.** Double-click `index.html`. No build, no server, no install.

**Option B — local server** (if you want the file paths clean in DevTools):

```bash
cd redesign-preview
python3 -m http.server 4177 --bind 127.0.0.1
# then open http://127.0.0.1:4177/index.html
```

Once running at <http://127.0.0.1:4177/index.html>, use `←` / `→` to step through every
screen on desktop.

## What to try

| Screen | Try this |
|---|---|
| Launcher | Watch the balance count up, the sparkline draw, the ticker scroll |
| MyWealth | Tap through all five sub-tabs; drag the allocation rail on **Invest** |
| NoteDown | Tick tasks and watch the score update; start the Focus timer |
| NewsHub | Let the ticker loop seamlessly |
| Settings | Flip the switches — note they work inside tappable rows |
| Ask Apptify | Type and send; or tap a suggestion chip |
| Onboarding | Reachable at `#onboarding` |

The blue sparkle button floats above every screen — **drag it anywhere**, tap to open
Ask Apptify. The dock's raised centre button turns yellow on Home.

## Files

```
index.html        all 7 screens
app.css           the design system: four-pigment tokens + components
app.js            interaction layer, plain ES5-compatible JS
DESIGN.md         full design rationale, palette law, IA, migration plan
screens/          rendered reference of every screen and sub-tab
verify/           Playwright scripts used for QA
```

## Re-running the QA

Needs Playwright with Chromium:

```bash
python3 -m playwright install chromium
cd redesign-preview
python3 -m http.server 4177 --bind 127.0.0.1 &   # verify scripts target this URL
python3 verify/functional.py    # 18 interaction assertions
python3 verify/shoot.py         # regenerate screens/
```

Last run: **18/18 passing, zero console errors.**

## Status

| | |
|---|---|
| Original app modified | **No** — `src/`, `index.html`, `vite.config.ts` all unchanged |
| Ready to port | **No** — this is a design review artifact |
| Next step | Owner review → approve direction → Phase 1 of `DESIGN.md` §9 |
