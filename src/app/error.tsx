"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-16 text-center"
      role="alert"
    >
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">
        We couldn&apos;t load this page. Please try again in a moment.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
