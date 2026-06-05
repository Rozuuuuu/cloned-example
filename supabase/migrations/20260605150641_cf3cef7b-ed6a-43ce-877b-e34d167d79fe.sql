
REVOKE ALL ON FUNCTION public.seed_scan_findings() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_audit_event(text, text, text, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, text, boolean, jsonb) TO anon, authenticated;
