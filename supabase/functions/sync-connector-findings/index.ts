import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Pulls connector_security_scan findings from the OSV.dev public vulnerability
 * API and upserts them into public.connector_findings (source = "osv").
 *
 * No external secret required — OSV.dev is a free public service maintained
 * by Google/OpenSSF. We query a curated list of runtime npm packages that
 * power this project; each returned vulnerability becomes one finding row.
 *
 * Audit events are written for the sync run (success/failure, ingested count,
 * and any policy denial from the upsert).
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

/** Curated set of tracked runtime npm packages to query OSV for. */
const TRACKED_PACKAGES: Array<{ name: string; version: string }> = [
  { name: "react", version: "18.3.1" },
  { name: "react-dom", version: "18.3.1" },
  { name: "react-router-dom", version: "6.30.1" },
  { name: "@supabase/supabase-js", version: "2.105.1" },
  { name: "@tanstack/react-query", version: "5.83.0" },
  { name: "zod", version: "3.25.76" },
  { name: "vite", version: "5.4.19" },
];

interface OsvVuln {
  id: string;
  summary?: string;
  details?: string;
  severity?: Array<{ type: string; score: string }>;
  database_specific?: { severity?: string };
}

const bucketSeverity = (v: OsvVuln): Severity => {
  const tag = v.database_specific?.severity?.toUpperCase();
  if (tag === "CRITICAL") return "critical";
  if (tag === "HIGH") return "high";
  if (tag === "MODERATE" || tag === "MEDIUM") return "medium";
  if (tag === "LOW") return "low";
  // Try CVSS score (e.g. "CVSS:3.1/AV:N/...").
  const score = v.severity?.[0]?.score ?? "";
  const m = score.match(/(\d+(\.\d+)?)/);
  const n = m ? parseFloat(m[1]) : NaN;
  if (!isNaN(n)) {
    if (n >= 9) return "critical";
    if (n >= 7) return "high";
    if (n >= 4) return "medium";
    return "low";
  }
  return "medium";
};

const fetchOsvFindings = async (): Promise<ConnectorFinding[]> => {
  const body = {
    queries: TRACKED_PACKAGES.map((p) => ({
      package: { name: p.name, ecosystem: "npm" },
      version: p.version,
    })),
  };
  const res = await fetch("https://api.osv.dev/v1/querybatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`OSV querybatch failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    results: Array<{ vulns?: Array<{ id: string }> }>;
  };

  // querybatch returns IDs only; hydrate each unique vuln with a GET /v1/vulns/{id}.
  const findings: ConnectorFinding[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < json.results.length; i++) {
    const pkg = TRACKED_PACKAGES[i];
    const vulns = json.results[i]?.vulns ?? [];
    for (const { id } of vulns) {
      const key = `${pkg.name}@${id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const vRes = await fetch(`https://api.osv.dev/v1/vulns/${id}`);
        if (!vRes.ok) continue;
        const v = (await vRes.json()) as OsvVuln;
        findings.push({
          source: "osv",
          external_id: `osv:${pkg.name}:${id}`,
          severity: bucketSeverity(v),
          affected_field: `npm:${pkg.name}@${pkg.version}`,
          status: "open",
          title: v.summary ?? id,
          description: v.details?.slice(0, 1000) ?? null,
          storage_object_path: null,
        });
      } catch {
        /* skip individual lookup failures */
      }
    }
  }
  return findings;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Audit helper — best-effort, never throws.
  const audit = async (
    userId: string | null,
    success: boolean,
    metadata: Record<string, unknown>
  ) => {
    try {
      const admin = createClient(url, serviceKey);
      await admin.from("audit_log").insert({
        user_id: userId,
        action: "connector_sync",
        resource_type: "connector_findings",
        resource_id: "osv",
        success,
        metadata,
      });
    } catch {
      /* best-effort */
    }
  };

  try {
    const authHeader = req.headers.get("Authorization") ?? "";

    // Require a signed-in caller.
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      await audit(null, false, { reason: "unauthorized" });
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const findings = await fetchOsvFindings();

    const admin = createClient(url, serviceKey);
    if (findings.length > 0) {
      const { error } = await admin
        .from("connector_findings")
        .upsert(findings, { onConflict: "source,external_id" });
      if (error) {
        await audit(userData.user.id, false, {
          stage: "upsert",
          error: error.message,
          attempted: findings.length,
        });
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    await audit(userData.user.id, true, {
      ingested: findings.length,
      packages: TRACKED_PACKAGES.length,
    });

    return new Response(
      JSON.stringify({ ok: true, ingested: findings.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = (e as Error).message ?? "unknown";
    await audit(null, false, { error: msg });
    return new Response(
      JSON.stringify({ error: msg }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});