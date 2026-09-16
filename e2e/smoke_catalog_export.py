"""Playwright smoke test for the Catalog export flows.

Run:  python3 e2e/smoke_catalog_export.py [base_url]

Covers end to end:
  * seeds a specimen with a photo so exports have real content
  * Export CSV downloads a file whose row carries grade, metrics and a photo
  * Export PDF downloads a real PDF whose text carries name, grade and metrics
  * both buttons disable while an export runs (no duplicate exports)
  * the aria-live status region announces progress and clears afterwards
Downloads land in /tmp/browser/catalog-export/.
"""

import asyncio
import os
import struct
import subprocess
import sys
import zlib

from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/")
OUT = "/tmp/browser/catalog-export"
NAME = "Export Probe Linen"
GRADE = "A+"
FIBER = "100% Probe Linen"
failures: list[str] = []


def check(ok: bool, label: str) -> None:
    print(("PASS  " if ok else "FAIL  ") + label)
    if not ok:
        failures.append(label)


def png(path: str, w: int, h: int) -> str:
    raw = b"".join(b"\x00" + b"\x3d\x5a\x3d" * w for _ in range(h))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    with open(path, "wb") as fh:
        fh.write(
            b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 6))
            + chunk(b"IEND", b"")
        )
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
        except Exception:  # noqa: BLE001
            pass
    return "/dashboard" in page.url


def pdf_text(path: str) -> str:
    try:
        return subprocess.run(
            ["pdftotext", "-layout", path, "-"], capture_output=True, text=True, timeout=60
        ).stdout
    except Exception:  # noqa: BLE001
        return ""


async def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    photo = png(f"{OUT}/probe.png", 400, 400)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(
            viewport={"width": 1280, "height": 1800}, accept_downloads=True
        )
        page = await ctx.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        if not await sign_in(page):
            print("SKIP  guest sign-in unavailable — export flows not checked")
            await browser.close()
            return

        await page.goto(f"{BASE}/catalog", wait_until="domcontentloaded")
        await page.get_by_test_id("catalog-form").wait_for(timeout=15000)

        # --- seed one specimen with a photo -------------------------------
        await page.fill("#cat-name", NAME)
        await page.fill("#cat-grade", GRADE)
        await page.fill("#cat-fiber", FIBER)
        await page.set_input_files("#cat-photo", photo)
        await page.get_by_test_id("catalog-submit").click()
        row = page.get_by_test_id("catalog-row").filter(has_text=NAME)
        await row.first.wait_for(timeout=20000)
        # let the photo URL resolve so the export carries it
        await page.wait_for_timeout(2500)

        # metrics as rendered on the row, so the export must match them
        row_text = await row.first.inner_text()
        csv_btn = page.get_by_test_id("catalog-export-csv")
        pdf_btn = page.get_by_test_id("catalog-export-pdf")
        status = page.get_by_test_id("catalog-export-status")

        # --- CSV ------------------------------------------------------------
        async with page.expect_download(timeout=30000) as dl:
            await csv_btn.click()
        csv_path = await (await dl.value).path()
        csv_body = open(csv_path, encoding="utf-8", errors="ignore").read() if csv_path else ""
        header = csv_body.splitlines()[0] if csv_body else ""
        line = next((l for l in csv_body.splitlines() if NAME in l), "")
        check(bool(line), "csv: the seeded specimen has its own row")
        check(
            all(c in header for c in ("grade", "breathability", "sustainability", "photo")),
            f"csv: header carries grade, metrics and photo columns ({header})",
        )
        cells = line.split(",")
        check(GRADE in line and FIBER.split()[-1] in line, "csv: row carries grade and fiber")
        nums = [c for c in cells if c.isdigit()]
        check(len(nums) >= 2, f"csv: row carries breathability and sustainability values ({nums})")
        check(
            any(c.strip() and ("http" in c or c.strip() == "embedded") for c in cells),
            "csv: row carries a photo reference",
        )
        for n in nums[:2]:
            check(f"{n}%" in row_text, f"csv: metric {n}% matches the on-screen row")

        # --- PDF ---------------------------------------------------------------
        async with page.expect_download(timeout=45000) as dl2:
            await pdf_btn.click()
        pdf_dl = await dl2.value
        pdf_path = f"{OUT}/{pdf_dl.suggested_filename}"
        await pdf_dl.save_as(pdf_path)
        head = open(pdf_path, "rb").read(5)
        check(head == b"%PDF-", f"pdf: download is a real PDF file ({head!r})")
        text = pdf_text(pdf_path)
        if text:
            check(NAME in text, "pdf: specimen name present in the document text")
            check(GRADE in text, "pdf: grade present in the document text")
            check(
                all(f"{n}%" in text for n in nums[:2]),
                f"pdf: breathability and sustainability present ({nums[:2]})",
            )
            check("Photo" in text, "pdf: table has a photo column")
        else:
            print("SKIP  pdf text extraction unavailable (pdftotext missing)")
        check(os.path.getsize(pdf_path) > 5000, "pdf: file size suggests embedded photo data")

        # --- loading / no duplicate exports -------------------------------------
        await page.evaluate(
            """() => {
                const b = document.querySelector('[data-testid=catalog-export-pdf]');
                window.__clicks = 0;
                b.addEventListener('click', () => { window.__clicks++; });
            }"""
        )
        # observe the in-flight state via a MutationObserver — a one-row export
        # finishes faster than a Playwright round trip.
        await page.evaluate(
            """() => {
                const csv = document.querySelector('[data-testid=catalog-export-csv]');
                const pdf = document.querySelector('[data-testid=catalog-export-pdf]');
                const st = document.querySelector('[data-testid=catalog-export-status]');
                window.__seen = { csvDisabled: false, pdfDisabled: false, busy: false, note: '' };
                const snap = () => {
                    if (csv.disabled) window.__seen.csvDisabled = true;
                    if (pdf.disabled) window.__seen.pdfDisabled = true;
                    if (pdf.getAttribute('aria-busy') === 'true') window.__seen.busy = true;
                    const t = (st.textContent || '').trim();
                    if (t) window.__seen.note = t;
                };
                const obs = new MutationObserver(snap);
                obs.observe(document.body, {
                    subtree: true, childList: true, characterData: true, attributes: true,
                });
                window.__stop = () => obs.disconnect();
                pdf.click();
                snap();
            }"""
        )
        await page.wait_for_timeout(4000)
        seen = await page.evaluate("() => { window.__stop(); return window.__seen; }")
        check(seen["busy"], f"export: PDF button reports aria-busy while running ({seen})")
        check(seen["csvDisabled"], "export: the other export button is disabled during an export")
        check(seen["pdfDisabled"], "export: the running button is disabled (no duplicates)")
        check(
            "Preparing" in seen["note"],
            f"export: status region announces progress ({seen['note']})",
        )

        await page.wait_for_timeout(6000)
        check(
            (await status.inner_text()).strip() == "",
            "export: status clears after a successful export",
        )
        check(not await pdf_btn.is_disabled(), "export: buttons re-enable when the export finishes")

        # --- error state ---------------------------------------------------------
        await page.evaluate(
            "() => { URL.createObjectURL = () => { throw new Error('Blob boom'); }; }"
        )
        await csv_btn.click()
        await page.wait_for_timeout(1500)
        err = (await status.inner_text()).strip()
        check("failed" in err.lower(), f"export: failures show a clear message ({err})")
        check(not await csv_btn.is_disabled(), "export: buttons re-enable after a failure")
        await page.screenshot(path=f"{OUT}/export-error.png")

        # --- cleanup --------------------------------------------------------------
        await page.reload(wait_until="domcontentloaded")
        await row.first.wait_for(timeout=20000)
        await page.get_by_role("button", name=f"Delete {NAME}").click()
        await page.get_by_role("button", name="Delete", exact=True).click()
        await page.wait_for_timeout(2500)

        check(not errors, f"no uncaught page errors ({errors[:1]})")
        await browser.close()

    print(
        "\n" + ("ALL EXPORT CHECKS PASSED" if not failures else f"{len(failures)} FAILED: {failures}")
    )
    sys.exit(1 if failures else 0)


asyncio.run(main())
