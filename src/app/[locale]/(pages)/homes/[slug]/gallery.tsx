"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { PhotoImage } from "@/components/photo-image";
import { cn } from "@/lib/cn";

type Photo = { url: string; width: number; height: number };

type Labels = {
  gallery: string;
  previous: string;
  next: string;
  counter: string;
  showPhoto: string;
  showAll: string;
  close: string;
};

/**
 * The main photo keeps close to its own shape: anything between 4:3 and 16:9 is shown whole, and
 * only unusually tall or panoramic shots are trimmed (from the centre).
 */
function mainRatio(photo: Photo) {
  const ratio = photo.width && photo.height ? photo.width / photo.height : 3 / 2;
  return Math.min(16 / 9, Math.max(4 / 3, ratio));
}

const THUMBS = 4;

/**
 * Listing photos the way property portals show them: the cover large with a row of the next ones
 * under it on wider screens, a swipeable carousel on phones, and every photo in a lightbox.
 */
export function Gallery({
  photos,
  title,
  labels,
}: {
  photos: Photo[];
  title: string;
  labels: Labels;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const count = photos.length;
  const cover = photos[0]!;
  const thumbs = photos.slice(1, 1 + THUMBS);
  const hidden = count - 1 - thumbs.length;

  function open(at: number) {
    setIndex(at);
    dialog.current?.showModal();
  }

  const showAll = labels.showAll.replace("{n}", String(count));

  return (
    <section aria-label={labels.gallery}>
      {/* Phones: one photo at a time. */}
      <div className="sm:hidden">
        <Carousel
          photos={photos}
          title={title}
          labels={labels}
          index={index}
          onIndex={setIndex}
          className="aspect-[4/3] rounded-md"
          sizes="100vw"
          priority
          onOpen={() => open(index)}
        />
      </div>

      {/* Wider screens: the cover, then a row of the next photos. */}
      <div className="hidden flex-col gap-2 sm:flex">
        <div
          className="relative overflow-hidden rounded-md"
          style={{ aspectRatio: mainRatio(cover) }}
        >
          <button
            type="button"
            onClick={() => open(0)}
            aria-label={labels.showPhoto.replace("{n}", "1")}
            className="group bg-canvas absolute inset-0"
          >
            <PhotoImage
              src={cover.url}
              alt={title}
              fill
              priority
              sizes="(min-width: 1280px) 780px, (min-width: 1024px) 60vw, 100vw"
              className="object-cover transition duration-300 group-hover:brightness-95"
            />
          </button>
          {count > 1 ? (
            <button
              type="button"
              onClick={() => open(0)}
              className="bg-surface/95 text-ink hover:bg-surface absolute right-3 bottom-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium shadow-sm"
            >
              <GridIcon />
              {showAll}
            </button>
          ) : null}
        </div>
        {thumbs.length > 0 ? (
          <ul className="grid grid-cols-4 gap-2">
            {thumbs.map((photo, i) => {
              const last = i === thumbs.length - 1 && hidden > 0;
              return (
                <li key={photo.url}>
                  <button
                    type="button"
                    onClick={() => open(i + 1)}
                    aria-label={last ? showAll : labels.showPhoto.replace("{n}", String(i + 2))}
                    className="group bg-canvas relative block aspect-[4/3] w-full overflow-hidden rounded-md"
                  >
                    <PhotoImage
                      src={photo.url}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 190px, 25vw"
                      className="object-cover transition duration-300 group-hover:brightness-90"
                    />
                    {last ? (
                      <span className="bg-ink/55 absolute inset-0 grid place-items-center text-lg font-medium text-white">
                        +{hidden}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <dialog
        ref={dialog}
        aria-label={labels.gallery}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close();
        }}
        className="bg-ink m-0 h-dvh max-h-none w-screen max-w-none p-0 text-white backdrop:bg-black/60"
      >
        <div className="mx-auto flex h-full max-w-6xl flex-col gap-3 px-3 py-3 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <p className="truncate text-sm opacity-80">{title}</p>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-white/10"
            >
              <svg
                aria-hidden
                viewBox="0 0 20 20"
                className="size-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              >
                <path d="M5 5l10 10M15 5 5 15" />
              </svg>
              <span className="sr-only">{labels.close}</span>
            </button>
          </div>
          <Carousel
            photos={photos}
            title={title}
            labels={labels}
            index={index}
            onIndex={setIndex}
            className="min-h-0 flex-1"
            sizes="(min-width: 1152px) 1104px, 100vw"
            contain
          />
          {count > 1 ? (
            <ul className="flex shrink-0 gap-2 overflow-x-auto pb-1">
              {photos.map((photo, i) => (
                <li key={photo.url} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={labels.showPhoto.replace("{n}", String(i + 1))}
                    aria-current={i === index ? "true" : undefined}
                    className={cn(
                      "relative block h-14 w-20 overflow-hidden rounded border-2 transition-opacity",
                      i === index
                        ? "border-white"
                        : "border-transparent opacity-60 hover:opacity-100",
                    )}
                  >
                    <PhotoImage src={photo.url} alt="" fill sizes="80px" className="object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </dialog>
    </section>
  );
}

/** One photo with previous / next buttons and a counter; arrow keys work when it has focus. */
function Carousel({
  photos,
  title,
  labels,
  index,
  onIndex,
  className,
  sizes,
  priority = false,
  contain = false,
  onOpen,
}: {
  photos: Photo[];
  title: string;
  labels: Labels;
  index: number;
  onIndex: (index: number) => void;
  className?: string;
  sizes: string;
  priority?: boolean;
  contain?: boolean;
  onOpen?: () => void;
}) {
  const count = photos.length;
  const go = (next: number) => onIndex((next + count) % count);
  const current = photos[index] ?? photos[0]!;
  const counter = labels.counter
    .replace("{current}", String(index + 1))
    .replace("{total}", String(count));

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "ArrowRight") go(index + 1);
    if (event.key === "ArrowLeft") go(index - 1);
  }

  return (
    <div className={cn("relative overflow-hidden", className)} onKeyDown={onKeyDown}>
      <PhotoImage
        key={current.url}
        src={current.url}
        alt={`${title}. ${counter}`}
        fill
        priority={priority && index === 0}
        sizes={sizes}
        className={contain ? "object-contain" : "bg-canvas object-cover"}
      />
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="absolute inset-0"
          aria-label={labels.showAll.replace("{n}", String(count))}
        />
      ) : null}
      {count > 1 ? (
        <>
          <ArrowButton side="left" label={labels.previous} onClick={() => go(index - 1)} />
          <ArrowButton side="right" label={labels.next} onClick={() => go(index + 1)} />
          <p
            aria-live="polite"
            className="bg-ink/75 absolute right-3 bottom-3 rounded px-2 py-0.5 text-xs text-white tabular-nums"
          >
            {counter}
          </p>
        </>
      ) : null}
    </div>
  );
}

function ArrowButton({
  side,
  label,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "bg-surface/90 text-ink hover:bg-surface absolute top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-lg shadow-sm",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <span aria-hidden>{side === "left" ? "‹" : "›"}</span>
    </button>
  );
}

function GridIcon() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="currentColor">
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" />
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" />
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" />
    </svg>
  );
}
