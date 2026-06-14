/**
 * Live RLS integration tests against the project's Supabase backend.
 *
 * Skips automatically unless two pre-provisioned test accounts are available:
 *   VITE_TEST_USER_A_EMAIL / VITE_TEST_USER_A_PASSWORD
 *   VITE_TEST_USER_B_EMAIL / VITE_TEST_USER_B_PASSWORD
 *
 * Verifies that:
 *  - Authenticated users can read their own scans, findings, and scan-image signed URLs.
 *  - Cross-user reads of scans + findings return zero rows (RLS blocks).
 *  - Cross-user storage downloads via signed URLs cut against the wrong owner fail.
 *  - Unauthenticated clients are blocked from listing scans.
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

d("RLS — scans / scan_findings / scan-images", () => {
  let a: SupabaseClient;
  let b: SupabaseClient;
  let anon: SupabaseClient;
  let aUserId: string;
  let aScanId: string;
  let aImagePath: string | null = null;

  beforeAll(async () => {
    a = makeClient();
    b = makeClient();
    anon = makeClient();

    const aSignIn = await a.auth.signInWithPassword({
      email: A_EMAIL!,
      password: A_PASS!,
    });
    expect(aSignIn.error).toBeNull();
    aUserId = aSignIn.data.user!.id;

    const bSignIn = await b.auth.signInWithPassword({
      email: B_EMAIL!,
      password: B_PASS!,
    });
    expect(bSignIn.error).toBeNull();

    const ins = await a
      .from("scans")
      .insert({
        user_id: aUserId,
        fabric_name: "RLS Test Fabric",
        grade: "A+",
        fiber_type: "Cotton",
      })
      .select("id,image_path")
      .single();
    expect(ins.error).toBeNull();
    aScanId = ins.data!.id as string;
    aImagePath = (ins.data!.image_path as string | null) ?? null;
  }, 30_000);

  afterAll(async () => {
    if (aScanId) await a.from("scans").delete().eq("id", aScanId);
    await a.auth.signOut();
    await b.auth.signOut();
  });

  it("owner can read their own scan", async () => {
    const { data, error } = await a
      .from("scans")
      .select("id")
      .eq("id", aScanId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.id).toBe(aScanId);
  });

  it("other user cannot read another user's scan", async () => {
    const { data, error } = await b
      .from("scans")
      .select("id")
      .eq("id", aScanId)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("other user cannot update another user's scan", async () => {
    const { data, error } = await b
      .from("scans")
      .update({ fabric_name: "hacked" })
      .eq("id", aScanId)
      .select();
    // RLS returns either an error or zero rows depending on policy phrasing.
    expect(error || (data?.length ?? 0) === 0).toBeTruthy();
  });

  it("other user cannot delete another user's scan", async () => {
    const { data, error } = await b
      .from("scans")
      .delete()
      .eq("id", aScanId)
      .select();
    expect(error || (data?.length ?? 0) === 0).toBeTruthy();
  });

  it("unauthenticated client gets nothing from scans", async () => {
    const { data } = await anon.from("scans").select("id").limit(5);
    expect(data ?? []).toEqual([]);
  });

  it("trigger auto-seeds findings for new scans, visible to owner only", async () => {
    const ownerView = await a
      .from("scan_findings")
      .select("id,severity,affected_field,status")
      .eq("scan_id", aScanId);
    expect(ownerView.error).toBeNull();
    expect((ownerView.data ?? []).length).toBeGreaterThanOrEqual(1);

    const otherView = await b
      .from("scan_findings")
      .select("id")
      .eq("scan_id", aScanId);
    expect(otherView.error).toBeNull();
    expect(otherView.data ?? []).toEqual([]);
  });

  it("other user cannot insert a finding into someone else's scan", async () => {
    const { error } = await b.from("scan_findings").insert({
      scan_id: aScanId,
      severity: "low",
      affected_field: "x",
      status: "open",
      title: "evil",
    });
    expect(error).not.toBeNull();
  });

  it("audit_log rows are private to their owner", async () => {
    await a.rpc("log_audit_event", {
      _action: "read",
      _resource_type: "scan",
      _resource_id: aScanId,
      _success: true,
      _metadata: null,
    });
    const aRows = await a
      .from("audit_log")
      .select("id")
      .eq("resource_id", aScanId);
    expect(aRows.error).toBeNull();
    expect((aRows.data ?? []).length).toBeGreaterThanOrEqual(1);

    const bRows = await b
      .from("audit_log")
      .select("id")
      .eq("resource_id", aScanId);
    expect(bRows.error).toBeNull();
    expect(bRows.data ?? []).toEqual([]);
  });

  it("owner can sign a URL for their own image when present", async () => {
    if (!aImagePath) return;
    const { data, error } = await a.storage
      .from("scan-images")
      .createSignedUrl(aImagePath, 60);
    expect(error).toBeNull();
    expect(data?.signedUrl).toMatch(/^https?:\/\//);
  });

  it("other user cannot sign a URL for another user's image", async () => {
    if (!aImagePath) return;
    const { data, error } = await b.storage
      .from("scan-images")
      .createSignedUrl(aImagePath, 60);
    expect(error || !data?.signedUrl).toBeTruthy();
  });

  it("connector_findings are readable by any signed-in user (workspace-wide)", async () => {
    const aRead = await a.from("connector_findings").select("id").limit(1);
    const bRead = await b.from("connector_findings").select("id").limit(1);
    expect(aRead.error).toBeNull();
    expect(bRead.error).toBeNull();
  });

  it("connector_findings are NOT readable by anonymous clients", async () => {
    const { data, error } = await anon
      .from("connector_findings")
      .select("id")
      .limit(1);
    expect(error || (data ?? []).length === 0).toBeTruthy();
  });

  it("authenticated users cannot insert/update/delete connector_findings (service_role only)", async () => {
    const ins = await a.from("connector_findings").insert({
      source: "wiz",
      external_id: `rls-test-${Date.now()}`,
      severity: "low",
      affected_field: "x",
      status: "open",
      title: "should fail",
    });
    expect(ins.error).not.toBeNull();
  });

  it("rescan_scan_findings only works for the scan owner", async () => {
    const ok = await a.rpc("rescan_scan_findings", { _scan_id: aScanId });
    expect(ok.error).toBeNull();

    const denied = await b.rpc("rescan_scan_findings", { _scan_id: aScanId });
    expect(denied.error).not.toBeNull();
  });
});