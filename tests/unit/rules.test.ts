import { describe, expect, it } from "vitest";
import {
  formatMinutes,
  formatQuantity,
  formatRatingSummary,
} from "@/lib/format";
import { labelFromSlug } from "@/lib/labels";
import { checkMediaFile, isAllowedMediaUrl } from "@/lib/media";
import type { Actor } from "@/lib/privileges";
import {
  applyVoteChange,
  canEditRecipe,
  canReviewRecipe,
  canVoteOnReview,
  compareReviews,
  isListedReview,
  nextVote,
  parseBrowseFilters,
  shouldClearVotes,
} from "@/lib/rules";
import { safeCallbackUrl } from "@/lib/urls";

const as = (id: string, level = 1, banned = false): Actor => ({
  id,
  level,
  banned,
});

const recipe = { authorId: "author" };

describe("BR-5: only the author can edit or delete", () => {
  it("allows the author", () =>
    expect(canEditRecipe(as("author"), recipe)).toBe(true));
  it("rejects other users", () =>
    expect(canEditRecipe(as("other", 100), recipe)).toBe(false));
  it("rejects guests", () => {
    expect(canEditRecipe(null, recipe)).toBe(false);
  });
  it("rejects a banned (read-only) author", () =>
    expect(canEditRecipe(as("author", 2, true), recipe)).toBe(false));
});

describe("BR-8: authors cannot review their own recipe", () => {
  it("allows other users", () =>
    expect(canReviewRecipe(as("other"), recipe)).toBe(true));
  it("rejects the author", () =>
    expect(canReviewRecipe(as("author"), recipe)).toBe(false));
  it("rejects guests", () => expect(canReviewRecipe(null, recipe)).toBe(false));
  it("rejects banned users", () =>
    expect(canReviewRecipe(as("other", 1, true), recipe)).toBe(false));
});

describe("BR-9: only reviews with a comment are listed", () => {
  it("lists reviews with text", () =>
    expect(isListedReview({ comment: "Yum" })).toBe(true));
  it("hides rating-only reviews", () => {
    expect(isListedReview({ comment: null })).toBe(false);
    expect(isListedReview({ comment: "  " })).toBe(false);
  });
});

describe("BR-10: removing a comment clears votes", () => {
  it("clears when a comment is removed", () =>
    expect(shouldClearVotes("Yum", null)).toBe(true));
  it("keeps votes when the comment is edited", () =>
    expect(shouldClearVotes("Yum", "Yummy")).toBe(false));
  it("does nothing when there was no comment", () =>
    expect(shouldClearVotes(null, null)).toBe(false));
});

describe("BR-12: users cannot vote on their own review", () => {
  const review = { userId: "reviewer", comment: "Great" };
  it("allows other users", () =>
    expect(canVoteOnReview(as("other"), review)).toBe(true));
  it("rejects the reviewer", () =>
    expect(canVoteOnReview(as("reviewer"), review)).toBe(false));
  it("rejects guests", () => expect(canVoteOnReview(null, review)).toBe(false));
  it("rejects banned users", () =>
    expect(canVoteOnReview(as("other", 1, true), review)).toBe(false));
  it("rejects votes on unlisted reviews", () =>
    expect(
      canVoteOnReview(as("other"), { userId: "reviewer", comment: null }),
    ).toBe(false));
});

describe("BR-11 / US-5.1: vote transitions", () => {
  it("adds a vote when there is none", () =>
    expect(nextVote(null, "LIKE")).toBe("LIKE"));
  it("removes the vote when the same button is clicked", () =>
    expect(nextVote("LIKE", "LIKE")).toBeNull());
  it("switches when the other button is clicked", () =>
    expect(nextVote("LIKE", "DISLIKE")).toBe("DISLIKE"));

  it("keeps tallies consistent (a user holds at most one vote)", () => {
    const t = { likes: 3, dislikes: 1 };
    expect(applyVoteChange(t, null, "LIKE")).toEqual({ likes: 4, dislikes: 1 });
    expect(applyVoteChange(t, "LIKE", null)).toEqual({ likes: 2, dislikes: 1 });
    expect(applyVoteChange(t, "LIKE", "DISLIKE")).toEqual({
      likes: 2,
      dislikes: 2,
    });
  });
});

describe("US-4.5: review ordering", () => {
  it("sorts by score, then newest first", () => {
    const r = (id: string, likes: number, dislikes: number, day: number) => ({
      id,
      likes,
      dislikes,
      createdAt: new Date(2026, 0, day),
    });
    const sorted = [
      r("a", 1, 0, 1),
      r("b", 5, 4, 3),
      r("c", 3, 0, 2),
      r("d", 1, 0, 5),
    ].sort(compareReviews);
    expect(sorted.map((x) => x.id)).toEqual(["c", "d", "b", "a"]);
  });
});

describe("browse filters (US-3.2)", () => {
  it("parses labels, time and shown count from the URL", () => {
    expect(
      parseBrowseFilters(
        { labels: "vegan,spicy", maxTime: "30", shown: "24" },
        labelFromSlug,
      ),
    ).toEqual({
      labels: ["VEGAN", "SPICY"],
      maxTime: 30,
      minRating: null,
      sort: "newest",
      shown: 24,
    });
  });

  it("accepts repeated label params and drops unknown/duplicate ones", () => {
    expect(
      parseBrowseFilters({ labels: ["vegan", "keto", "vegan"] }, labelFromSlug)
        .labels,
    ).toEqual(["VEGAN"]);
  });

  it("ignores invalid time and shown values", () => {
    expect(
      parseBrowseFilters({ maxTime: "45", shown: "-3" }, labelFromSlug),
    ).toEqual({
      labels: [],
      maxTime: null,
      minRating: null,
      sort: "newest",
      shown: 12,
    });
  });
});

describe("formatting", () => {
  it.each([
    [45, "45 min"],
    [60, "1 h"],
    [90, "1 h 30 min"],
  ])("formats %i minutes as %s", (m, s) => expect(formatMinutes(m)).toBe(s));

  it("formats the rating summary", () => {
    expect(formatRatingSummary(4.333, 18)).toBe("4.3 from 18 ratings");
    expect(formatRatingSummary(5, 1)).toBe("5.0 from 1 rating");
    expect(formatRatingSummary(null, 0)).toBe("No ratings yet");
  });

  it("formats quantities without trailing zeros", () => {
    expect(formatQuantity(1.5)).toBe("1.5");
    expect(formatQuantity(250)).toBe("250");
  });
});

describe("media rules (US-2.2)", () => {
  it("checks type and size", () => {
    expect(
      checkMediaFile({ type: "image/png", size: 1000 }, "image"),
    ).toBeNull();
    expect(checkMediaFile({ type: "image/gif", size: 1000 }, "image")).toMatch(
      /JPG, PNG or WebP/,
    );
    expect(
      checkMediaFile({ type: "image/jpeg", size: 6 * 1024 * 1024 }, "image"),
    ).toMatch(/5 MB/);
    expect(
      checkMediaFile({ type: "video/mp4", size: 101 * 1024 * 1024 }, "video"),
    ).toMatch(/100 MB/);
  });

  it("only accepts URLs from our storage", () => {
    expect(isAllowedMediaUrl("/api/uploads/abc-123.webp", "image")).toBe(true);
    expect(isAllowedMediaUrl("/api/uploads/../secret.jpg", "image")).toBe(
      false,
    );
    expect(
      isAllowedMediaUrl(
        "http://x.public.blob.vercel-storage.com/a.jpg",
        "image",
      ),
    ).toBe(false);
    expect(
      isAllowedMediaUrl(
        "https://x.public.blob.vercel-storage.com.evil.com/a.jpg",
        "image",
      ),
    ).toBe(false);
    expect(isAllowedMediaUrl("javascript:alert(1)", "image")).toBe(false);
  });
});

describe("post-login redirects", () => {
  it("allows same-site paths only", () => {
    expect(safeCallbackUrl("/recipes/abc?x=1")).toBe("/recipes/abc?x=1");
    expect(safeCallbackUrl("//evil.com")).toBe("/");
    expect(safeCallbackUrl("/\\evil.com")).toBe("/");
    expect(safeCallbackUrl("https://evil.com")).toBe("/");
    expect(safeCallbackUrl(null)).toBe("/");
  });
});
