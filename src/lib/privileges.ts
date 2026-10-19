/**
 * Privilege levels. Each level can do everything the levels below it can.
 * Acting on another account only works on accounts with a *lower* level, so
 * moderators can't moderate each other and admins can't remove each other.
 */
export const LEVEL = {
  USER: 1, // browse, search, rate and review
  CHEF: 2, // + publish recipes
  MODERATOR: 10, // + edit/remove reviews of lower levels, ban/unban them
  ADMIN: 100, // + delete accounts and change privilege levels
} as const;

export type PrivilegeLevel = (typeof LEVEL)[keyof typeof LEVEL];

export const LEVELS: readonly { level: PrivilegeLevel; name: string }[] = [
  { level: LEVEL.USER, name: "User" },
  { level: LEVEL.CHEF, name: "Chef" },
  { level: LEVEL.MODERATOR, name: "Moderator" },
  { level: LEVEL.ADMIN, name: "Admin" },
];

export function isPrivilegeLevel(value: unknown): value is PrivilegeLevel {
  return LEVELS.some((l) => l.level === value);
}

export function levelName(level: number): string {
  return LEVELS.find((l) => l.level === level)?.name ?? `Level ${level}`;
}

export const READ_ONLY_MESSAGE =
  "Your account has been suspended and is read-only.";

/** The logged-in account, as permission checks see it. */
export type Actor = { id: string; level: number; banned: boolean };

/** Banned accounts are read-only: they can browse but not change anything. */
function canWrite(actor: Actor | null): actor is Actor {
  return !!actor && !actor.banned;
}

export function canCreateRecipe(actor: Actor | null) {
  return canWrite(actor) && actor.level >= LEVEL.CHEF;
}

/** Shared rule for moderator/admin actions on another account. */
function outranks(actor: Actor, target: { id: string; level: number }) {
  return actor.id !== target.id && target.level < actor.level;
}

export function canModerateReview(
  actor: Actor | null,
  reviewer: { id: string; level: number },
) {
  return (
    canWrite(actor) &&
    actor.level >= LEVEL.MODERATOR &&
    outranks(actor, reviewer)
  );
}

export function canBanUser(
  actor: Actor | null,
  target: { id: string; level: number },
) {
  return (
    canWrite(actor) && actor.level >= LEVEL.MODERATOR && outranks(actor, target)
  );
}

export function canDeleteAccount(
  actor: Actor | null,
  target: { id: string; level: number },
) {
  return (
    canWrite(actor) && actor.level >= LEVEL.ADMIN && outranks(actor, target)
  );
}

export function canSetLevel(
  actor: Actor | null,
  target: { id: string; level: number },
  newLevel: unknown,
) {
  return (
    canWrite(actor) &&
    actor.level >= LEVEL.ADMIN &&
    outranks(actor, target) &&
    isPrivilegeLevel(newLevel)
  );
}

/** Who can open the management dashboard at /admin. */
export function canOpenDashboard(actor: Actor | null) {
  return canWrite(actor) && actor.level >= LEVEL.MODERATOR;
}

/** Banned accounts can't rename themselves (a name is public content). */
export function canChangeDisplayName(actor: Actor | null) {
  return canWrite(actor);
}

/**
 * Anyone can delete their own account, except the last admin: otherwise no
 * one could manage users any more.
 */
export function canDeleteOwnAccount(actor: Actor | null, adminCount: number) {
  if (!actor) return false;
  return !(actor.level >= LEVEL.ADMIN && adminCount <= 1);
}

// ─────────────────────────────── Private profiles ───────────────────────────────

/** Moderators and admins (not banned): they can see private content to moderate it. */
export function isStaff(actor: Actor | null) {
  return canWrite(actor) && actor.level >= LEVEL.MODERATOR;
}

/**
 * A profile is private only while its owner is a chef or above: privacy is a
 * chef+ option, so a demoted user's content becomes public again.
 */
export function hasPrivateProfile(owner: {
  isPrivate: boolean;
  level: number;
}) {
  return owner.isPrivate && owner.level >= LEVEL.CHEF;
}

/** Private profiles, recipes and reviews: only the owner and staff see them. */
export function canSeeContentOf(
  viewer: Actor | null,
  owner: { id: string; isPrivate: boolean; level: number },
) {
  return (
    !hasPrivateProfile(owner) || viewer?.id === owner.id || isStaff(viewer)
  );
}

/** Chefs and up can make their profile private (not while read-only). */
export function canChooseProfileVisibility(actor: Actor | null) {
  return canWrite(actor) && actor.level >= LEVEL.CHEF;
}

// ──────────────────────────────── Labels ────────────────────────────────

/** How long after creating a label its creator can still delete it. */
export const LABEL_DELETE_WINDOW_MS = 15 * 60 * 1000;

/** Chefs and up can add labels everyone can use. */
export function canCreateLabel(actor: Actor | null) {
  return canWrite(actor) && actor.level >= LEVEL.CHEF;
}

/** Admins can delete any label, including the built-in ones. */
export function canDeleteAnyLabel(actor: Actor | null) {
  return canWrite(actor) && actor.level >= LEVEL.ADMIN;
}

/**
 * Creators can take back a label shortly after adding it (e.g. a typo);
 * after that, only admins can delete it.
 */
export function canDeleteLabel(
  actor: Actor | null,
  label: { createdById: string | null; createdAt: Date },
  now: Date,
) {
  if (canDeleteAnyLabel(actor)) return true;
  return (
    canWrite(actor) &&
    actor.level >= LEVEL.CHEF &&
    label.createdById === actor.id &&
    now.getTime() - label.createdAt.getTime() < LABEL_DELETE_WINDOW_MS
  );
}
