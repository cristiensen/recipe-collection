"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Photo = { id: string; url: string; alt: string };

/** Minimum horizontal swipe (px) that counts as "next/previous" on touch screens. */
const SWIPE_THRESHOLD = 50;

/**
 * Recipe photos. "cover" shows the first photo large with the rest as tiles;
 * "tiles" shows every photo the same size. Clicking any photo opens a
 * full-screen viewer with previous/next navigation.
 */
export function PhotoGallery({
  photos,
  title,
  layout,
}: {
  photos: Photo[];
  title: string;
  layout: "cover" | "tiles";
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  // The photo that opened the viewer gets focus back when it closes
  const openerRef = useRef<HTMLButtonElement | null>(null);

  if (photos.length === 0) return null;
  const [cover, ...rest] = photos;
  const tiles = layout === "cover" ? rest : photos;
  const offset = layout === "cover" ? 1 : 0;

  function show(i: number, opener: HTMLButtonElement) {
    openerRef.current = opener;
    setIndex(i);
    setOpen(true);
  }

  const thumbButton =
    "group relative block w-full cursor-zoom-in overflow-hidden bg-muted focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none";
  const thumbImage =
    "object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none";

  return (
    <>
      {layout === "cover" && (
        <button
          type="button"
          onClick={(e) => show(0, e.currentTarget)}
          aria-label={`Enlarge photo 1 of ${photos.length}`}
          className={cn(thumbButton, "aspect-16/10 rounded-xl")}
        >
          <Image
            src={cover.url}
            alt={cover.alt}
            fill
            priority
            sizes="(min-width: 896px) 896px, 100vw"
            className={thumbImage}
          />
        </button>
      )}
      {tiles.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((photo, i) => (
            <li key={photo.id}>
              <button
                type="button"
                onClick={(e) => show(i + offset, e.currentTarget)}
                aria-label={`Enlarge photo ${i + offset + 1} of ${photos.length}`}
                className={cn(thumbButton, "aspect-square rounded-lg")}
              >
                <Image
                  src={photo.url}
                  alt={photo.alt}
                  fill
                  sizes="(min-width: 640px) 25vw, 50vw"
                  className={thumbImage}
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Lightbox
        photos={photos}
        title={title}
        open={open}
        onOpenChange={setOpen}
        index={index}
        onIndexChange={setIndex}
        onClosed={() => openerRef.current?.focus()}
      />
    </>
  );
}

function Lightbox({
  photos,
  title,
  open,
  onOpenChange,
  index,
  onIndexChange,
  onClosed,
}: {
  photos: Photo[];
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  index: number;
  onIndexChange: (index: number) => void;
  onClosed: () => void;
}) {
  const swipeStart = useRef<number | null>(null);
  const last = photos.length - 1;
  const hasPrev = index > 0;
  const hasNext = index < last;
  const go = (i: number) => onIndexChange(Math.min(last, Math.max(0, i)));

  const navButton =
    "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-0";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 flex flex-col text-white outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onClosed();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") go(index - 1);
            else if (e.key === "ArrowRight") go(index + 1);
            else if (e.key === "Home") go(0);
            else if (e.key === "End") go(last);
            else return;
            e.preventDefault();
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            {title} — photos
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Use the left and right arrow keys to move between photos.
          </DialogPrimitive.Description>

          <div className="flex items-center justify-between px-4 py-3">
            <p
              className="text-sm tabular-nums text-white/80"
              aria-live="polite"
            >
              Photo {index + 1} of {photos.length}
            </p>
            <DialogPrimitive.Close
              className="flex size-10 items-center justify-center rounded-full text-white transition hover:bg-white/10 focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none"
              aria-label="Close"
            >
              <X aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <div
            className="relative flex-1 touch-pan-y overflow-hidden"
            onPointerDown={(e) => {
              // Presses on the previous/next buttons are clicks, not swipes
              if ((e.target as Element).closest("button")) return;
              swipeStart.current = e.clientX;
              // Keep receiving the gesture even if it ends outside this area
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerCancel={() => {
              swipeStart.current = null;
            }}
            onPointerUp={(e) => {
              if (swipeStart.current === null) return;
              const dx = e.clientX - swipeStart.current;
              swipeStart.current = null;
              if (dx > SWIPE_THRESHOLD) go(index - 1);
              else if (dx < -SWIPE_THRESHOLD) go(index + 1);
            }}
          >
            {/* All photos sit side by side; moving the track slides between them. */}
            <div
              data-testid="lightbox-track"
              className="flex h-full transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: `translateX(-${index * 100}%)` }}
            >
              {photos.map((photo, i) => (
                <div
                  key={photo.id}
                  className="relative h-full w-full shrink-0"
                  aria-hidden={i !== index}
                >
                  <Image
                    src={photo.url}
                    alt={photo.alt}
                    fill
                    // Load every photo up front so sliding never shows a blank frame
                    loading="eager"
                    sizes="100vw"
                    className="object-contain p-4 sm:p-10"
                    draggable={false}
                  />
                </div>
              ))}
            </div>

            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(index - 1)}
                  disabled={!hasPrev}
                  aria-label="Previous photo"
                  className={cn(navButton, "left-3 sm:left-6")}
                >
                  <ChevronLeft aria-hidden className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(index + 1)}
                  disabled={!hasNext}
                  aria-label="Next photo"
                  className={cn(navButton, "right-3 sm:right-6")}
                >
                  <ChevronRight aria-hidden className="size-6" />
                </button>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
