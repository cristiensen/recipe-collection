"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";

let keyCounter = 0;
/** Stable React keys for rows that can be reordered. */
export const newKey = () => `k${++keyCounter}`;

export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * Visual "*" for required fields. Hidden from screen readers: the input's
 * `required` attribute (or the sr-only text) announces it instead.
 */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="ml-0.5 text-destructive">
      *
    </span>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-destructive">
      {message}
    </p>
  );
}

/** Up / down / remove controls for a reorderable row; keyboard-usable buttons. */
export function RowControls({
  index,
  count,
  itemLabel,
  onMove,
  onRemove,
  canRemove = true,
}: {
  index: number;
  count: number;
  itemLabel: string;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  canRemove?: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onMove(-1)}
        disabled={index === 0}
        aria-label={`Move ${itemLabel} up`}
      >
        <ArrowUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onMove(1)}
        disabled={index === count - 1}
        aria-label={`Move ${itemLabel} down`}
      >
        <ArrowDown />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label={`Remove ${itemLabel}`}
      >
        <X />
      </Button>
    </div>
  );
}
