"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

export type LiveAlert = { id: string; bookingId: string; code: string; type: string; message: string | null; createdAt: string; name: string; unread: boolean };
type Live = { pending: number; paymentClaims: number; unread: number; alerts: LiveAlert[]; markSeen: () => void; soundOn: boolean; setSoundOn: (v: boolean) => void };

const LiveContext = createContext<Live>({ pending: 0, paymentClaims: 0, unread: 0, alerts: [], markSeen: () => {}, soundOn: true, setSoundOn: () => {} });
export const useLiveCounts = () => useContext(LiveContext);

function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1318.5].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, now + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.25, now + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(now + i * 0.16);
      o.stop(now + i * 0.16 + 0.55);
    });
    setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* audio unavailable */
  }
}

/** Polls /api/admin/live and raises sound + toast + system notifications for new events. */
export function LiveProvider({ children, initial }: { children: React.ReactNode; initial: { pending: number; paymentClaims: number } }) {
  const router = useRouter();
  const [state, setState] = useState({ ...initial, unread: 0, alerts: [] as LiveAlert[] });
  const [soundOn, setSoundOnState] = useState(() => {
    try {
      return typeof window === "undefined" || localStorage.getItem("sa_admin_sound") !== "off";
    } catch {
      return true;
    }
  });
  const last = useRef<{ latest: string | null; pending: number; claims: number } | null>(null);
  const setSoundOn = useCallback((v: boolean) => {
    setSoundOnState(v);
    try {
      localStorage.setItem("sa_admin_sound", v ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (v && "Notification" in window && Notification.permission === "default") void Notification.requestPermission();
  }, []);

  const poll = useCallback(
    async (seen = false) => {
      try {
        const r = await api<{ pending: number; paymentClaims: number; unread: number; latestEventAt: string | null; alerts: LiveAlert[] }>(
          `/api/admin/live${seen ? "?seen=1" : ""}`,
        );
        const prev = last.current;
        if (prev && r.latestEventAt && r.latestEventAt !== prev.latest) {
          const newRequest = r.pending > prev.pending;
          const newClaim = r.paymentClaims > prev.claims;
          if (newRequest || newClaim) {
            const title = newRequest ? "New ride request" : "Payment reported";
            const top = r.alerts[0];
            toast.info(title, {
              description: top ? `${top.code} · ${top.name}` : undefined,
              action: top ? { label: "Open", onClick: () => router.push(`/admin/bookings/${top.bookingId}`) } : undefined,
            });
            if (soundOn) chime();
            if (document.visibilityState !== "visible" && "Notification" in window && Notification.permission === "granted") {
              new Notification(title, { body: top ? `${top.code} · ${top.name}` : undefined, tag: "saarathi-live" });
            }
          }
          router.refresh();
        }
        last.current = { latest: r.latestEventAt, pending: r.pending, claims: r.paymentClaims };
        setState({ pending: r.pending, paymentClaims: r.paymentClaims, unread: r.unread, alerts: r.alerts });
      } catch {
        /* offline / signed out */
      }
    },
    [router, soundOn],
  );

  useEffect(() => {
    const first = setTimeout(() => void poll(), 0);
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, 10_000);
    const onVis = () => document.visibilityState === "visible" && void poll();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [poll]);

  return (
    <LiveContext.Provider value={{ ...state, markSeen: () => void poll(true), soundOn, setSoundOn }}>{children}</LiveContext.Provider>
  );
}
