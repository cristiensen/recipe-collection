import type { Metadata } from "next";
import Link from "next/link";
import { RecipeForm } from "@/components/recipe-form/recipe-form";
import { Button } from "@/components/ui/button";
import { canCreateRecipe, READ_ONLY_MESSAGE } from "@/lib/privileges";
import { requireUser } from "@/lib/session";
import { storageMode } from "@/lib/storage";

export const metadata: Metadata = { title: "New recipe" };

export default async function NewRecipePage() {
  const user = await requireUser("/recipes/new");

  if (!canCreateRecipe(user)) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-xl font-semibold">
          {user.banned
            ? "Your account is read-only"
            : "Only chefs can publish recipes"}
        </h1>
        <p className="text-muted-foreground">
          {user.banned
            ? READ_ONLY_MESSAGE
            : "You can still browse, rate and review recipes. Ask an admin if you'd like chef access."}
        </p>
        <Button asChild>
          <Link href="/">Browse recipes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">
        Share a recipe
      </h1>
      <RecipeForm storage={storageMode()} />
    </div>
  );
}
