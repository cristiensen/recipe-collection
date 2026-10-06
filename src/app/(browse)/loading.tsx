import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <span className="sr-only">Loading recipes…</span>
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-36 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders
          <div key={i} className="flex flex-col gap-3 rounded-xl border p-0">
            <Skeleton className="aspect-[4/3] w-full rounded-b-none" />
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
