import { describe, expect, it } from "vitest";
import {
  labelCountError,
  labelLimit,
  labelNames,
  MAX_LABELS,
  MAX_VISIBLE_LABELS,
  slugify,
  visibleLabelChips,
} from "@/lib/labels";
import {
  browseHref,
  clampShown,
  hasActiveFilters,
  MAX_QUERY_LENGTH,
  MAX_SHOWN,
  MIN_RATING_OPTIONS,
  parseBrowseFilters,
  SORT_OPTIONS,
} from "@/lib/rules";
import { labelNameSchema } from "@/lib/validation";

/** The built-in labels, in their order. */
const LABELS = [
  { slug: "vegan", name: "Vegan" },
  { slug: "vegetarian", name: "Vegetarian" },
  { slug: "gluten-free", name: "Gluten-free" },
  { slug: "dairy-free", name: "Dairy-free" },
  { slug: "spicy", name: "Spicy" },
  { slug: "dessert", name: "Dessert" },
  { slug: "breakfast", name: "Breakfast" },
  { slug: "quick", name: "Quick" },
];
const isLabel = (slug: string) => LABELS.some((l) => l.slug === slug);

describe("visibleLabelChips", () => {
  it("shows at most 5 labels when none of the others are selected", () => {
    const chips = visibleLabelChips(LABELS, [], MAX_VISIBLE_LABELS);
    expect(chips).toHaveLength(5);
    expect(chips.map((l) => l.slug)).toEqual(
      LABELS.slice(0, 5).map((l) => l.slug),
    );
  });

  it("keeps selected labels from the dropdown visible as extra chips", () => {
    const chips = visibleLabelChips(LABELS, ["breakfast"], MAX_VISIBLE_LABELS);
    expect(chips).toHaveLength(6);
    expect(chips.at(-1)?.slug).toBe("breakfast");
  });

  it("doesn't duplicate selected labels already among the first 5", () => {
    expect(
      visibleLabelChips(LABELS, ["vegan"], MAX_VISIBLE_LABELS),
    ).toHaveLength(5);
  });
});

describe("browseHref", () => {
  it("builds a shareable URL", () => {
    expect(
      browseHref({
        labels: ["vegan", "dairy-free"],
        maxTime: 30,
        minRating: null,
      }),
    ).toBe("/?labels=vegan%2Cdairy-free&maxTime=30");
    expect(browseHref({ labels: [], maxTime: null, minRating: null })).toBe(
      "/",
    );
  });

  it("records how many recipes are shown after 'Load more'", () => {
    expect(
      browseHref({ labels: [], maxTime: null, minRating: null, shown: 36 }),
    ).toBe("/?shown=36");
    // The first batch is the default, so it isn't written to the URL
    expect(
      browseHref({ labels: [], maxTime: null, minRating: null, shown: 12 }),
    ).toBe("/");
  });
});

describe("clampShown", () => {
  it("rounds up to whole batches of 12", () => {
    expect(clampShown("24")).toBe(24);
    expect(clampShown("25")).toBe(36);
  });
  it("falls back to one batch for missing or invalid values", () => {
    expect(clampShown(undefined)).toBe(12);
    expect(clampShown("abc")).toBe(12);
    expect(clampShown("-5")).toBe(12);
  });
  it("caps very large requests", () => {
    expect(clampShown("100000")).toBe(MAX_SHOWN);
  });
});

describe("label limit", () => {
  it("allows up to 7 labels on new recipes", () => {
    expect(labelCountError(7)).toBeNull();
    expect(labelCountError(8)).toBe("Choose at most 7 labels");
  });
  it("lets older recipes keep more, but not add any", () => {
    expect(labelLimit(8)).toBe(8);
    expect(labelCountError(8, 8)).toBeNull();
    expect(labelCountError(6, 8)).toBeNull();
    expect(labelCountError(9, 8)).toBe("Choose at most 8 labels");
  });
  it("uses the standard limit for recipes at or under it", () => {
    expect(labelLimit(3)).toBe(MAX_LABELS);
    expect(labelCountError(8, 3)).toBe("Choose at most 7 labels");
  });
});

describe("minimum rating filter", () => {
  it("is written to and read from the URL", () => {
    expect(browseHref({ labels: [], maxTime: null, minRating: 3.5 })).toBe(
      "/?minRating=3.5",
    );
    expect(parseBrowseFilters({ minRating: "4.5" }, isLabel).minRating).toBe(
      4.5,
    );
  });
  it("only accepts 1 to 5 in steps of 0.5", () => {
    for (const bad of ["0", "0.5", "3.7", "5.5", "abc", "-1"]) {
      expect(
        parseBrowseFilters({ minRating: bad }, isLabel).minRating,
      ).toBeNull();
    }
    expect(MIN_RATING_OPTIONS).toEqual([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]);
  });
  it("counts as an active filter", () => {
    expect(
      hasActiveFilters({ labels: [], maxTime: null, minRating: null }),
    ).toBe(false);
    expect(hasActiveFilters({ labels: [], maxTime: null, minRating: 1 })).toBe(
      true,
    );
  });
});

describe("sort order", () => {
  it("defaults to newest first and keeps it out of the URL", () => {
    expect(parseBrowseFilters({}, isLabel).sort).toBe("newest");
    expect(
      browseHref({
        labels: [],
        maxTime: null,
        minRating: null,
        sort: "newest",
      }),
    ).toBe("/");
  });
  it("reads and writes the other orders", () => {
    for (const { value } of SORT_OPTIONS) {
      expect(parseBrowseFilters({ sort: value }, isLabel).sort).toBe(value);
    }
    expect(
      browseHref({
        labels: [],
        maxTime: null,
        minRating: null,
        sort: "rating-desc",
      }),
    ).toBe("/?sort=rating-desc");
  });
  it("falls back to newest for unknown values", () => {
    expect(parseBrowseFilters({ sort: "price" }, isLabel).sort).toBe("newest");
    expect(parseBrowseFilters({ sort: "1; DROP TABLE" }, isLabel).sort).toBe(
      "newest",
    );
  });
});

describe("search", () => {
  it("is written to and read from the URL, tidied up", () => {
    expect(
      browseHref({
        query: "  tomato   soup ",
        labels: [],
        maxTime: null,
        minRating: null,
      }),
    ).toBe("/?q=tomato+soup");
    expect(parseBrowseFilters({ q: " pasta  bake " }, isLabel).query).toBe(
      "pasta bake",
    );
    expect(parseBrowseFilters({}, isLabel).query).toBe("");
  });
  it("caps very long searches", () => {
    expect(
      parseBrowseFilters({ q: "a".repeat(500) }, isLabel).query,
    ).toHaveLength(MAX_QUERY_LENGTH);
  });
  it("doesn't count as a filter", () => {
    expect(
      hasActiveFilters({
        query: "pasta",
        labels: [],
        maxTime: null,
        minRating: null,
      }),
    ).toBe(false);
  });
});

describe("new labels", () => {
  it("get a slug from their name", () => {
    expect(slugify("Gluten-free")).toBe("gluten-free");
    expect(slugify("  Low Carb!! ")).toBe("low-carb");
    expect(slugify("Crème brûlée")).toBe("creme-brulee");
    expect(slugify("!!!")).toBe("");
  });

  it("names are single-spaced, 1 to 30 characters, with a letter or digit", () => {
    expect(labelNameSchema.parse("  Low   carb ")).toEqual({
      name: "Low carb",
      slug: "low-carb",
    });
    expect(labelNameSchema.safeParse("   ").success).toBe(false);
    expect(labelNameSchema.safeParse("a".repeat(31)).success).toBe(false);
    expect(labelNameSchema.safeParse("a".repeat(30)).success).toBe(true);
    expect(labelNameSchema.safeParse("🌶️").success).toBe(false);
  });

  it("are shown by name, skipping deleted ones", () => {
    expect(labelNames(["spicy", "gone", "vegan"], LABELS)).toEqual([
      "Spicy",
      "Vegan",
    ]);
  });
});
