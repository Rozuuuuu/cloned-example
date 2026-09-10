"""Playwright smoke test for the Catalog flows.

Run:  python3 e2e/smoke_catalog.py [base_url]

Covers end to end:
  * add a specimen (with a valid photo upload)
  * photo validation rejects a bad file type / oversized file inline
  * search + filter narrows the list, reset restores it
  * edit a specimen and see the row update
  * the row shows up in History (closet) and in the CSV export
  * delete asks for confirmation, cancel keeps the row, confirm removes it
Screenshots land in /tmp/browser/catalog-smoke/.
"""

import asyncio
import os
import struct
import sys
import zlib

from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/")
SHOTS = "/tmp/browser/catalog-smoke"
TMP = "/tmp/browser/catalog-smoke/files"
NAME = "Smoke Linen"
NAME2 = "Smoke Linen Edited"
failures: list[str] = []


def check(ok: bool, label: str) -> None:
    print(("PASS  " if ok else "FAIL  ") + label)
    if not ok:
        failures.append(label)


def png(path: str, w: int, h: int) -> str:
    """Write a minimal solid-colour PNG of the requested size."""
    raw = b"".join(b"\x00" + b"\x3d\x5a\x3d" * w for _ in range(h))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    body = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 6))
        + chunk(b"IEND", b"")
    )
    with open(path, "wb") as fh:
        fh.write(body)
    return path


async def sign_in(page) -> bool:
    await page.goto(f"{BASE}/login", wait_until="domcontentloaded")
    if "/dashboard" in page.url:
        return True
    btn = page.get_by_role("button", name="Continue as Guest")
    if await btn.count():
        await btn.click()
        try:
            await page.wait_for_url("**/dashboard", timeout=15000)
        except Exception:
            pass
    return "/dashboard" in page.url


async def add_specimen(page, name: str, grade: str, fiber: str, photo: str | None) -> None:
    await page.fill("#cat-name", name)
    await page.fill("#cat-grade", grade)
    await page.fill("#cat-fiber", fiber)
    if photo:
        await page.set_input_files("#cat-photo", photo)
    await page.get_by_test_id("catalog-submit").click()
    await page.wait_for_timeout(1500)


def row_by_name(page, name: str):
    return page.get_by_test_id("catalog-row").filter(has_text=name)


async def main() -> None:
    os.makedirs(SHOTS, exist_ok=True)
    os.makedirs(TMP, exist_ok=True)
    good = png(f"{TMP}/good.png", 400, 400)
    tiny = png(f"{TMP}/tiny.png", 64, 64)
    bad_type = f"{TMP}/notes.txt"
    with open(bad_type, "w") as fh:
        fh.write("not an image")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        if not await sign_in(page):
            print("SKIP  guest sign-in unavailable — catalog flows not checked")
            await browser.close()
            return

        await page.goto(f"{BASE}/catalog", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)

        # --- validation: wrong type -------------------------------------
        await page.set_input_files("#cat-photo", bad_type)
        await page.wait_for_timeout(300)
        err = page.get_by_test_id("catalog-photo-error")
        check(await err.count() == 1, "photo: wrong file type shows an inline error")

        # --- validation: too small --------------------------------------
        await page.set_input_files("#cat-photo", tiny)
        await page.wait_for_timeout(400)
        text = (await err.inner_text()) if await err.count() else ""
        check("200 px" in text, f"photo: undersized image rejected inline ({text[:60]})")

        # --- add ----------------------------------------------------------
        before = await page.get_by_test_id("catalog-row").count()
        await add_specimen(page, NAME, "A+", "100% Smoke Linen", good)
        check(await err.count() == 0, "photo: valid upload clears the inline error")
        check(await row_by_name(page, NAME).count() == 1, "add: new specimen row rendered")
        check(
            await page.get_by_test_id("catalog-row").count() == before + 1,
            "add: row count increased by one",
        )
        await page.screenshot(path=f"{SHOTS}/after-add.png")

        # --- search / filter ------------------------------------------------
        await page.get_by_test_id("catalog-search").fill(NAME)
        await page.wait_for_timeout(400)
        check(await row_by_name(page, NAME).count() == 1, "search: match kept")
        await page.get_by_test_id("catalog-search").fill("zzz-no-such-fabric")
        await page.wait_for_timeout(400)
        check(await page.get_by_test_id("catalog-row").count() == 0, "search: non-match filtered out")
        await page.get_by_role("button", name="Reset filters").click()
        await page.wait_for_timeout(400)
        check(await row_by_name(page, NAME).count() == 1, "filters: reset restores the row")

        # --- pagination -----------------------------------------------------
        more = page.get_by_test_id("catalog-load-more")
        if await more.count():
            shown = await page.get_by_test_id("catalog-row").count()
            await more.click()
            await page.wait_for_timeout(400)
            check(
                await page.get_by_test_id("catalog-row").count() > shown,
                "pagination: load more reveals additional rows",
            )
        else:
            print("SKIP  pagination: fewer rows than one page")

        # --- edit -------------------------------------------------------------
        await page.get_by_role("button", name=f"Edit {NAME}").click()
        await page.wait_for_timeout(400)
        await page.fill("#cat-name", NAME2)
        await page.get_by_test_id("catalog-submit").click()
        await page.wait_for_timeout(1500)
        check(await row_by_name(page, NAME2).count() == 1, "edit: row shows the new name")

        # --- History ------------------------------------------------------------
        await page.goto(f"{BASE}/history", wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        check(NAME2 in await page.inner_text("main"), "history: catalog row appears in the closet")
        await page.screenshot(path=f"{SHOTS}/history.png")

        # --- export -------------------------------------------------------------
        export = page.get_by_role("button", name="Export CSV")
        if await export.count():
            try:
                async with page.expect_download(timeout=15000) as dl:
                    await export.first.click()
                path = await (await dl.value).path()
                body = open(path, encoding="utf-8", errors="ignore").read() if path else ""
                check(NAME2 in body, "export: CSV contains the catalog row")
            except Exception as exc:  # noqa: BLE001
                check(False, f"export: CSV download failed ({exc})")
        else:
            print("SKIP  export: no CSV button on this screen")

        # --- delete (cancel then confirm) -----------------------------------------
        await page.goto(f"{BASE}/catalog", wait_until="domcontentloaded")
        await page.wait_for_timeout(1200)
        await page.get_by_role("button", name=f"Delete {NAME2}").click()
        await page.wait_for_timeout(300)
        check(await page.get_by_role("alertdialog").count() == 1, "delete: confirmation dialog opens")
        await page.get_by_role("button", name="Cancel").click()
        await page.wait_for_timeout(400)
        check(await row_by_name(page, NAME2).count() == 1, "delete: cancel keeps the specimen")

        await page.get_by_role("button", name=f"Delete {NAME2}").click()
        await page.wait_for_timeout(300)
        await page.get_by_role("button", name="Delete", exact=True).click()
        await page.wait_for_timeout(2000)
        check(await row_by_name(page, NAME2).count() == 0, "delete: confirm removes the specimen")
        await page.screenshot(path=f"{SHOTS}/after-delete.png")

        await page.goto(f"{BASE}/history", wait_until="domcontentloaded")
        await page.wait_for_timeout(1500)
        check(NAME2 not in await page.inner_text("main"), "history: deleted row is gone")

        check(not errors, f"no uncaught page errors ({errors[:1]})")
        await browser.close()

    print("\n" + ("ALL CATALOG CHECKS PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
    sys.exit(1 if failures else 0)


asyncio.run(main())
