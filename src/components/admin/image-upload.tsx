"use client";

import { cn } from "cn";
import { ArrowDownIcon, ArrowUpIcon, ImagePlusIcon, Trash2Icon, UploadIcon } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";

const ACCEPT = "image/jpeg,image/png,image/webp,image/avif";
const MAX_BYTES = 8 * 1024 * 1024;

/** Uploads to /api/admin/media (server re-encodes to WebP and strips EXIF/GPS). Returns the /media URL. */
async function upload(file: File, kind: "image" | "avatar", alt?: string): Promise<string> {
  if (file.size > MAX_BYTES) throw new Error("Image is too large (max 8 MB).");
  if (!ACCEPT.split(",").includes(file.type)) throw new Error("Use a JPG, PNG, WebP or AVIF image.");
  const form = new FormData();
  form.set("file", file);
  form.set("kind", kind);
  if (alt) form.set("alt", alt.slice(0, 140));
  const res = await fetch("/api/admin/media", { method: "POST", body: form, credentials: "same-origin", headers: { Accept: "application/json" } });
  const data = (await res.json().catch(() => null)) as { url?: string; error?: { message?: string } } | null;
  if (!res.ok || !data?.url) throw new Error(data?.error?.message ?? "Upload failed. Please try again.");
  return data.url;
}

function useUploader(kind: "image" | "avatar", alt?: string) {
  const [busy, setBusy] = useState(false);
  const run = async (file: File | undefined, onDone: (url: string) => void) => {
    if (!file) return;
    setBusy(true);
    try {
      onDone(await upload(file, kind, alt));
      toast.success("Image uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** Single image field with preview, replace and remove. */
export function ImageUpload({
  value,
  onChange,
  kind = "image",
  alt,
  aspect = "aspect-[16/9]",
  hint,
}: {
  value: string | null | undefined;
  onChange: (url: string) => void;
  kind?: "image" | "avatar";
  alt?: string;
  aspect?: string;
  hint?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const { busy, run } = useUploader(kind, alt);
  return (
    <div className="space-y-2">
      <div className={cn("relative overflow-hidden rounded-xl border bg-secondary", kind === "avatar" ? "size-24 rounded-full" : aspect)}>
        {value ? (
          <Image src={value} alt={alt ?? ""} fill sizes="400px" className="object-cover" unoptimized={value.startsWith("https://")} />
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground transition-colors hover:text-primary">
            <ImagePlusIcon className="size-6" />
            {kind !== "avatar" && <span className="text-xs font-medium">Upload image</span>}
          </button>
        )}
        {busy && (
          <span className="absolute inset-0 grid place-items-center bg-card/70 backdrop-blur-sm">
            <Spinner />
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={id} className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium transition-colors hover:bg-secondary">
          <UploadIcon className="size-3.5" /> {value ? "Replace" : "Choose file"}
        </label>
        {value && (
          <button type="button" onClick={() => onChange("")} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/8">
            <Trash2Icon className="size-3.5" /> Remove
          </button>
        )}
        <input
          id={id}
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => {
            void run(e.target.files?.[0], onChange);
            e.target.value = "";
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{hint ?? "JPG, PNG, WebP or AVIF up to 8 MB. Location data is stripped automatically."}</p>
    </div>
  );
}

/** Ordered list of images (e.g. hero slides) with add, reorder and remove. */
export function ImageListUpload({ value, onChange, max = 6, alt }: { value: string[]; onChange: (urls: string[]) => void; max?: number; alt?: string }) {
  const id = useId();
  const { busy, run } = useUploader("image", alt);
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {value.map((url, i) => (
          <li key={`${url}-${i}`} className="overflow-hidden rounded-xl border bg-card">
            <div className="relative aspect-[16/9] bg-secondary">
              <Image src={url} alt="" fill sizes="320px" className="object-cover" unoptimized={url.startsWith("https://")} />
              <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">Slide {i + 1}</span>
            </div>
            <div className="flex items-center justify-end gap-1 p-1.5">
              <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)} className="grid size-8 place-items-center rounded-full hover:bg-secondary disabled:opacity-30">
                <ArrowUpIcon className="size-4" />
              </button>
              <button type="button" aria-label="Move later" disabled={i === value.length - 1} onClick={() => move(i, 1)} className="grid size-8 place-items-center rounded-full hover:bg-secondary disabled:opacity-30">
                <ArrowDownIcon className="size-4" />
              </button>
              <button type="button" aria-label="Remove slide" onClick={() => onChange(value.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-full text-destructive hover:bg-destructive/8">
                <Trash2Icon className="size-4" />
              </button>
            </div>
          </li>
        ))}
        {value.length < max && (
          <li>
            <label htmlFor={id} className="flex aspect-[16/9] h-full min-h-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#c9c9c9] text-sm font-medium text-primary transition-colors hover:border-primary hover:bg-accent">
              {busy ? <Spinner /> : <ImagePlusIcon className="size-6" />}
              {busy ? "Uploading…" : "Add slide"}
            </label>
            <input
              id={id}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void run(e.target.files?.[0], (url) => onChange([...value, url]));
                e.target.value = "";
              }}
            />
          </li>
        )}
      </ul>
      <p className="text-xs text-muted-foreground">Up to {max} landscape photos (1920×1080 works best). Without photos, illustrated scenes are shown.</p>
    </div>
  );
}

/** One entry per line → string[] (highlights, attractions…). */
export function LinesInput({ value, onChange, max, placeholder, rows = 4 }: { value: string[]; onChange: (v: string[]) => void; max: number; placeholder?: string; rows?: number }) {
  const [text, setText] = useState(value.join("\n"));
  return (
    <textarea
      value={text}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value);
        onChange(
          e.target.value
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length >= 2)
            .slice(0, max),
        );
      }}
      className="flex w-full rounded-lg border border-transparent bg-secondary px-4 py-3 text-[15px] outline-none transition-[background-color,border-color,box-shadow] placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10"
    />
  );
}
