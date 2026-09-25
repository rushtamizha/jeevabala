"use client";

import { cn } from "cn";
import { BookmarkIcon, LoaderCircleIcon, LocateFixedIcon, MapPinIcon, SearchIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import type { SignedPlace } from "@/lib/types";

type Suggestion = { place?: SignedPlace; placeId?: string; label: string; secondary?: string; kind?: string };
export type SavedPlaceOption = { id: string; label: string; place: SignedPlace };

function sessionToken() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random()).slice(2);
}

/**
 * Accessible address autocomplete (WAI-ARIA combobox). Results come from our own
 * server proxy, which signs coordinates so fares can't be tampered with.
 */
export function LocationInput({
  label,
  placeholder,
  value,
  onChange,
  tone = "pickup",
  allowLocate,
  savedPlaces = [],
  invalid,
  autoFocus,
}: {
  label: string;
  placeholder: string;
  value: SignedPlace | null;
  onChange: (p: SignedPlace | null) => void;
  tone?: "pickup" | "drop";
  allowLocate?: boolean;
  savedPlaces?: SavedPlaceOption[];
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const token = useRef(sessionToken());
  const abort = useRef<AbortController | null>(null);

  // Keep the text in sync when the selected place changes from outside (swap, saved place…).
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setQuery(value?.label ?? "");
  }

  const search = useCallback(async (q: string) => {
    abort.current?.abort();
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ q: q.trim(), session: token.current });
      const data = await api<{ results: Suggestion[]; degraded?: boolean }>(`/api/geo/search?${params}`, { signal: ctrl.signal });
      setResults(data.results);
      setActive(data.results.length ? 0 : -1);
      if (data.degraded) setError("Address search is slow right now — try a nearby landmark.");
    } catch (err) {
      if ((err as Error).name !== "AbortError") setError(errorMessage(err));
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (value && query === value.label) return;
    const t = setTimeout(() => search(query), 260);
    return () => clearTimeout(t);
  }, [query, open, search, value]);

  const pick = useCallback(
    async (s: Suggestion) => {
      setOpen(false);
      if (s.place) {
        onChange(s.place);
        token.current = sessionToken();
        return;
      }
      if (s.placeId) {
        setLoading(true);
        try {
          const params = new URLSearchParams({ id: s.placeId, session: token.current });
          const data = await api<{ place: SignedPlace }>(`/api/geo/place?${params}`);
          onChange(data.place);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setLoading(false);
          token.current = sessionToken();
        }
      }
    },
    [onChange],
  );

  const locate = () => {
    if (!("geolocation" in navigator)) {
      setError("Location isn’t available on this device.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const params = new URLSearchParams({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) });
          const data = await api<{ place: SignedPlace }>(`/api/geo/reverse?${params}`);
          onChange(data.place);
          setOpen(false);
        } catch (err) {
          setError(errorMessage(err));
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setError("We couldn’t get your location. Please type your address.");
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const saved = useMemo(
    () => (query.trim().length < 2 ? savedPlaces : []),
    [query, savedPlaces],
  );
  const options: Suggestion[] = saved.length
    ? saved.map((s) => ({ place: s.place, label: s.label, secondary: s.place.label, kind: "saved" }))
    : results;
  const showLocate = Boolean(allowLocate) && query.trim().length < 2;
  const showList = open && (showLocate || options.length > 0 || loading || (query.trim().length >= 2 && !loading));

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div
        className={cn(
          "group flex h-14 items-center gap-3 rounded-xl border border-transparent bg-secondary pl-3 pr-2 transition-[background-color,border-color,box-shadow] focus-within:border-primary focus-within:bg-card focus-within:ring-4 focus-within:ring-primary/10 dark:bg-white/[0.05]",
          invalid && "border-destructive/60 ring-4 ring-destructive/10",
        )}
      >
        <span
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-full bg-card",
            tone === "pickup" ? "text-success" : "text-primary",
          )}
        >
          {tone === "pickup" ? <span className="size-2.5 rounded-full border-[2.5px] border-current" /> : <MapPinIcon className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-xs leading-none text-muted-foreground">{label}</div>
          <input
            ref={inputRef}
            id={id}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={invalid || undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoFocus={autoFocus}
            maxLength={120}
            placeholder={placeholder}
            value={query}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              if (value) onChange(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((a) => Math.min(options.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter" && open && active >= 0 && options[active]) {
                e.preventDefault();
                void pick(options[active]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            className="mt-1 w-full truncate bg-transparent text-[15px] font-medium leading-tight outline-none placeholder:font-normal placeholder:text-muted-foreground"
          />
        </div>
        {loading || locating ? (
          <LoaderCircleIcon className="size-4 shrink-0 animate-spin text-muted-foreground" />
        ) : query ? (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            onClick={() => {
              setQuery("");
              onChange(null);
              setResults([]);
              inputRef.current?.focus();
            }}
          >
            <XIcon className="size-4" />
          </button>
        ) : null}
      </div>

      {showList && (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-80 overflow-auto rounded-2xl border bg-popover p-1.5 shadow-float animate-in fade-in-0 slide-in-from-top-1 duration-150"
          >
            {showLocate && (
              <li
                role="option"
                aria-selected={false}
                onMouseDown={(e) => e.preventDefault()}
                onClick={locate}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-3 text-sm font-semibold text-primary hover:bg-accent"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent">
                  <LocateFixedIcon className="size-4" />
                </span>
                Use my current location
              </li>
            )}
            {saved.length > 0 && (
              <li className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Saved places</li>
            )}
            {options.map((s, i) => (
              <li
                key={`${s.label}-${i}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => void pick(s)}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl px-2.5 py-2.5 text-sm",
                  i === active ? "bg-accent text-accent-foreground" : "text-foreground",
                )}
              >
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-primary">
                  {s.kind === "saved" ? <BookmarkIcon className="size-3.5" /> : <MapPinIcon className="size-3.5" />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.label}</span>
                  {s.secondary && <span className="block truncate text-xs text-muted-foreground">{s.secondary}</span>}
                </span>
              </li>
            ))}
            {!loading && options.length === 0 && query.trim().length >= 2 && (
              <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                <SearchIcon className="size-4" /> No matches — try a landmark, area or city name.
              </li>
            )}
            {loading && options.length === 0 && (
              <li className="space-y-2 p-2">
                {[0, 1, 2].map((k) => (
                  <div key={k} className="h-9 animate-pulse rounded-xl bg-muted" />
                ))}
              </li>
            )}
          </ul>
        )}
      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
    </div>
  );
}
