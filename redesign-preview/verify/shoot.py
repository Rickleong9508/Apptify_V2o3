import os
import sys, time
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:4177/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "screens")

os.makedirs(OUT, exist_ok=True)

VIEWS = ["home", "wealth", "notes", "news", "settings", "oracle", "onboarding"]

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={"width": 900, "height": 1000}, device_scale_factor=2)
    errors = []
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append("PAGEERROR: " + str(e)))

    for v in VIEWS:
        pg.goto(BASE + "#" + v)
        pg.wait_for_timeout(2600)
        el = pg.query_selector(".device")
        el.screenshot(path=f"{OUT}/{v}.png")
        print("shot", v)

    # sub-tabs inside wealth
    pg.goto(BASE + "#wealth")
    pg.wait_for_timeout(1800)
    for sub in ["accounts", "budget", "invest", "loans"]:
        pg.click(f'.seg[data-seg="wealth"] .seg__item[data-sub="{sub}"]')
        pg.wait_for_timeout(1500)
        pg.query_selector(".device").screenshot(path=f"{OUT}/wealth-{sub}.png")
        print("shot wealth-" + sub)

    # notes sub-tabs
    pg.goto(BASE + "#notes")
    pg.wait_for_timeout(1500)
    for sub in ["tasks", "focus"]:
        pg.click(f'.seg[data-seg="notes"] .seg__item[data-sub="{sub}"]')
        pg.wait_for_timeout(1500)
        pg.query_selector(".device").screenshot(path=f"{OUT}/notes-{sub}.png")
        print("shot notes-" + sub)

    # mobile viewport check
    m = b.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    m.goto(BASE + "#home")
    m.wait_for_timeout(2200)
    m.screenshot(path=f"{OUT}/mobile-home.png")
    print("shot mobile-home")

    print("\n--- console errors ---")
    for e in errors:
        print(e)
    print("--- end ---")
    b.close()
