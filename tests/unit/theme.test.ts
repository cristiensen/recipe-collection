import { describe, expect, it } from "vitest";
import { parseTheme, pickTheme, reconcileAtLogin } from "@/lib/theme";

describe("theme cookie", () => {
  it("defaults to the dark blue theme", () => {
    expect(parseTheme(undefined)).toBe("dark");
    expect(parseTheme("purple")).toBe("dark");
  });

  it("keeps a saved choice", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
  });
});

describe("pickTheme", () => {
  it("prefers the account's saved choice over the cookie", () => {
    expect(pickTheme("LIGHT", "dark")).toBe("light");
    expect(pickTheme("DARK", "light")).toBe("dark");
  });

  it("falls back to the cookie, then the default", () => {
    expect(pickTheme(null, "light")).toBe("light");
    expect(pickTheme(undefined, undefined)).toBe("dark");
  });
});

describe("reconcileAtLogin", () => {
  it("lets a saved account preference win and syncs the cookie", () => {
    expect(reconcileAtLogin("LIGHT", "dark")).toEqual({
      saveToAccount: null,
      setCookie: "light",
    });
  });

  it("adopts the guest's choice when the account never chose", () => {
    expect(reconcileAtLogin(null, "light")).toEqual({
      saveToAccount: "LIGHT",
      setCookie: null,
    });
  });

  it("does nothing when neither has a choice", () => {
    expect(reconcileAtLogin(null, undefined)).toEqual({
      saveToAccount: null,
      setCookie: null,
    });
    expect(reconcileAtLogin(null, "garbage")).toEqual({
      saveToAccount: null,
      setCookie: null,
    });
  });
});
