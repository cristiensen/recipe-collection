"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createRecipe, updateRecipe } from "@/app/actions/recipes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Label as RecipeLabel } from "@/generated/prisma/enums";
import { LABELS, labelCountError, labelLimit } from "@/lib/labels";
import type { StorageMode } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import {
  type FieldErrors,
  type RecipeInput,
  recipeSchema,
  toFieldErrors,
} from "@/lib/validation";
import {
  ImagePicker,
  type MediaItem,
  mediaFromUrl,
  VideoPicker,
} from "./media-picker";
import {
  FieldError,
  moveItem,
  newKey,
  RequiredMark,
  RowControls,
} from "./shared";

export type RecipeFormValues = {
  title: string;
  description: string;
  cookingMinutes: number | null;
  servings: number | null;
  labels: RecipeLabel[];
  images: string[];
  videoUrl: string | null;
  ingredients: { name: string; quantity: number | null; unit: string | null }[];
  steps: { text: string }[];
};

type IngredientRow = {
  key: string;
  name: string;
  quantity: string;
  unit: string;
};
type StepRow = { key: string; text: string };

const COMMON_UNITS = [
  "g",
  "kg",
  "ml",
  "l",
  "tsp",
  "tbsp",
  "cup",
  "oz",
  "lb",
  "pinch",
  "clove",
  "piece",
];

const emptyIngredient = (): IngredientRow => ({
  key: newKey(),
  name: "",
  quantity: "",
  unit: "",
});
const emptyStep = (): StepRow => ({ key: newKey(), text: "" });

/** "" → NaN so the schema reports "required" instead of silently using 0. */
const toNumber = (s: string) => (s.trim() === "" ? Number.NaN : Number(s));

export function RecipeForm({
  recipeId,
  initial,
  storage,
}: {
  recipeId?: string;
  initial?: RecipeFormValues;
  storage: StorageMode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<FieldErrors>({});

  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [cookingMinutes, setCookingMinutes] = useState(
    initial?.cookingMinutes?.toString() ?? "",
  );
  const [servings, setServings] = useState(initial?.servings?.toString() ?? "");
  const [labels, setLabels] = useState<RecipeLabel[]>(initial?.labels ?? []);
  const [images, setImages] = useState<MediaItem[]>(() =>
    (initial?.images ?? []).map(mediaFromUrl),
  );
  const [videos, setVideos] = useState<MediaItem[]>(() =>
    initial?.videoUrl ? [mediaFromUrl(initial.videoUrl)] : [],
  );
  const [ingredients, setIngredients] = useState<IngredientRow[]>(() =>
    initial?.ingredients.length
      ? initial.ingredients.map((i) => ({
          key: newKey(),
          name: i.name,
          quantity: i.quantity?.toString() ?? "",
          unit: i.unit ?? "",
        }))
      : [emptyIngredient()],
  );
  const [steps, setSteps] = useState<StepRow[]>(() =>
    initial?.steps.length
      ? initial.steps.map((s) => ({ key: newKey(), text: s.text }))
      : [emptyStep()],
  );

  // Recipes created before the label limit may keep the labels they had
  const maxLabels = labelLimit(initial?.labels.length);
  const atLabelLimit = labels.length >= maxLabels;

  const uploading = [...images, ...videos].some((m) => !m.url && !m.error);
  const failedUpload = [...images, ...videos].some((m) => m.error);

  function buildPayload(): RecipeInput {
    return {
      title,
      description,
      cookingMinutes: toNumber(cookingMinutes),
      servings: servings.trim() === "" ? null : toNumber(servings),
      labels,
      images: images.flatMap((m) => (m.url ? [m.url] : [])),
      videoUrl: videos[0]?.url ?? null,
      ingredients: ingredients.map((i) => ({
        name: i.name,
        quantity: i.quantity.trim() === "" ? null : toNumber(i.quantity),
        unit: i.unit,
      })),
      steps: steps.map((s) => ({ text: s.text })),
    };
  }

  function focusFirstError(errs: FieldErrors) {
    const first = Object.keys(errs)[0];
    if (!first) return;
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-field="${first.split(".")[0]}"]`,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLElement>("input, textarea, button")?.focus({
        preventScroll: true,
      });
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (uploading) {
      toast.info("Please wait for uploads to finish");
      return;
    }
    if (failedUpload) {
      setErrors({
        images:
          "Remove the files that failed to upload, or try adding them again",
      });
      focusFirstError({ images: "x" });
      return;
    }
    const payload = buildPayload();
    const parsed = recipeSchema.safeParse(payload);
    if (!parsed.success) {
      const errs = toFieldErrors(parsed.error);
      setErrors(errs);
      focusFirstError(errs);
      return;
    }
    const tooMany = labelCountError(labels.length, initial?.labels.length);
    if (tooMany) {
      setErrors({ labels: tooMany });
      focusFirstError({ labels: tooMany });
      return;
    }
    setErrors({});
    startTransition(async () => {
      // On success the action redirects to the recipe page; entered data stays
      // in this component's state if it returns errors instead.
      const result = recipeId
        ? await updateRecipe(recipeId, payload)
        : await createRecipe(payload);
      if (result && !result.ok) {
        setErrors(result.errors);
        focusFirstError(result.errors);
        if (result.errors._form) toast.error(result.errors._form);
      }
    });
  }

  const err = (key: string) => errors[key];

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <p className="-mt-4 text-sm text-muted-foreground">
        Fields marked with <span className="text-destructive">*</span> are
        required.
      </p>
      {errors._form && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {errors._form}
        </p>
      )}

      <Section title="Photos & video">
        <div data-field="images" className="flex flex-col gap-2">
          <Label asChild>
            <span>
              <span>
                Photos
                <RequiredMark />
                <span className="sr-only"> (required)</span>
              </span>
            </span>
          </Label>
          <ImagePicker
            items={images}
            setItems={setImages}
            storage={storage}
            error={
              err("images") ??
              Object.entries(errors).find(([k]) => k.startsWith("images."))?.[1]
            }
            onRejected={(m) => toast.error(m)}
            altText={title}
          />
        </div>
        <div data-field="videoUrl" className="flex flex-col gap-2">
          <Label asChild>
            <span>Video</span>
          </Label>
          <VideoPicker
            items={videos}
            setItems={setVideos}
            storage={storage}
            error={err("videoUrl")}
            onRejected={(m) => toast.error(m)}
          />
        </div>
      </Section>

      <Section title="About the dish">
        <TextField
          name="title"
          label="Title"
          required
          value={title}
          onChange={setTitle}
          error={err("title")}
          maxLength={120}
        />
        <div data-field="description" className="flex flex-col gap-1.5">
          <Label htmlFor="description">
            <span>
              Description
              <RequiredMark />
            </span>
          </Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            required
            aria-invalid={!!err("description")}
            aria-describedby="description-error"
            placeholder="What makes this dish special?"
          />
          <FieldError id="description-error" message={err("description")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="cookingMinutes"
            label="Total cooking time (minutes)"
            required
            value={cookingMinutes}
            onChange={setCookingMinutes}
            error={err("cookingMinutes")}
            inputMode="numeric"
            type="number"
            min={1}
          />
          <TextField
            name="servings"
            label="Servings (optional)"
            value={servings}
            onChange={setServings}
            error={err("servings")}
            inputMode="numeric"
            type="number"
            min={1}
          />
        </div>
      </Section>

      <Section title="Labels">
        <p id="labels-help" className="-mt-2 text-sm text-muted-foreground">
          Choose up to {maxLabels} ({labels.length} selected).
        </p>
        <fieldset
          data-field="labels"
          aria-describedby="labels-help labels-error"
          className="flex flex-wrap gap-2"
        >
          <legend className="sr-only">Labels</legend>
          {LABELS.map((l) => (
            <label
              key={l.value}
              className="cursor-pointer rounded-full border px-3 py-1 text-sm transition-colors has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50 has-disabled:cursor-not-allowed has-disabled:opacity-40"
            >
              <input
                type="checkbox"
                className="sr-only"
                // Once the limit is reached, only selected labels can change
                disabled={atLabelLimit && !labels.includes(l.value)}
                checked={labels.includes(l.value)}
                onChange={(e) =>
                  setLabels((cur) =>
                    e.target.checked
                      ? [...cur, l.value]
                      : cur.filter((v) => v !== l.value),
                  )
                }
              />
              {l.name}
            </label>
          ))}
        </fieldset>
        <FieldError id="labels-error" message={err("labels")} />
      </Section>

      <Section title="Ingredients" required>
        <div data-field="ingredients" className="flex flex-col gap-3">
          <datalist id="units">
            {COMMON_UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
          <ol className="flex flex-col gap-3">
            {ingredients.map((row, index) => {
              const update = (patch: Partial<IngredientRow>) =>
                setIngredients((all) =>
                  all.map((r) => (r.key === row.key ? { ...r, ...patch } : r)),
                );
              const nameErr = err(`ingredients.${index}.name`);
              const qtyErr = err(`ingredients.${index}.quantity`);
              const unitErr = err(`ingredients.${index}.unit`);
              return (
                <li key={row.key} className="flex flex-col gap-1">
                  <div className="flex items-start gap-2">
                    <div className="grid flex-1 grid-cols-[4.5rem_5rem_1fr] gap-2 sm:grid-cols-[6rem_7rem_1fr]">
                      <Input
                        aria-label={`Ingredient ${index + 1} quantity`}
                        placeholder="Qty"
                        inputMode="decimal"
                        value={row.quantity}
                        onChange={(e) => update({ quantity: e.target.value })}
                        aria-invalid={!!qtyErr}
                      />
                      <Input
                        aria-label={`Ingredient ${index + 1} unit`}
                        placeholder="Unit"
                        list="units"
                        value={row.unit}
                        onChange={(e) => update({ unit: e.target.value })}
                        aria-invalid={!!unitErr}
                      />
                      <Input
                        aria-label={`Ingredient ${index + 1} name`}
                        required
                        placeholder="e.g. Plain flour"
                        value={row.name}
                        onChange={(e) => update({ name: e.target.value })}
                        aria-invalid={!!nameErr}
                      />
                    </div>
                    <RowControls
                      index={index}
                      count={ingredients.length}
                      itemLabel={`ingredient ${index + 1}`}
                      onMove={(d) =>
                        setIngredients((all) => moveItem(all, index, d))
                      }
                      onRemove={() =>
                        setIngredients((all) =>
                          all.filter((r) => r.key !== row.key),
                        )
                      }
                      canRemove={ingredients.length > 1}
                    />
                  </div>
                  <FieldError
                    id={`ingredient-${index}-error`}
                    message={nameErr ?? qtyErr ?? unitErr}
                  />
                </li>
              );
            })}
          </ol>
          <FieldError id="ingredients-error" message={err("ingredients")} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setIngredients((all) => [...all, emptyIngredient()])}
          >
            <Plus aria-hidden /> Add ingredient
          </Button>
          <p className="text-xs text-muted-foreground">
            Quantity and unit are optional — leave them blank for things like
            “salt to taste”.
          </p>
        </div>
      </Section>

      <Section title="Instructions" required>
        <div data-field="steps" className="flex flex-col gap-3">
          <ol className="flex flex-col gap-3">
            {steps.map((row, index) => {
              const stepErr = err(`steps.${index}.text`);
              return (
                <li key={row.key} className="flex flex-col gap-1">
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                    >
                      {index + 1}
                    </span>
                    <Textarea
                      aria-label={`Step ${index + 1}`}
                      required
                      value={row.text}
                      rows={3}
                      onChange={(e) =>
                        setSteps((all) =>
                          all.map((r) =>
                            r.key === row.key
                              ? { ...r, text: e.target.value }
                              : r,
                          ),
                        )
                      }
                      aria-invalid={!!stepErr}
                      className="flex-1"
                    />
                    <RowControls
                      index={index}
                      count={steps.length}
                      itemLabel={`step ${index + 1}`}
                      onMove={(d) => setSteps((all) => moveItem(all, index, d))}
                      onRemove={() =>
                        setSteps((all) => all.filter((r) => r.key !== row.key))
                      }
                      canRemove={steps.length > 1}
                    />
                  </div>
                  <FieldError id={`step-${index}-error`} message={stepErr} />
                </li>
              );
            })}
          </ol>
          <FieldError id="steps-error" message={err("steps")} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setSteps((all) => [...all, emptyStep()])}
          >
            <Plus aria-hidden /> Add step
          </Button>
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        {uploading && (
          <span className="mr-auto text-sm text-muted-foreground">
            Uploading…
          </span>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending || uploading}>
          {pending ? "Saving…" : recipeId ? "Save changes" : "Publish recipe"}
        </Button>
      </div>
    </form>
  );
}

function Section({
  title,
  required = false,
  children,
}: {
  title: string;
  /** Marks the section as required (e.g. at least one ingredient). */
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b pb-2 text-lg font-semibold">
        {title}
        {required && (
          <>
            <RequiredMark />
            <span className="sr-only"> (required)</span>
          </>
        )}
      </h2>
      {children}
    </section>
  );
}

function TextField({
  name,
  label,
  value,
  onChange,
  error,
  ...inputProps
}: {
  name: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
} & Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "name">) {
  return (
    <div data-field={name} className={cn("flex flex-col gap-1.5")}>
      <Label htmlFor={name}>
        <span>
          {label}
          {inputProps.required && <RequiredMark />}
        </span>
      </Label>
      <Input
        id={name}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
        aria-describedby={`${name}-error`}
        {...inputProps}
      />
      <FieldError id={`${name}-error`} message={error} />
    </div>
  );
}
