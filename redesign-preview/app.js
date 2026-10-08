/* ==========================================================================
   APPTIFY — INK & SIGNAL · interaction layer
   Vanilla, dependency-free. Runs straight off the filesystem.
   ========================================================================== */
(function () {
  "use strict";

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const screen = $("#screen");
  const dock = $("#dock");
  const oracle = $("#oracle");
  const toast = $("#toast");
  const toastText = $("#toastText");
  const scrim = $("#scrim");

  /* ======================================================================
     1. ROUTER
     ====================================================================== */
  const ORDER = ["home", "wealth", "notes", "news", "settings", "oracle", "onboarding"];
  let current = "home";

  function replay(root) {
    if (!root) return;
    root.classList.remove("replay-run");
    void root.offsetWidth; /* force reflow so animations restart */
    root.classList.add("replay-run");
  }

  function primeBars(view) {
    $$("[data-bars]", view).forEach((group) => {
      $$(".bars__bar", group).forEach((bar, i) => {
        const h = bar.dataset.h || "0";
        bar.style.height = "0px";
        setTimeout(() => {
          bar.style.height = h + "%";
        }, reduce ? 0 : 320 + i * 55);
      });
    });
  }

  function primeBars2(view) {
    /* proportion bars authored as inline width — convert to animated custom prop */
    $$(".bar-mini > i", view).forEach((el) => {
      if (el.dataset.primed) return;
      const w = parseFloat(el.style.width) || 0;
      el.dataset.primed = "1";
      el.style.setProperty("--w", w + "%");
      el.style.width = "";
    });
  }

  function primeRing(view) {
    $$("[data-ring]", view).forEach((c) => {
      const pct = parseFloat(c.dataset.ring) || 0;
      const r = c.r.baseVal.value;
      const len = 2 * Math.PI * r;
      c.style.strokeDasharray = len;
      c.style.strokeDashoffset = len;
      setTimeout(() => {
        c.style.strokeDashoffset = len * (1 - pct / 100);
      }, reduce ? 0 : 260);
    });
  }

  function primeCounters(view) {
    $$("[data-count]", view).forEach((el) => {
      if (el.dataset.counted === "on") return;
      el.dataset.counted = "on";
      const target = parseFloat(el.dataset.count) || 0;
      const prefix = el.dataset.prefix || "";
      const decimals = parseInt(el.dataset.decimals || "2", 10);
      const dur = reduce ? 0 : 1150;
      const start = performance.now();

      function frame(now) {
        const t = dur === 0 ? 1 : clamp((now - start) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - t, 3);
        const val = target * eased;
        el.textContent =
          prefix +
          val.toLocaleString("en-US", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          });
        if (t < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  function go(view, opts) {
    const name = ORDER.includes(view) ? view : "home";
    const target = $('.view[data-view="' + name + '"]');
    if (!target) return;

    const back = opts && opts.back;
    $$(".view").forEach((v) => {
      v.classList.toggle("is-active", v === target);
      v.removeAttribute("data-dir");
      if (v === target && back) v.setAttribute("data-dir", "back");
    });

    current = name;
    history.replaceState(null, "", "#" + name);

    /* Chrome state */
    const noDock = target.dataset.nodock === "true";
    dock.hidden = noDock;
    oracle.hidden = noDock;
    screen.setAttribute("data-ink-chrome", target.dataset.inkChrome === "true" ? "true" : "false");

    /* Dock highlight */
    $$(".dock__item").forEach((b) => b.classList.toggle("is-on", b.dataset.goto === name));
    $(".dock__home").classList.toggle("is-on", name === "home");

    /* Oracle handle hides while the oracle view is open */
    if (name === "oracle") oracle.hidden = true;

    target.scrollTop = 0;
    const root = $(".replay", target);
    replay(root);
    primeBars2(root || target);
    primeCounters(target);
    primeBars(target);
    primeRing(target);

    /* Segmented indicators need a fresh measurement post-layout */
    requestAnimationFrame(() => $$("[data-seg]", target).forEach(syncSeg));
  }

  /* Delegated click handling.
     Order matters: innermost concerns resolve before their containers, so a
     toggle nested inside a tappable row still toggles instead of firing the
     row's toast. */
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-sheet]")) {
      closeSheets();
      return;
    }

    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      toggle.classList.toggle("is-on");
      return;
    }

    const task = e.target.closest("[data-task]");
    if (task) {
      task.classList.toggle("is-done");
      updateTaskScore();
      return;
    }

    const sug = e.target.closest("[data-suggest]");
    if (sug) {
      sendMessage(sug.dataset.suggest);
      return;
    }

    const goBtn = e.target.closest("[data-goto]");
    if (goBtn && !goBtn.dataset.dragged) {
      go(goBtn.dataset.goto);
      return;
    }

    const backBtn = e.target.closest("[data-back]");
    if (backBtn) {
      go(backBtn.dataset.back, { back: true });
      return;
    }

    const sheetBtn = e.target.closest("[data-sheet]");
    if (sheetBtn) {
      openSheet(sheetBtn.dataset.sheet);
      return;
    }

    const toastBtn = e.target.closest("[data-toast]");
    if (toastBtn) {
      showToast(toastBtn.dataset.toast);
    }
  });

  window.addEventListener("hashchange", () => {
    const h = location.hash.replace("#", "");
    if (h && h !== current) go(h);
  });

  /* ======================================================================
     2. SEGMENTED CONTROLS
     ====================================================================== */
  function syncSeg(seg) {
    const ind = $(".seg__ind", seg);
    const on = $(".seg__item.is-on", seg);
    if (!ind || !on) return;
    ind.style.width = on.offsetWidth + "px";
    ind.style.transform = "translateX(" + on.offsetLeft + "px)";
  }

  document.addEventListener("click", (e) => {
    const item = e.target.closest(".seg__item");
    if (!item) return;
    const seg = item.closest("[data-seg]");
    if (!seg) return;

    $$(".seg__item", seg).forEach((b) => b.classList.toggle("is-on", b === item));
    syncSeg(seg);

    const sub = item.dataset.sub;
    if (!sub) {
      showToast(item.textContent.trim() + " filter applied");
      return;
    }

    const view = seg.closest(".view");
    $$(".wsub", view).forEach((p) => {
      const match = p.dataset.sub === sub;
      p.hidden = !match;
      if (match) {
        const root = p;
        replay(root);
        primeBars2(root);
        primeCounters(root);
        primeBars(root);
        primeRing(root);
      }
    });

    /* Cards inside a freshly revealed panel need their own count-up */
    primeCounters(view);
  });

  window.addEventListener("resize", () => {
    const active = $(".view.is-active");
    if (active) $$("[data-seg]", active).forEach(syncSeg);
  });

  /* ======================================================================
     3. TOAST
     ====================================================================== */
  let toastTimer;
  function showToast(msg) {
    if (!msg) return;
    toastText.textContent = msg;
    toast.classList.add("is-open");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-open"), 2200);
  }

  /* ======================================================================
     4. SHEETS
     ====================================================================== */
  function openSheet(id) {
    const sheet = document.getElementById(id);
    if (!sheet) return;
    scrim.classList.add("is-open");
    sheet.classList.add("is-open");
  }

  function closeSheets() {
    scrim.classList.remove("is-open");
    $$(".sheet").forEach((s) => s.classList.remove("is-open"));
  }

  scrim.addEventListener("click", closeSheets);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheets();
  });

  /* ======================================================================
     5. ALLOCATION RAIL (drag to rebalance)
     ====================================================================== */
  $$("[data-rail]").forEach((rail) => {
    const fill = $(".rail__fill", rail);
    const knob = $(".rail__knob", rail);
    const label = $("#allocLabel");
    let dragging = false;

    function paint(pct) {
      fill.style.width = pct + "%";
      knob.style.left = pct + "%";
      if (label) {
        const equity = Math.round(pct);
        label.textContent = equity + "% equity · " + (100 - equity) + "% bonds";
      }
    }

    function fromEvent(e) {
      const r = rail.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const raw = (x / r.width) * 100;
      return clamp(Math.round(raw / 2) * 2, 10, 100);
    }

    function down(e) {
      dragging = true;
      rail.classList.add("is-dragging");
      paint(fromEvent(e));
      e.preventDefault();
    }

    function move(e) {
      if (!dragging) return;
      paint(fromEvent(e));
      e.preventDefault();
    }

    function up() {
      if (!dragging) return;
      dragging = false;
      rail.classList.remove("is-dragging");
      showToast("Rebalance preview saved to plan");
    }

    rail.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    rail.addEventListener("touchstart", down, { passive: false });
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("touchend", up);
  });

  /* ======================================================================
     6. LIVE TICKER
     ====================================================================== */
  const FEED = [
    ["OMXS30", "2,614.38", "+0.62%"],
    ["S&P 500", "5,842.10", "+0.31%"],
    ["NVDA", "$176.42", "+2.14%"],
    ["USD/SEK", "10.418", "−0.22%"],
    ["BTC", "$68,240", "+1.48%"],
    ["BRENT", "$81.06", "−0.44%"],
    ["OMXS30", "2,614.38", "+0.62%"],
    ["S&P 500", "5,842.10", "+0.31%"],
  ];

  function fillTicker(node) {
    if (!node) return;
    const html = FEED.map(
      (r) =>
        '<span class="ticker__item"><b>' +
        r[0] +
        "</b><span>" +
        r[1] +
        '</span><span class="up">' +
        r[2] +
        "</span></span>"
    ).join("");
    node.innerHTML = html + html;
  }
  fillTicker($("#tickerTrack"));
  fillTicker($("#tickerTrack2"));

  /* ======================================================================
     7. TASKS
     ====================================================================== */
  function updateTaskScore() {
    const all = $$("[data-task]");
    const done = $$("[data-task].is-done").length;
    const total = all.length || 1;
    const pct = Math.round((done / total) * 100);
    const score = $("#taskScore");
    const bar = $("#taskBar");
    if (score) score.textContent = done + " / " + total;
    if (bar) bar.style.width = pct + "%";
  }

  /* ======================================================================
     8. FOCUS TIMER
     ====================================================================== */
  (function focusTimer() {
    const clock = $("#focusClock");
    const btn = $("#focusToggle");
    if (!clock || !btn) return;

    let remaining = 25 * 60;
    let id = null;

    function render() {
      const m = String(Math.floor(remaining / 60)).padStart(2, "0");
      const s = String(remaining % 60).padStart(2, "0");
      clock.textContent = m + ":" + s;
    }

    function tick() {
      remaining -= 1;
      if (remaining <= 0) {
        remaining = 0;
        stop();
        showToast("Session complete — take the break");
      }
      render();
    }

    function stop() {
      clearInterval(id);
      id = null;
      btn.textContent = "Start session";
    }

    btn.addEventListener("click", () => {
      if (id) {
        stop();
      } else {
        btn.textContent = "Pause";
        id = setInterval(tick, 1000);
        showToast("Focus session started");
      }
    });

    render();
  })();

  /* ======================================================================
     9. ASK APPTIFY
     ====================================================================== */
  const chat = $("#chat");
  const chatInput = $("#chatInput");

  function addMsg(html, mine) {
    const d = document.createElement("div");
    d.className = "msg " + (mine ? "msg--me" : "msg--ai");
    d.innerHTML = mine ? html : '<div class="msg__meta">Apptify</div>' + html;
    chat.appendChild(d);
    chat.parentElement.parentElement.scrollTop = 99999;
    return d;
  }

  function addTyping() {
    return addMsg('<span class="typing"><i></i><i></i><i></i></span>', false);
  }

  const REPLIES = [
    "Your study loan carries the higher balance but the lower rate. Paying the car finance first saves <b>$412</b> over the remaining term.",
    "Three of today's stories touch your holdings: semiconductors up, freight easing, and the krone soft against the dollar. Net effect on your portfolio is roughly <b>+0.4%</b>.",
    "Drafted. I linked it to the August ledger and the Aurora Savings balance so the numbers stay true if anything moves.",
  ];
  let replyIdx = 0;
  let chatStarted = false;

  function sendMessage(text) {
    if (!text) return;
    addMsg(text.replace(/</g, "&lt;"), true);
    const t = addTyping();
    setTimeout(() => {
      t.remove();
      addMsg(REPLIES[replyIdx % REPLIES.length]);
      replyIdx += 1;
    }, 1400);
  }

  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        sendMessage(chatInput.value.trim());
        chatInput.value = "";
      }
    });
  }
  const chatSend = $("#chatSend");
  if (chatSend) {
    chatSend.addEventListener("click", () => {
      sendMessage(chatInput.value.trim() || "Give me a quick summary of this week");
      chatInput.value = "";
    });
  }

  /* Opening sequence: thinking dots resolve into the answer */
  function runChatIntro() {
    if (chatStarted) return;
    chatStarted = true;
    const typing = $("#aiTyping");
    const answer = $("#aiAnswer");
    if (typing) typing.hidden = false;
    if (answer) answer.hidden = true;
    setTimeout(() => {
      if (typing) typing.hidden = true;
      if (answer) answer.hidden = false;
    }, reduce ? 0 : 1700);
  }

  /* ======================================================================
     10. ORACLE FAB — free drag (right / bottom), click still navigates
     ====================================================================== */
  (function dragOracle() {
    if (!oracle) return;
    let startX = 0;
    let startY = 0;
    let startRight = 0;
    let startBottom = 0;
    let moved = 0;
    let dragging = false;

    oracle.addEventListener("pointerdown", (e) => {
      const sr = screen.getBoundingClientRect();
      const or = oracle.getBoundingClientRect();
      dragging = true;
      moved = 0;
      startX = e.clientX;
      startY = e.clientY;
      startRight = sr.right - or.right;
      startBottom = sr.bottom - or.bottom;
      oracle.classList.add("is-dragging");
      oracle.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    oracle.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
      const w = screen.clientWidth;
      const h = screen.clientHeight;
      oracle.style.right = clamp(startRight - dx, 10, w - 74) + "px";
      oracle.style.bottom = clamp(startBottom - dy, 86, h - 220) + "px";
    });

    function end() {
      if (!dragging) return;
      dragging = false;
      oracle.classList.remove("is-dragging");
      if (moved > 6) {
        oracle.dataset.dragged = "1";
        setTimeout(() => delete oracle.dataset.dragged, 260);
      }
    }

    oracle.addEventListener("pointerup", end);
    oracle.addEventListener("pointercancel", end);
  })();

  /* ======================================================================
     11. TILE SPOTLIGHT
     ====================================================================== */
  $$(".tile--spot").forEach((tile) => {
    tile.addEventListener("pointermove", (e) => {
      const r = tile.getBoundingClientRect();
      tile.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
      tile.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
    });
  });

  /* ======================================================================
     12. GREETING BY CLOCK
     ====================================================================== */
  (function greeting() {
    const el = $("#greeting");
    if (!el) return;
    const h = new Date().getHours();
    el.textContent =
      h < 5 ? "STILL UP" : h < 12 ? "GOOD MORNING" : h < 18 ? "GOOD AFTERNOON" : "GOOD EVENING";
  })();

  /* ======================================================================
     13. KEYBOARD NAVIGATION (desktop review aid)
     ====================================================================== */
  document.addEventListener("keydown", (e) => {
    if (e.target.matches("input, textarea")) return;
    const i = ORDER.indexOf(current);
    if (e.key === "ArrowRight" && i < ORDER.length - 1) go(ORDER[i + 1]);
    if (e.key === "ArrowLeft" && i > 0) go(ORDER[i - 1], { back: true });
  });

  /* ======================================================================
     14. BOOT
     ====================================================================== */
  function boot() {
    const h = location.hash.replace("#", "");
    go(ORDER.includes(h) ? h : "home");
    updateTaskScore();
    setTimeout(runChatIntro, 400);
    setTimeout(() => {
      const s = $("#taskBar");
      if (s) s.style.width = "40%";
    }, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  /* Desktop review note */
  console.info(
    "%cApptify · Ink & Signal%c\nPreview only — /src untouched.\nArrow keys switch screens.",
    "font-weight:600;font-size:12px",
    "color:#666;font-size:11px"
  );
})();
