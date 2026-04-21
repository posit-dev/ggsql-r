"""Test that the ggsql Shiny app renders a Vega chart."""
import subprocess
import time
import sys
import os
import urllib.request
import urllib.error
from playwright.sync_api import sync_playwright

PORT = 7670
env = {k: v for k, v in os.environ.items() if k != "SHINY_PORT"}

app_proc = subprocess.Popen(
    ["Rscript", "/Users/cpsievert/github/ggsql-r/sandbox/test_shiny_app.R"],
    cwd="/Users/cpsievert/github/ggsql-r",
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    env=env,
)

for i in range(60):
    time.sleep(2)
    try:
        urllib.request.urlopen(f"http://127.0.0.1:{PORT}", timeout=2)
        break
    except (urllib.error.URLError, ConnectionRefusedError, OSError):
        continue
else:
    print("FAILED: Shiny app did not start within 120s")
    app_proc.terminate()
    stderr = app_proc.stderr.read().decode() if app_proc.stderr else ""
    print("STDERR:", stderr[-3000:])
    sys.exit(1)

print("Shiny app is running, starting Playwright tests...")

try:
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(f"http://127.0.0.1:{PORT}", timeout=15000)

        viz = page.locator(".ggsql_viz.html-widget-output")
        viz.wait_for(state="attached", timeout=10000)

        svg = viz.locator("svg.marks")
        try:
            svg.wait_for(state="visible", timeout=20000)
        except Exception:
            page.screenshot(path="/Users/cpsievert/github/ggsql-r/sandbox/shiny_fail.png")
            inner = viz.inner_html()
            print(f"FAILED: SVG not rendered. innerHTML: {inner[:500]}")
            # Also check R stderr
            app_proc.terminate()
            app_proc.wait(timeout=5)
            stderr = app_proc.stderr.read().decode() if app_proc.stderr else ""
            print(f"R STDERR: {stderr[-2000:]}")
            sys.exit(1)

        print("SHINY TEST PASSED: Vega chart rendered successfully")
        page.screenshot(path="/Users/cpsievert/github/ggsql-r/sandbox/shiny_screenshot.png")

        inline_script = page.locator('script[data-for="chart"]').count()
        if inline_script == 0:
            print("SHINY TEST PASSED: No inline JSON script (data came via WebSocket)")
        else:
            print("SHINY TEST FAILED: Found inline JSON script in Shiny mode")
            sys.exit(1)

        browser.close()
        print("\nAll Shiny tests passed!")
finally:
    app_proc.terminate()
    app_proc.wait()
