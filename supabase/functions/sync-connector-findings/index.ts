import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Pulls connector_security_scan findings (Wiz, etc.) and upserts them into
 * public.connector_findings. Uses a deterministic stub source today; swap
 * fetchWizFindings() with a real API call once a WIZ_API_TOKEN is added.
 */

type Severity = "low" | "medium" | "high" | "critical";
type Status = "open" | "acknowledged" | "resolved";

interface ConnectorFinding {
  source: string;
  external_id: string;
  severity: Severity;
  affected_field: string;
  status: Status;
  title: string;
  description: string | null;
  storage_object_path: string | null;
}

const fetchWizFindings = async (): Promise<ConnectorFinding[]> => [
  {
    source: "wiz",
    external_id: "wiz-storage-public-bucket-check",
    severity: "low",
    affected_field: "storage.scan-images",
    status: "resolved",
    title: "Scan-images bucket private",
    description: "Wiz confirmed scan-images storage bucket is private.",
    storage_object_path: null,
  },
  {
    source: "wiz",
    external_id: "wiz-rls-audit-log",
    severity: "medium",
    affected_field: "public.audit_log",
    status: "open",
    title: "Audit log retention policy missing",
    description:
      "Wiz recommends defining an explicit retention policy for audit_log entries.",
    storage_object_path: null,
  },
  {
    source: "wiz",
    external_id: "wiz-edge-secret-rotation",
    severity: "high",
    affected_field: "edge.secrets",
    status: "acknowledged",
    title: "Edge function secret rotation cadence",
    description: "Rotate LOVABLE_API_KEY at least every 90 days.",
    storage_object_path: null,
  },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Require a signed-in caller.
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const findings = await fetchWizFindings();

    const admin = createClient(url, serviceKey);
    const { error } = await admin
      .from("connector_findings")
      .upsert(findings, { onConflict: "source,external_id" });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, ingested: findings.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});