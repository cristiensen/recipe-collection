"use client";

import { ChefHat, ChevronDown, CircleCheck } from "lucide-react";
import { Accordion } from "radix-ui";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type ChecklistIngredient = {
  id: string;
  /** Quantity and unit, ready to show ("200 g"); null when there's neither. */
  amount: string | null;
  name: string;
};

// While cooking a recipe, this device keeps `{ checked: [ingredient ids] }`
// under its key; no key means not cooking. It's per device, not per account.
const storageKey = (recipeId: string) => `cooking:${recipeId}`;

/** Fired in this tab on every write ("storage" only fires in other tabs). */
const CHANGE_EVENT = "cooking-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null; // storage blocked (e.g. some private windows)
  }
}

function write(key: string, checked: string[] | null) {
  try {
    if (checked) {
      window.localStorage.setItem(key, JSON.stringify({ checked }));
    } else {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Without storage the checklist still can't persist; nothing to do
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The ticked ids, or null when not cooking (or the saved value is broken). */
function parse(raw: string | null): Set<string> | null {
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    const checked = (value as { checked?: unknown })?.checked;
    return new Set(
      Array.isArray(checked)
        ? checked.filter((id): id is string => typeof id === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

/** The accordion's one item. */
const ITEM = "ingredients";

/**
 * A recipe's ingredient list, in an accordion that starts open. Logged-in
 * viewers can "Start cooking" to turn it into a checklist of what they have
 * (the rest is what to buy), saved on this device until they "Finish cooking".
 */
export function IngredientChecklist({
  recipeId,
  ingredients,
  canCook,
}: {
  recipeId: string;
  ingredients: ChecklistIngredient[];
  /** Only logged-in users get the checklist. */
  canCook: boolean;
}) {
  const key = storageKey(recipeId);
  const [open, setOpen] = useState(true);
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null, // the server render (and first paint) is the plain list
  );
  const checked = canCook ? parse(raw) : null;
  const cooking = checked !== null;

  // Saved ticks for ingredients that were since edited away don't count
  const have = ingredients.filter((i) => checked?.has(i.id)).length;
  const toBuy = ingredients.length - have;

  function toggle(id: string, on: boolean) {
    const next = new Set(checked);
    if (on) next.add(id);
    else next.delete(id);
    write(key, [...next]);
  }

  function startCooking() {
    write(key, []);
    setOpen(true); // the checklist is what they asked for, so show it
  }

  return (
    <Accordion.Root
      type="single"
      collapsible
      value={open ? ITEM : ""}
      onValueChange={(value) => setOpen(value === ITEM)}
    >
      <Accordion.Item value={ITEM}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
          <Accordion.Header asChild>
            <h2 className="text-xl font-semibold">
              <Accordion.Trigger className="group flex items-center gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                Ingredients
                <span className="text-sm font-normal text-muted-foreground tabular-nums">
                  {ingredients.length}
                </span>
                <ChevronDown
                  aria-hidden
                  className="size-5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
                />
              </Accordion.Trigger>
            </h2>
          </Accordion.Header>
          {/* Beside the trigger, not in it: a button can't contain a button */}
          {canCook &&
            (cooking ? (
              <Button size="sm" onClick={() => write(key, null)}>
                <CircleCheck aria-hidden /> Finish cooking
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={startCooking}>
                <ChefHat aria-hidden /> Start cooking
              </Button>
            ))}
        </div>

        <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="pt-3">
            {cooking && (
              <p
                className="mb-2 text-sm text-muted-foreground"
                aria-live="polite"
                data-testid="cooking-progress"
              >
                {toBuy === 0
                  ? "You have everything. Happy cooking!"
                  : `Tick what you already have. ${have} of ${ingredients.length} ready, ${toBuy} to buy.`}
              </p>
            )}

            <ul className="flex flex-col divide-y">
              {ingredients.map((i) => {
                const text = (
                  <>
                    {i.amount && (
                      <span className="shrink-0 font-medium tabular-nums">
                        {i.amount}
                      </span>
                    )}
                    <span>{i.name}</span>
                  </>
                );
                if (!cooking) {
                  return (
                    <li key={i.id} className="flex gap-2 py-2">
                      {text}
                    </li>
                  );
                }
                const id = `ingredient-${i.id}`;
                const on = checked.has(i.id);
                return (
                  <li key={i.id} className="flex items-start gap-3 py-2">
                    <Checkbox
                      id={id}
                      checked={on}
                      onCheckedChange={(value) => toggle(i.id, value === true)}
                      className="mt-1"
                    />
                    <label
                      htmlFor={id}
                      className={cn(
                        "flex flex-1 cursor-pointer gap-2",
                        on && "text-muted-foreground line-through",
                      )}
                    >
                      {text}
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}
