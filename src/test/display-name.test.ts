import { describe, it, expect } from "vitest";
import { getDisplayName, getInitials } from "@/lib/display-name";

describe("getDisplayName — used by 'Good morning {user.name}'", () => {
  it("returns first name from full_name", () => {
    expect(getDisplayName({ user_metadata: { full_name: "Maria Clara" } })).toBe("Maria");
  });

  it("walks fallback chain when full_name is missing", () => {
    expect(getDisplayName({ user_metadata: { name: "Jose Rizal" } })).toBe("Jose");
    expect(getDisplayName({ user_metadata: { display_name: "Andres" } })).toBe("Andres");
    expect(getDisplayName({ user_metadata: { preferred_username: "gabriela" } })).toBe("gabriela");
    expect(getDisplayName({ user_metadata: { user_name: "lapu" } })).toBe("lapu");
    expect(getDisplayName({ user_metadata: { given_name: "Melchora" } })).toBe("Melchora");
    expect(getDisplayName({ user_metadata: { first_name: "Tandang" } })).toBe("Tandang");
  });

  it("prefers earlier candidates over later ones", () => {
    expect(
      getDisplayName({
        user_metadata: { full_name: "Maria Clara", name: "Other", first_name: "Ignored" },
      })
    ).toBe("Maria");
  });

  it("ignores empty, whitespace-only, and non-string metadata values", () => {
    expect(
      getDisplayName({
        email: "fallback@example.com",
        user_metadata: {
          full_name: "",
          name: "   ",
          display_name: null,
          preferred_username: 42,
          user_name: undefined,
        },
      })
    ).toBe("fallback");
  });

  it("trims surrounding whitespace before taking the first token", () => {
    expect(getDisplayName({ user_metadata: { full_name: "   Maria   Clara  " } })).toBe("Maria");
  });

  it("falls back to email local-part when metadata is empty", () => {
    expect(getDisplayName({ email: "juan@example.com", user_metadata: {} })).toBe("juan");
  });

  it("falls back to email local-part when user_metadata is null", () => {
    expect(getDisplayName({ email: "ana@example.com", user_metadata: null })).toBe("ana");
  });

  it("returns 'friend' when everything is null or undefined", () => {
    expect(getDisplayName(null)).toBe("friend");
    expect(getDisplayName(undefined)).toBe("friend");
    expect(getDisplayName({})).toBe("friend");
    expect(getDisplayName({ email: null, user_metadata: null })).toBe("friend");
  });

  it("returns 'friend' when email has no local part or is malformed", () => {
    expect(getDisplayName({ email: "no-at-sign", user_metadata: {} })).toBe("friend");
    expect(getDisplayName({ email: "@nolocal.com", user_metadata: {} })).toBe("friend");
  });

  it("always returns a non-empty string so 'Good morning {name}' is never broken", () => {
    const inputs: DisplayNameInput[] = [
      null,
      undefined,
      {},
      { email: "" },
      { email: null, user_metadata: null },
      { user_metadata: { full_name: "" } },
      { user_metadata: { full_name: "   " } },
      { user_metadata: { name: 123 as unknown as string } },
    ];
    for (const u of inputs) {
      const name = getDisplayName(u);
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
      expect(`Good morning ${name}`).toMatch(/^Good morning \S+/);
    }
  });
});

type DisplayNameInput = Parameters<typeof getDisplayName>[0];

describe("getInitials", () => {
  it("returns up to two uppercase characters", () => {
    expect(getInitials("Maria")).toBe("MA");
    expect(getInitials("j")).toBe("J");
  });

  it("returns '?' for empty input so the avatar never renders blank", () => {
    expect(getInitials("")).toBe("?");
  });
});