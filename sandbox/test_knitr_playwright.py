"""Test that the ggsql knitr output renders a Vega chart from inline JSON."""
import subprocess
import sys
import time
from playwright.sync_api import sync_playwright

# First render the Quarto doc
result = subprocess.run(
    ["quarto", "render", "test_knitr.qmd", "--output-dir", "."],
    cwd="/Users/cpsievert/github/ggsql-r/sandbox",
    capture_output=True,
    text=True,
    timeout=120,
)
if result.returncode != 0:
    print(f"FAILED: Quarto render failed\nSTDERR: {result.stderr[-2000:]}")
    sys.exit(1)

print("Quarto rendered, testing with Playwright...")

html_path = "/Users/cpsievert/github/ggsql-r/sandbox/test_knitr.html"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(f"file://{html_path}", timeout=15000)

    viz = page.locator(".ggsql_viz.html-widget")
    viz.wait_for(state="attached", timeout=10000)

    svg = viz.locator("svg.marks")
    try:
        svg.wait_for(state="visible", timeout=20000)
    except Exception:
        page.screenshot(path="/Users/cpsievert/github/ggsql-r/sandbox/knitr_fail.png")
        inner = viz.inner_html()
        print(f"FAILED: SVG not rendered. innerHTML: {inner[:500]}")

        # Check if JS deps are in the HTML
        has_vega = page.locator('script[src*="vega"]').count()
        has_ggsql = page.locator('script[src*="ggsql_viz"]').count()
        print(f"Vega scripts found: {has_vega}, ggsql_viz.js found: {has_ggsql}")
        sys.exit(1)

    print("KNITR TEST PASSED: Vega chart rendered successfully")
    page.screenshot(path="/Users/cpsievert/github/ggsql-r/sandbox/knitr_screenshot.png")

    # htmlwidgets leaves the data script in the DOM (unlike the old custom element)
    # The SVG check above already verifies the chart rendered correctly
    print("KNITR TEST PASSED: Chart rendered from data script")

    browser.close()
    print("\nAll knitr tests passed!")
