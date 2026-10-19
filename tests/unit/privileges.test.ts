import { describe, expect, it } from "vitest";
import {
  type Actor,
  canBanUser,
  canChangeDisplayName,
  canChooseProfileVisibility,
  canCreateLabel,
  canCreateRecipe,
  canDeleteAccount,
  canDeleteAnyLabel,
  canDeleteLabel,
  canDeleteOwnAccount,
  canModerateReview,
  canOpenDashboard,
  canSeeContentOf,
  canSeeHiddenRecipes,
  canSeeRecipe,
  canSetLevel,
  hasPrivateProfile,
  isPrivilegeLevel,
  isStaff,
  LABEL_DELETE_WINDOW_MS,
  LEVEL,
} from "@/lib/privileges";
import { canLikeRecipe, likeMode } from "@/lib/rules";

const actor = (level: number, banned = false, id = "me"): Actor => ({
  id,
  level,
  banned,
});
const target = (level: number, id = "them") => ({ id, level });

const user = actor(LEVEL.USER);
const chef = actor(LEVEL.CHEF);
const mod = actor(LEVEL.MODERATOR);
const admin = actor(LEVEL.ADMIN);

describe("level 2 (chef): publish recipes", () => {
  it("chefs and above can create recipes", () => {
    expect(canCreateRecipe(chef)).toBe(true);
    expect(canCreateRecipe(mod)).toBe(true);
    expect(canCreateRecipe(admin)).toBe(true);
  });
  it("users and guests can't", () => {
    expect(canCreateRecipe(user)).toBe(false);
    expect(canCreateRecipe(null)).toBe(false);
  });
  it("banned chefs can't (read-only)", () => {
    expect(canCreateRecipe(actor(LEVEL.CHEF, true))).toBe(false);
  });
});

describe("level 10 (moderator): moderate reviews and ban", () => {
  it("can moderate and ban users and chefs", () => {
    for (const level of [LEVEL.USER, LEVEL.CHEF]) {
      expect(canModerateReview(mod, target(level))).toBe(true);
      expect(canBanUser(mod, target(level))).toBe(true);
    }
  });
  it("can't act on other moderators or admins", () => {
    expect(canModerateReview(mod, target(LEVEL.MODERATOR))).toBe(false);
    expect(canModerateReview(mod, target(LEVEL.ADMIN))).toBe(false);
    expect(canBanUser(mod, target(LEVEL.MODERATOR))).toBe(false);
  });
  it("users and chefs can't moderate or ban", () => {
    expect(canModerateReview(chef, target(LEVEL.USER))).toBe(false);
    expect(canBanUser(chef, target(LEVEL.USER))).toBe(false);
  });
  it("can't delete accounts or change levels", () => {
    expect(canDeleteAccount(mod, target(LEVEL.USER))).toBe(false);
    expect(canSetLevel(mod, target(LEVEL.USER), LEVEL.CHEF)).toBe(false);
  });
  it("a banned moderator loses moderation powers", () => {
    expect(
      canModerateReview(actor(LEVEL.MODERATOR, true), target(LEVEL.USER)),
    ).toBe(false);
    expect(canOpenDashboard(actor(LEVEL.MODERATOR, true))).toBe(false);
  });
});

describe("level 100 (admin): delete accounts and set levels", () => {
  it("can do everything to lower levels, including moderators", () => {
    expect(canModerateReview(admin, target(LEVEL.MODERATOR))).toBe(true);
    expect(canBanUser(admin, target(LEVEL.MODERATOR))).toBe(true);
    expect(canDeleteAccount(admin, target(LEVEL.MODERATOR))).toBe(true);
    expect(canSetLevel(admin, target(LEVEL.USER), LEVEL.ADMIN)).toBe(true);
  });
  it("can't act on other admins", () => {
    expect(canDeleteAccount(admin, target(LEVEL.ADMIN))).toBe(false);
    expect(canSetLevel(admin, target(LEVEL.ADMIN), LEVEL.USER)).toBe(false);
    expect(canBanUser(admin, target(LEVEL.ADMIN))).toBe(false);
  });
  it("can't act on their own account", () => {
    const self = { id: "me", level: LEVEL.ADMIN };
    expect(canDeleteAccount(admin, self)).toBe(false);
    expect(canSetLevel(admin, { id: "me", level: 1 }, LEVEL.CHEF)).toBe(false);
  });
  it("only accepts defined levels", () => {
    expect(canSetLevel(admin, target(LEVEL.USER), 5)).toBe(false);
    expect(canSetLevel(admin, target(LEVEL.USER), "100")).toBe(false);
    expect(isPrivilegeLevel(10)).toBe(true);
    expect(isPrivilegeLevel(3)).toBe(false);
  });
});

describe("dashboard access", () => {
  it("is for moderators and admins", () => {
    expect(canOpenDashboard(mod)).toBe(true);
    expect(canOpenDashboard(admin)).toBe(true);
    expect(canOpenDashboard(chef)).toBe(false);
    expect(canOpenDashboard(null)).toBe(false);
  });
});

describe("recipe likes", () => {
  const recipe = { authorId: "author" };
  it("logged-in users can like other people's recipes", () => {
    expect(canLikeRecipe(actor(LEVEL.USER, false, "other"), recipe)).toBe(true);
    expect(likeMode(actor(LEVEL.USER, false, "other"), recipe)).toBe("liker");
  });
  it("authors can't like their own recipe", () => {
    expect(canLikeRecipe(actor(LEVEL.CHEF, false, "author"), recipe)).toBe(
      false,
    );
    expect(likeMode(actor(LEVEL.CHEF, false, "author"), recipe)).toBe("own");
  });
  it("guests and banned users can't like", () => {
    expect(canLikeRecipe(null, recipe)).toBe(false);
    expect(likeMode(null, recipe)).toBe("guest");
    expect(canLikeRecipe(actor(LEVEL.USER, true, "other"), recipe)).toBe(false);
    expect(likeMode(actor(LEVEL.USER, true, "other"), recipe)).toBe("readonly");
  });
});

describe("own account settings", () => {
  it("banned accounts can't change their display name", () => {
    expect(canChangeDisplayName(actor(LEVEL.USER))).toBe(true);
    expect(canChangeDisplayName(actor(LEVEL.USER, true))).toBe(false);
    expect(canChangeDisplayName(null)).toBe(false);
  });
  it("anyone can delete their own account, except the last admin", () => {
    expect(canDeleteOwnAccount(actor(LEVEL.USER), 1)).toBe(true);
    expect(canDeleteOwnAccount(actor(LEVEL.MODERATOR), 1)).toBe(true);
    expect(canDeleteOwnAccount(actor(LEVEL.ADMIN), 2)).toBe(true);
    expect(canDeleteOwnAccount(actor(LEVEL.ADMIN), 1)).toBe(false);
    expect(canDeleteOwnAccount(null, 5)).toBe(false);
  });
});

describe("private profiles", () => {
  const owner = (level: number, isPrivate = true) => ({
    id: "owner",
    isPrivate,
    level,
  });

  it("is a chef-and-up option", () => {
    expect(hasPrivateProfile(owner(LEVEL.CHEF))).toBe(true);
    expect(hasPrivateProfile(owner(LEVEL.ADMIN))).toBe(true);
    // A demoted user's content becomes public again
    expect(hasPrivateProfile(owner(LEVEL.USER))).toBe(false);
    expect(hasPrivateProfile(owner(LEVEL.CHEF, false))).toBe(false);
  });

  it("only the owner and staff see private content", () => {
    const priv = owner(LEVEL.CHEF);
    expect(canSeeContentOf(null, priv)).toBe(false);
    expect(canSeeContentOf(actor(LEVEL.USER), priv)).toBe(false);
    expect(canSeeContentOf(actor(LEVEL.CHEF), priv)).toBe(false);
    expect(canSeeContentOf(actor(LEVEL.CHEF, false, "owner"), priv)).toBe(true);
    expect(canSeeContentOf(actor(LEVEL.MODERATOR), priv)).toBe(true);
    expect(canSeeContentOf(actor(LEVEL.ADMIN), priv)).toBe(true);
    // A banned moderator loses staff access
    expect(canSeeContentOf(actor(LEVEL.MODERATOR, true), priv)).toBe(false);
  });

  it("everyone sees public content", () => {
    expect(canSeeContentOf(null, owner(LEVEL.CHEF, false))).toBe(true);
  });

  it("chefs and up (not banned) can choose", () => {
    expect(canChooseProfileVisibility(actor(LEVEL.USER))).toBe(false);
    expect(canChooseProfileVisibility(actor(LEVEL.CHEF))).toBe(true);
    expect(canChooseProfileVisibility(actor(LEVEL.ADMIN))).toBe(true);
    expect(canChooseProfileVisibility(actor(LEVEL.CHEF, true))).toBe(false);
    expect(isStaff(actor(LEVEL.MODERATOR))).toBe(true);
    expect(isStaff(actor(LEVEL.CHEF))).toBe(false);
  });
});

describe("labels", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const mine = (age: number) => ({ createdById: "me", createdAt: ago(age) });

  it("chefs and up (not banned) can create labels", () => {
    expect(canCreateLabel(null)).toBe(false);
    expect(canCreateLabel(actor(LEVEL.USER))).toBe(false);
    expect(canCreateLabel(actor(LEVEL.CHEF))).toBe(true);
    expect(canCreateLabel(actor(LEVEL.MODERATOR))).toBe(true);
    expect(canCreateLabel(actor(LEVEL.ADMIN))).toBe(true);
    expect(canCreateLabel(actor(LEVEL.CHEF, true))).toBe(false);
  });

  it("creators can delete their label only within 15 minutes", () => {
    const chef = actor(LEVEL.CHEF);
    expect(LABEL_DELETE_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(canDeleteLabel(chef, mine(0), now)).toBe(true);
    expect(canDeleteLabel(chef, mine(LABEL_DELETE_WINDOW_MS - 1), now)).toBe(
      true,
    );
    expect(canDeleteLabel(chef, mine(LABEL_DELETE_WINDOW_MS), now)).toBe(false);
    expect(canDeleteLabel(actor(LEVEL.MODERATOR), mine(60_000), now)).toBe(
      true,
    );
    // Not while banned or demoted
    expect(canDeleteLabel(actor(LEVEL.CHEF, true), mine(0), now)).toBe(false);
    expect(canDeleteLabel(actor(LEVEL.USER), mine(0), now)).toBe(false);
  });

  it("only admins can delete others' or built-in labels", () => {
    const others = { createdById: "someone", createdAt: now };
    const builtIn = { createdById: null, createdAt: ago(365 * 86_400_000) };
    expect(canDeleteLabel(actor(LEVEL.CHEF), others, now)).toBe(false);
    expect(canDeleteLabel(actor(LEVEL.MODERATOR), others, now)).toBe(false);
    expect(canDeleteLabel(actor(LEVEL.MODERATOR), builtIn, now)).toBe(false);
    expect(canDeleteLabel(actor(LEVEL.ADMIN), others, now)).toBe(true);
    expect(canDeleteLabel(actor(LEVEL.ADMIN), builtIn, now)).toBe(true);
    expect(canDeleteLabel(actor(LEVEL.ADMIN), mine(86_400_000), now)).toBe(
      true,
    );
    expect(canDeleteAnyLabel(actor(LEVEL.ADMIN, true))).toBe(false);
  });
});

describe("recipes hidden from the public", () => {
  const recipe = (isPublic: boolean, isPrivate = false) => ({
    isPublic,
    author: { id: "owner", isPrivate, level: LEVEL.CHEF },
  });

  it("everyone sees public recipes", () => {
    expect(canSeeRecipe(null, recipe(true))).toBe(true);
    expect(canSeeRecipe(user, recipe(true))).toBe(true);
  });

  it("only the author and chefs and up see hidden recipes", () => {
    const hidden = recipe(false);
    expect(canSeeRecipe(null, hidden)).toBe(false);
    expect(canSeeRecipe(user, hidden)).toBe(false);
    expect(canSeeRecipe(chef, hidden)).toBe(true);
    expect(canSeeRecipe(mod, hidden)).toBe(true);
    expect(canSeeRecipe(admin, hidden)).toBe(true);
    // The author, even when demoted or read-only
    expect(canSeeRecipe(actor(LEVEL.USER, true, "owner"), hidden)).toBe(true);
  });

  it("banned chefs lose access to hidden recipes", () => {
    expect(canSeeHiddenRecipes(actor(LEVEL.CHEF, true))).toBe(false);
    expect(canSeeRecipe(actor(LEVEL.CHEF, true), recipe(false))).toBe(false);
  });

  it("a private profile still hides its public recipes from chefs", () => {
    expect(canSeeRecipe(chef, recipe(true, true))).toBe(false);
    expect(canSeeRecipe(chef, recipe(false, true))).toBe(false);
    expect(canSeeRecipe(mod, recipe(false, true))).toBe(true);
  });
});
