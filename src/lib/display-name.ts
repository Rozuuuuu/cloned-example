/**
 * Resolve a single-word greeting name from a Supabase user-like object.
 *
 * Walks a fixed list of metadata fields (full_name, name, display_name, …),
 * trims, and returns the first whitespace-delimited token. Falls back to the
 * email local-part, and finally to `"friend"`. Always returns a non-empty
 * string so the dashboard can render exactly "Good morning {name}".
 */
export type DisplayNameUser = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
} | null | undefined;

const META_FIELDS = [
  "full_name",
  "name",
  "display_name",
  "preferred_username",
  "user_name",
  "given_name",
  "first_name",
] as const;

export function getDisplayName(user: DisplayNameUser): string {
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  for (const key of META_FIELDS) {
    const v = meta[key];
    if (typeof v === "string" && v.trim()) {
      return v.trim().split(/\s+/)[0];
    }
  }
  const email = user?.email;
  if (typeof email === "string" && email.includes("@")) {
    const local = email.split("@")[0];
    if (local) return local;
  }
  return "friend";
}

export function getInitials(name: string): string {
  return (name || "?").slice(0, 2).toUpperCase();
}