import os
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4177/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screens")
os.makedirs(OUT, exist_ok=True)

fails = []
def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name + ((" :: " + str(extra)) if extra and not cond else ""))
    if not cond:
        fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 900, "height": 1000}, device_scale_factor=2)
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(BASE + "#home")
    pg.wait_for_timeout(2200)

    # 1. Dock navigation
    pg.click('.dock__item[data-goto="wealth"]')
    pg.wait_for_timeout(700)
    check("dock -> wealth", pg.get_attribute('.view[data-view="wealth"]', "class").find("is-active") >= 0)

    # 2. Segmented sub-tab
    pg.click('.seg[data-seg="wealth"] .seg__item[data-sub="budget"]')
    pg.wait_for_timeout(600)
    check("wealth sub-tab budget", pg.is_visible('.wsub[data-sub="budget"]') and not pg.is_visible('.wsub[data-sub="overview"]'))
    ind_w = pg.evaluate('document.querySelector(\'.seg[data-seg="wealth"] .seg__ind\').style.width')
    check("seg indicator measured", ind_w not in ("", "0px"), ind_w)

    # 3. Proportion bars actually filled
    w = pg.evaluate('''() => {
      const el = document.querySelector('.wsub[data-sub="budget"] .bar-mini > i');
      return parseFloat(getComputedStyle(el).width) / parseFloat(getComputedStyle(el.parentElement).width);
    }''')
    check("envelope bar filled", w > 0.5, w)

    # 4. Ring drawn
    off = pg.evaluate('document.querySelector("[data-ring]").style.strokeDashoffset')
    check("ring progress drawn", off and float(off) > 0)

    # 5. Invest rail drag
    pg.click('.seg[data-seg="wealth"] .seg__item[data-sub="invest"]')
    pg.wait_for_timeout(900)
    rail = pg.query_selector("[data-rail]")
    box = rail.bounding_box()
    pg.mouse.move(box["x"] + box["width"] * 0.62, box["y"] + box["height"] / 2)
    pg.mouse.down()
    pg.mouse.move(box["x"] + box["width"] * 0.30, box["y"] + box["height"] / 2, steps=8)
    pg.mouse.up()
    pg.wait_for_timeout(400)
    lbl = pg.inner_text("#allocLabel")
    check("rail drag updates label", "30%" in lbl or "28%" in lbl or "32%" in lbl, lbl)

    # 6. Notes: task toggle + score
    pg.click('.dock__item[data-goto="notes"]')
    pg.wait_for_timeout(800)
    pg.click('.seg[data-seg="notes"] .seg__item[data-sub="tasks"]')
    pg.wait_for_timeout(700)
    before = pg.inner_text("#taskScore")
    pg.click('[data-task]:not(.is-done)')
    pg.wait_for_timeout(400)
    after = pg.inner_text("#taskScore")
    check("task toggle updates score", before != after, before + " -> " + after)

    # 7. Sheet open / close
    pg.click('.dock__home')
    pg.wait_for_timeout(500)
    pg.click('.dock__item[data-goto="notes"]')
    pg.wait_for_timeout(700)
    pg.click('[data-sheet="sheet-note"]')
    pg.wait_for_timeout(700)
    check("sheet opens", pg.get_attribute("#sheet-note", "class").find("is-open") >= 0)
    pg.click("#scrim")
    pg.wait_for_timeout(700)
    check("sheet closes", pg.get_attribute("#sheet-note", "class").find("is-open") < 0)

    # 8. Toast
    pg.click('.dock__home')
    pg.wait_for_timeout(600)
    pg.click('[data-toast]')
    pg.wait_for_timeout(400)
    check("toast opens", pg.get_attribute("#toast", "class").find("is-open") >= 0)

    # 9. Oracle nav + chat send
    pg.click("#oracle")
    pg.wait_for_timeout(2200)
    check("oracle view active", "is-active" in pg.get_attribute('.view[data-view="oracle"]', "class"))
    check("chat intro answered", pg.is_visible("#aiAnswer"))
    n_before = pg.eval_on_selector_all("#chat .msg", "els => els.length")
    pg.fill("#chatInput", "Test question from the harness")
    pg.click("#chatSend")
    pg.wait_for_timeout(400)
    n_mid = pg.eval_on_selector_all("#chat .msg", "els => els.length")
    pg.wait_for_timeout(1600)
    n_after = pg.eval_on_selector_all("#chat .msg", "els => els.length")
    check("chat send adds user msg", n_mid > n_before)
    last = pg.eval_on_selector_all("#chat .msg", "els => els[els.length-1].className + '|' + (els[els.length-1].querySelector('.typing') ? 'typing' : 'text')")
    check("chat reply arrives", "msg--ai" in last and "typing" not in last, last)

    # 10. Settings toggle
    pg.goto(BASE + "#settings")
    pg.wait_for_timeout(900)
    pg.wait_for_timeout(900)
    t = pg.query_selector_all("[data-toggle]")[1]
    st0 = t.get_attribute("class")
    t.click()
    pg.wait_for_timeout(300)
    st1 = t.get_attribute("class")
    check("toggle flips", ("is-on" in st0) != ("is-on" in st1))

    # 11. Onboarding status bar is light
    pg.goto(BASE + "#onboarding")
    pg.wait_for_timeout(900)
    col = pg.evaluate('getComputedStyle(document.querySelector(".statusbar")).color')
    check("status bar light on ink", col.replace(" ", "") in ("rgb(255,255,255)",), col)

    # 12. Mobile: full bleed, no horizontal overflow
    m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    m.goto(BASE + "#home")
    m.wait_for_timeout(1800)
    ovf = m.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check("no horizontal overflow (mobile)", ovf <= 0, ovf)

    # 13. Desktop: no horizontal overflow
    ovf2 = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check("no horizontal overflow (desktop)", ovf2 <= 0, ovf2)

    print("\nconsole errors:", errs if errs else "none")
    print("\nFAILURES:", fails if fails else "none")
    b.close()
