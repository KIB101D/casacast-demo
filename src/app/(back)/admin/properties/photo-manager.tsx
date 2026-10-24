"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { PhotoImage } from "@/components/photo-image";
import { Button } from "@/components/ui/button";
import { useAdminI18n } from "@/i18n/admin/client";
import { cn } from "@/lib/cn";
import { compressImage, PhotoPrepareError, UnreadableImageError } from "@/lib/photos/compress";
import { moveItem } from "@/lib/photos/order";
import type { PhotoView } from "@/lib/photos/queries";
import {
  deletePhoto,
  reorderPhotos,
  setCoverPhoto,
  uploadPhoto,
  type PhotoActionResult,
} from "./photo-actions";

type PendingUpload = {
  key: string;
  name: string;
  previewUrl: string;
  status: "preparing" | "uploading";
};

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

export function PhotoManager({
  propertyId,
  initialPhotos,
  maxPhotos,
  editable,
}: {
  propertyId: string;
  initialPhotos: PhotoView[];
  maxPhotos: number;
  editable: boolean;
}) {
  const { t } = useAdminI18n();
  const [photos, setPhotos] = useState(initialPhotos);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queueRef = useRef(Promise.resolve());

  // Preview object URLs still alive; revoked when their upload ends or the component unmounts.
  const previewUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = previewUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const slotsLeft = maxPhotos - photos.length - pending.length;
  const busy = pending.length > 0 || busyId !== null;

  function apply(result: PhotoActionResult) {
    if (result.photos) setPhotos(result.photos);
    if (!result.ok) setErrors((e) => [...e, result.error]);
    return result.ok;
  }

  function createPreview(file: File) {
    const url = URL.createObjectURL(file);
    previewUrls.current.add(url);
    return url;
  }

  function addFiles(fileList: FileList | File[]) {
    setErrors([]);
    const files = Array.from(fileList);
    const accepted = files.slice(0, Math.max(0, slotsLeft));
    if (files.length > accepted.length) {
      setErrors([t.photos.skipped(maxPhotos, files.length - accepted.length)]);
    }

    const items: PendingUpload[] = accepted.map((file) => ({
      key: crypto.randomUUID(),
      name: file.name,
      previewUrl: createPreview(file),
      status: "preparing",
    }));
    setPending((p) => [...p, ...items]);

    // Upload one at a time, in the order the files were picked.
    accepted.forEach((file, i) => {
      const item = items[i]!;
      queueRef.current = queueRef.current.then(() => uploadOne(file, item));
    });
  }

  async function uploadOne(file: File, item: PendingUpload) {
    try {
      const blob = await compressImage(file);
      setPending((p) => p.map((x) => (x.key === item.key ? { ...x, status: "uploading" } : x)));

      const formData = new FormData();
      const extension = blob.type === "image/webp" ? "webp" : "jpg";
      formData.set("file", new File([blob], `photo.${extension}`, { type: blob.type }));
      const result = await uploadPhoto(propertyId, formData);
      if (!result.ok) setErrors((e) => [...e, `${item.name}: ${result.error}`]);
      if (result.photos) setPhotos(result.photos);
    } catch (error) {
      const message =
        error instanceof UnreadableImageError
          ? t.photos.unreadable
          : error instanceof PhotoPrepareError
            ? t.photos.browserFailed
            : t.common.somethingWrong;
      setErrors((e) => [...e, `${item.name}: ${message}`]);
    } finally {
      URL.revokeObjectURL(item.previewUrl);
      previewUrls.current.delete(item.previewUrl);
      setPending((p) => p.filter((x) => x.key !== item.key));
    }
  }

  async function run(photoId: string, action: () => Promise<PhotoActionResult>) {
    setErrors([]);
    setBusyId(photoId);
    try {
      apply(await action());
    } catch {
      setErrors([t.common.somethingWrong]);
    } finally {
      setBusyId(null);
    }
  }

  async function reorder(from: number, to: number) {
    const before = photos;
    const next = moveItem(photos, from, to);
    if (next === before || from === to) return;
    setPhotos(next); // optimistic
    setErrors([]);
    try {
      const result = await reorderPhotos(
        propertyId,
        next.map((p) => p.id),
      );
      if (!apply(result) && !result.photos) setPhotos(before);
    } catch {
      setPhotos(before);
      setErrors([t.photos.orderFailed]);
    }
  }

  function onTileDrop(event: DragEvent, index: number) {
    event.preventDefault();
    if (dragFrom !== null) void reorder(dragFrom, index);
    setDragFrom(null);
    setDragOver(null);
  }

  return (
    <section
      aria-labelledby="photos-heading"
      className="border-line bg-surface mb-6 flex max-w-3xl flex-col gap-4 rounded-xl border p-5"
    >
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="photos-heading" className="text-base font-semibold">
          {t.photos.heading}
        </h2>
        <p className="text-muted text-sm tabular-nums">
          {photos.length} / {maxPhotos}
        </p>
      </div>

      {errors.length > 0 ? (
        <div role="alert" className="bg-danger-soft text-danger rounded-lg px-4 py-3 text-sm">
          {errors.map((error, i) => (
            <p key={i}>{error}</p>
          ))}
        </div>
      ) : null}

      {photos.length === 0 && pending.length === 0 && !editable ? (
        <p className="text-muted text-sm">{t.photos.none}</p>
      ) : null}

      {photos.length > 0 || pending.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label={t.photos.list}>
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              draggable={editable && !busy}
              onDragStart={(e) => {
                setDragFrom(index);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return;
                e.preventDefault();
                setDragOver(index);
              }}
              onDragLeave={() => setDragOver((o) => (o === index ? null : o))}
              onDrop={(e) => onTileDrop(e, index)}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              className={cn(
                "group border-line relative overflow-hidden rounded-lg border",
                editable && !busy && "cursor-grab active:cursor-grabbing",
                dragFrom === index && "opacity-40",
                dragOver === index && dragFrom !== index && "ring-accent ring-2",
                busyId === photo.id && "opacity-60",
              )}
            >
              <div className="bg-canvas relative aspect-[4/3]">
                <PhotoImage
                  src={photo.url}
                  alt={t.photos.alt(index + 1, photo.isCover)}
                  fill
                  sizes="(min-width: 640px) 240px, 50vw"
                  className="object-cover"
                  draggable={false}
                />
              </div>
              {photo.isCover ? (
                <span className="bg-accent absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium text-white">
                  {t.photos.cover}
                </span>
              ) : null}

              {editable ? (
                <div className="flex flex-wrap items-center gap-1 p-1.5">
                  <IconButton
                    label={t.photos.moveEarlier(index + 1)}
                    disabled={busy || index === 0}
                    onClick={() => void reorder(index, index - 1)}
                  >
                    ←
                  </IconButton>
                  <IconButton
                    label={t.photos.moveLater(index + 1)}
                    disabled={busy || index === photos.length - 1}
                    onClick={() => void reorder(index, index + 1)}
                  >
                    →
                  </IconButton>
                  {!photo.isCover ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(photo.id, () => setCoverPhoto(propertyId, photo.id))}
                      className="text-muted hover:text-ink rounded px-2 py-1 text-xs disabled:opacity-50"
                    >
                      {t.photos.makeCover}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy}
                    aria-label={t.photos.deleteLabel(index + 1)}
                    onClick={() => {
                      if (window.confirm(t.photos.confirmDelete)) {
                        void run(photo.id, () => deletePhoto(propertyId, photo.id));
                      }
                    }}
                    className="text-danger hover:bg-danger-soft ml-auto rounded px-2 py-1 text-xs disabled:opacity-50"
                  >
                    {t.common.delete}
                  </button>
                </div>
              ) : null}
            </li>
          ))}

          {pending.map((item) => (
            <li key={item.key} className="border-line relative overflow-hidden rounded-lg border">
              <div className="bg-canvas relative aspect-[4/3]">
                {/* A local blob preview: next/image can't optimise object URLs. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-50"
                />
                <span className="text-ink absolute inset-0 flex items-center justify-center text-sm font-medium">
                  {item.status === "preparing" ? t.photos.preparing : t.photos.uploading}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {editable ? (
        <div
          onDragOver={(e) => {
            if (dragFrom !== null || !e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDropActive(true);
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={(e) => {
            if (dragFrom !== null) return;
            e.preventDefault();
            setDropActive(false);
            if (slotsLeft > 0) addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors",
            dropActive ? "border-accent bg-accent-soft" : "border-line",
          )}
        >
          {slotsLeft > 0 ? (
            <>
              <p className="text-sm">{t.photos.dragHere}</p>
              <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()}>
                {t.photos.choose}
              </Button>
              <p className="text-muted text-xs">{t.photos.hint}</p>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                multiple
                hidden
                aria-label={t.photos.choose}
                onChange={(e) => {
                  if (e.target.files) addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </>
          ) : (
            <p className="text-muted text-sm">{t.photos.full(maxPhotos)}</p>
          )}
        </div>
      ) : null}
    </section>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="text-muted hover:bg-canvas hover:text-ink size-7 rounded text-sm disabled:opacity-30"
    >
      {children}
    </button>
  );
}
