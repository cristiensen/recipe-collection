import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-5xl font-bold text-muted-foreground">404</p>
      <h1 className="text-xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="max-w-md text-muted-foreground">
        The recipe may have been deleted, or the link might be wrong.
      </p>
      <Button asChild>
        <Link href="/">Browse recipes</Link>
      </Button>
    </div>
  );
}
