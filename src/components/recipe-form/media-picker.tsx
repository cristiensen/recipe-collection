"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  Video,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  checkMediaFile,
  IMAGE_TYPES,
  MAX_IMAGES,
  type MediaKind,
  VIDEO_TYPES,
} from "@/lib/media";
import { type StorageMode, uploadMedia } from "@/lib/upload-client";
import { cn } from "@/lib/utils";
import { FieldError, moveItem, newKey } from "./shared";

export type MediaItem = {
  key: string;
  /** Final storage URL once uploaded. */
  url: string | null;
  /** What to show while uploading (an object URL) or after (the storage URL). */
  preview: string;
  progress: number;
  error: string | null;
};

export const mediaFromUrl = (url: string): MediaItem => ({
  key: newKey(),
  url,
  preview: url,
  progress: 100,
  error: null,
});

type Setter = (update: (items: MediaItem[]) => MediaItem[]) => void;

/** Shared upload flow: validate, show a local preview immediately, track progress. */
function startUploads(
  files: File[],
  kind: MediaKind,
  storage: StorageMode,
  setItems: Setter,
  onRejected: (message: string) => void,
) {
  for (const file of files) {
    const problem = checkMediaFile(file, kind);
    if (problem) {
      onRejected(`${file.name}: ${problem}`);
      continue;
    }
    const item: MediaItem = {
      key: newKey(),
      url: null,
      preview: URL.createObjectURL(file),
      progress: 0,
      error: null,
    };
    setItems((items) => [...items, item]);
    const patch = (p: Partial<MediaItem>) =>
      setItems((items) =>
        items.map((i) => (i.key === item.key ? { ...i, ...p } : i)),
      );
    uploadMedia(file, kind, storage, (progress) => patch({ progress }))
      .then((url) => patch({ url, progress: 100 }))
      .catch((e: unknown) =>
        patch({ error: e instanceof Error ? e.message : "Upload failed" }),
      );
  }
}

/** True when a drag carries files (not text or links). */
function isFileDrag(e: { dataTransfer: DataTransfer | null }) {
  return !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
}

function UploadOverlay({ item }: { item: MediaItem }) {
  if (item.error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/85 p-2 text-center text-xs text-destructive">
        <AlertCircle aria-hidden className="size-5" />
        {item.error}
      </div>
    );
  }
  if (item.url) return null;
  return (
    <div className="absolute inset-x-2 bottom-2">
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuenow={item.progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 overflow-hidden rounded-full bg-background/80"
      >
        <div
          className="h-full bg-primary transition-[width]"
          style={{ width: `${item.progress}%` }}
        />
      </div>
    </div>
  );
}

export function ImagePicker({
  items,
  setItems,
  storage,
  error,
  onRejected,
  altText,
}: {
  items: MediaItem[];
  setItems: Setter;
  storage: StorageMode;
  error?: string;
  onRejected: (message: string) => void;
  altText: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLButtonElement>(null);
  const [dragging, setDragging] = useState(false);
  const id = useId();
  const remaining = MAX_IMAGES - items.length;

  function addFiles(files: File[]) {
    if (files.length > remaining) {
      onRejected(`You can add up to ${MAX_IMAGES} photos`);
    }
    startUploads(
      files.slice(0, remaining),
      "image",
      storage,
      setItems,
      onRejected,
    );
  }

  // Dropping a file anywhere else on the page must do nothing — by default the
  // browser would navigate away to open it. Only file drags are affected, so
  // dragging text into inputs keeps working.
  useEffect(() => {
    const outsideDropZone = (e: DragEvent) =>
      isFileDrag(e) &&
      !(e.target instanceof Node && dropZoneRef.current?.contains(e.target));
    const block = (e: DragEvent) => {
      if (!outsideDropZone(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "none";
    };
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);

  return (
    <div className="flex flex-col gap-2">
      {/* Doubled column count: photos span 2 columns, the drop zone spans 3,
          so the drop zone is 1.5x a photo at every breakpoint. */}
      <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-10">
        {items.map((item, index) => (
          <li
            key={item.key}
            className="relative col-span-2 aspect-square self-start overflow-hidden rounded-lg border bg-muted"
          >
            <Image
              src={item.preview}
              alt={`${altText || "Recipe"} photo ${index + 1}`}
              fill
              unoptimized
              sizes="200px"
              className="object-cover"
            />
            {index === 0 && (
              <span className="absolute top-1.5 left-1.5 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">
                Cover
              </span>
            )}
            <div className="absolute top-1 right-1 flex gap-0.5 rounded-md bg-background/90 p-0.5">
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                disabled={index === 0}
                onClick={() => setItems((all) => moveItem(all, index, -1))}
                aria-label={`Move photo ${index + 1} earlier`}
              >
                <ArrowLeft />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                disabled={index === items.length - 1}
                onClick={() => setItems((all) => moveItem(all, index, 1))}
                aria-label={`Move photo ${index + 1} later`}
              >
                <ArrowRight />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                onClick={() =>
                  setItems((all) => all.filter((i) => i.key !== item.key))
                }
                aria-label={`Remove photo ${index + 1}`}
              >
                <X />
              </Button>
            </div>
            <UploadOverlay item={item} />
          </li>
        ))}
        {remaining > 0 && (
          <li className="col-span-3 self-start">
            <button
              ref={dropZoneRef}
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragEnter={(e) => {
                if (isFileDrag(e)) setDragging(true);
              }}
              onDragOver={(e) => {
                if (!isFileDrag(e)) return;
                e.preventDefault(); // allows the drop
                e.dataTransfer.dropEffect = "copy";
              }}
              onDragLeave={(e) => {
                // Ignore leaving into the icon/text inside the button
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setDragging(false);
                }
              }}
              onDrop={(e) => {
                if (!isFileDrag(e)) return;
                e.preventDefault();
                setDragging(false);
                addFiles(Array.from(e.dataTransfer.files));
              }}
              aria-describedby={`${id}-help ${id}-error`}
              data-testid="image-drop-zone"
              data-dragging={dragging || undefined}
              className={cn(
                "flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-2 text-center text-sm text-muted-foreground transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                error && "border-destructive",
                dragging && "border-primary bg-primary/10 text-primary",
              )}
            >
              <ImagePlus aria-hidden className="size-6" />
              {dragging ? "Drop to add" : "Add photos"}
              {!dragging && (
                <span className="text-xs text-muted-foreground/80">
                  or drag them here
                </span>
              )}
            </button>
          </li>
        )}
      </ul>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        multiple
        hidden
        data-testid="image-input"
        onChange={(e) => {
          addFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        Up to {MAX_IMAGES} photos (JPG, PNG or WebP, max 5 MB each). The first
        photo is the cover.
      </p>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

/** Holds at most one video; stored as a list so uploads share the image flow. */
export function VideoPicker({
  items,
  setItems,
  storage,
  error,
  onRejected,
}: {
  items: MediaItem[];
  setItems: Setter;
  storage: StorageMode;
  error?: string;
  onRejected: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const item = items[0];

  return (
    <div className="flex flex-col gap-2">
      {item ? (
        <div className="relative w-full max-w-md overflow-hidden rounded-lg border bg-black">
          {/* biome-ignore lint/a11y/useMediaCaption: user-uploaded cooking videos have no captions */}
          <video src={item.preview} controls className="aspect-video w-full" />
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            className="absolute top-2 right-2"
            onClick={() => setItems(() => [])}
            aria-label="Remove video"
          >
            <X />
          </Button>
          <UploadOverlay item={item} />
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          onClick={() => inputRef.current?.click()}
          aria-describedby={`${id}-help ${id}-error`}
        >
          <Video aria-hidden />
          Add a video
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_TYPES.join(",")}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []).slice(0, 1);
          startUploads(files, "video", storage, setItems, onRejected);
          e.target.value = "";
        }}
      />
      <p id={`${id}-help`} className="text-xs text-muted-foreground">
        Optional. MP4 or WebM, max 100 MB.
      </p>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
