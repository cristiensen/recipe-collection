"use client";

import { useEffect } from "react";

/** Recipes already reported since the page loaded (also covers the double
 * effect run in development). */
const reported = new Set<string>();

/** Tells the server this recipe was opened in a browser; renders nothing. */
export function ViewBeacon({ recipeId }: { recipeId: string }) {
  useEffect(() => {
    if (reported.has(recipeId)) return;
    reported.add(recipeId);
    // keepalive: still sent if the visitor leaves straight away
    fetch(`/api/recipes/${recipeId}/view`, {
      method: "POST",
      keepalive: true,
    }).catch(() => {}); // a missed view isn't worth an error
  }, [recipeId]);
  return null;
}
