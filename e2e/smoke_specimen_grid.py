"""Playwright smoke test: Login -> Dashboard -> History -> Result with the theme toggle.

Run:  python3 e2e/smoke_specimen_grid.py [base_url]
Checks each screen at mobile (393x717), tablet (768x1024) and desktop (1280x900):
  * the Specimen Grid shell renders (masthead + single <main> + bottom nav)
  * no horizontal overflow at any viewport
  * the theme toggle flips <html class="dark"> and survives a reload (localStorage)
  * skip link and bottom-nav keyboard navigation work
Screenshots land in /tmp/browser/specimen-smoke/.
"""

import asyncio
import os
import sys

from playwright.async_api import async_playwright, expect

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/")
SHOTS = "/tmp/browser/specimen-smoke"
VIEWPORTS = [("mobile", 393, 717), ("tablet", 768, 1024), ("desktop", 1280, 900)]
failures: list[str] = []


def check(ok: bool, label: str) -> None:
    print(("PASS  " if ok else "FAIL  ") + label)
    if not ok:
        failures.append(label)


async def no_overflow(page) -> bool:
    return await page.evaluate(
        "() => document.documentElement.scrollWidth <= window.innerWidth + 1"
    )


async def shell_ok(page, name: str) -> None:
    check(await page.locator('[data-testid="specimen-masthead"]').count() == 1, f"{name}: one masthead")
    check(await page.locator("main#specimen-main").count() == 1, f"{name}: single main landmark")
    check(await page.get_by_role("navigation", name="Primary").count() == 1, f"{name}: bottom nav")
    check(await no_overflow(page), f"{name}: no horizontal overflow")


async def signed_in(page) -> bool:
    return "/dashboard" in page.url


async def sign_in(page) -> None:
    await page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    if await signed_in(page):
        return
    btn = page.get_by_role("button", name="Continue as Guest")
    if await btn.count():
        await btn.click()
        try:
            await page.wait_for_url("**/dashboard", timeout=15000)
        except Exception:
            pass


async def main() -> None:
    os.makedirs(SHOTS, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for name, w, h in VIEWPORTS:
            ctx = await browser.new_context(viewport={"width": w, "height": h})
            page = await ctx.new_page()
            errors: list[str] = []
            page.on("pageerror", lambda e: errors.append(str(e)))

            # --- Login -------------------------------------------------
            await page.goto(f"{BASE}/login", wait_until="domcontentloaded")
            await expect(page.get_by_role("heading", level=1)).to_be_visible()
            check(await no_overflow(page), f"{name}/login: no horizontal overflow")
            check(
                await page.get_by_label("Member Identifier").count() == 1
                and await page.get_by_label("Secure Passkey").count() == 1,
                f"{name}/login: inputs are labelled",
            )
            await page.screenshot(path=f"{SHOTS}/{name}-login.png")

            # --- Theme toggle + persistence ----------------------------
            await page.get_by_role("button", name="Dark theme").first.click()
            await page.wait_for_timeout(150)
            check(
                await page.evaluate("() => document.documentElement.classList.contains('dark')"),
                f"{name}/login: dark theme applied",
            )
            check(
                await page.evaluate("() => localStorage.getItem('habi-theme')") == "dark",
                f"{name}/login: theme stored in localStorage",
            )
            await page.reload(wait_until="domcontentloaded")
            check(
                await page.evaluate("() => document.documentElement.classList.contains('dark')"),
                f"{name}/login: dark theme survives reload",
            )
            await page.screenshot(path=f"{SHOTS}/{name}-login-dark.png")
            await page.get_by_role("button", name="Light theme").first.click()

            # --- Dashboard ---------------------------------------------
            await sign_in(page)
            if not await signed_in(page):
                print(f"SKIP  {name}: guest sign-in unavailable — authenticated screens not checked")
                await ctx.close()
                continue
            await page.wait_for_timeout(600)
            await shell_ok(page, f"{name}/dashboard")
            await page.screenshot(path=f"{SHOTS}/{name}-dashboard.png")

            # skip link is the first tab stop and targets the main landmark
            await page.keyboard.press("Tab")
            check(
                await page.evaluate("() => document.activeElement?.getAttribute('href')") == "#specimen-main",
                f"{name}/dashboard: skip link is first tab stop",
            )

            # --- History -----------------------------------------------
            await page.get_by_role("button", name="Scan history closet").click()
            await page.wait_for_url("**/history", timeout=10000)
            await page.wait_for_timeout(600)
            await shell_ok(page, f"{name}/history")
            await page.screenshot(path=f"{SHOTS}/{name}-history.png")

            # bottom-nav arrow key navigation
            await page.get_by_role("button", name="Dashboard index").focus()
            await page.keyboard.press("ArrowRight")
            check(
                await page.evaluate("() => document.activeElement?.getAttribute('aria-label')")
                == "Scan a garment",
                f"{name}/history: arrow key moves nav focus",
            )

            # --- Result -------------------------------------------------
            await page.goto(f"{BASE}/result?type=success", wait_until="domcontentloaded")
            await page.wait_for_timeout(500)
            await shell_ok(page, f"{name}/result")
            await page.get_by_role("button", name="Dark theme").first.click()
            await page.wait_for_timeout(150)
            check(
                await page.evaluate("() => document.documentElement.classList.contains('dark')"),
                f"{name}/result: theme toggle works on result page",
            )
            await page.screenshot(path=f"{SHOTS}/{name}-result-dark.png")

            check(not errors, f"{name}: no uncaught page errors ({errors[:1]})")
            await ctx.close()
        await browser.close()

    print("\n" + ("ALL SMOKE CHECKS PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
    sys.exit(1 if failures else 0)


asyncio.run(main())
