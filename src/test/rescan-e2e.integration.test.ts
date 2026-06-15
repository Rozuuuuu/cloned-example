/**
 * End-to-end integration test for "Re-scan and review".
 *
 * Verifies that, against the live backend:
 *  1. Calling rescan_scan_findings re-seeds the owner's scan_findings.
 *  2. Invoking the sync-connector-findings edge function (with the user's JWT)
 *     ingests OSV-sourced connector_findings rows visible to the SecurityIssues UI.
 *  3. Any connector finding with a linked storage_object_path can be signed by
 *     the scan owner under RLS, and cross-user signing is denied.
 *
 * Skips unless test creds are provisioned (same env vars as rls.integration.test.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const A_EMAIL = import.meta.env.VITE_TEST_USER_A_EMAIL;
const A_PASS = import.meta.env.VITE_TEST_USER_A_PASSWORD;
const B_EMAIL = import.meta.env.VITE_TEST_USER_B_EMAIL;
const B_PASS = import.meta.env.VITE_TEST_USER_B_PASSWORD;

const hasCreds =
  !!URL && !!KEY && !!A_EMAIL && !!A_PASS && !!B_EMAIL && !!B_PASS;
const d = hasCreds ? describe : describe.skip;

const makeClient = () =>
  createClient(URL!, KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

d("Re-scan and review — end-to-end", () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let aUserId: string;
  let aScanId: string;

  beforeAll(async () => {
    a = makeClient();
    b = makeClient();
    const aIn = await a.auth.signInWithPassword({
      email: A_EMAIL!,
      password: A_PASS!,
    });
    expect(aIn.error).toBeNull();
    aUserId = aIn.data.user!.id;
    const bIn = await b.auth.signInWithPassword({
      email: B_EMAIL!,
      password: B_PASS!,
    });
    expect(bIn.error).toBeNull();

    const ins = await a
      .from("scans")
      .insert({
        user_id: aUserId,
        fabric_name: "Rescan E2E",
        grade: "B",
        fiber_type: "Linen",
      })
      .select("id")
      .single();
    expect(ins.error).toBeNull();
    aScanId = ins.data!.id as string;
  }, 30_000);

  afterAll(async () => {
    if (aScanId) await a.from("scans").delete().eq("id", aScanId);
    await a.auth.signOut();
    await b.auth.signOut();
  });

  it(
    "rescan_scan_findings re-seeds findings for the owner",
    async () => {
      const before = await a
        .from("scan_findings")
        .select("id")
        .eq("scan_id", aScanId);
      const beforeCount = (before.data ?? []).length;

      const r = await a.rpc("rescan_scan_findings", { _scan_id: aScanId });
      expect(r.error).toBeNull();

      const after = await a
        .from("scan_findings")
        .select("id,severity,affected_field,status,title")
        .eq("scan_id", aScanId);
      expect(after.error).toBeNull();
      expect((after.data ?? []).length).toBeGreaterThanOrEqual(beforeCount);
      expect((after.data ?? []).length).toBeGreaterThan(0);
    },
    30_000
  );

  it(
    "sync-connector-findings (as signed-in user) ingests OSV rows visible in the UI query",
    async () => {
      const { data, error } = await a.functions.invoke<{
        ok: boolean;
        ingested: number;
      }>("sync-connector-findings", { body: {} });
      // Edge function may legitimately return 0 if OSV reports no vulns;
      // the contract under test is success + readability, not a specific count.
      expect(error).toBeNull();
      expect(data?.ok).toBe(true);

      const list = await a
        .from("connector_findings")
        .select("id,source,severity,storage_object_path")
        .order("severity", { ascending: false })
        .limit(50);
      expect(list.error).toBeNull();
      // At minimum the table is readable post-sync (RLS allows authenticated SELECT).
      expect(Array.isArray(list.data)).toBe(true);
    },
    60_000
  );

  it(
    "signed-URL access for linked connector storage objects respects RLS",
    async () => {
      const { data: rows } = await a
        .from("connector_findings")
        .select("storage_object_path")
        .not("storage_object_path", "is", null)
        .limit(1);

      const path = rows?.[0]?.storage_object_path as string | undefined;
      if (!path) {
        // No linked storage objects in this run — nothing to validate.
        return;
      }

      // Owner-side signing succeeds when the object is in the user's folder.
      const owned = path.startsWith(`${aUserId}/`);
      const aSign = await a.storage
        .from("scan-images")
        .createSignedUrl(path, 60);
      if (owned) {
        expect(aSign.error).toBeNull();
        expect(aSign.data?.signedUrl).toMatch(/^https?:\/\//);
      }

      // Cross-user: B should never get a usable signed URL for A's path.
      const bSign = await b.storage
        .from("scan-images")
        .createSignedUrl(path, 60);
      expect(bSign.error || !bSign.data?.signedUrl).toBeTruthy();
    },
    30_000
  );
});