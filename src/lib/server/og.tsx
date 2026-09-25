import "server-only";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Branded 1200×630 share card in the kit palette. */
export function ogCard({ brand, title, highlight, subtitle, chips }: { brand: string; title: string; highlight?: string; subtitle: string; chips: string[] }) {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 760, padding: "56px 64px", background: "#fb5b21", color: "#ffffff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 52, height: 52, borderRadius: 999, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 22, height: 22, borderRadius: 999, border: "5px solid #fb5b21" }} />
            </div>
            <div style={{ fontSize: 30, fontWeight: 700 }}>{`${brand}.`}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: title.length > 18 ? 64 : 84, fontWeight: 700, lineHeight: 1.02, letterSpacing: -2 }}>{title}</div>
            {highlight && <div style={{ fontSize: title.length > 18 ? 64 : 84, fontWeight: 700, lineHeight: 1.05, color: "#010101", letterSpacing: -2 }}>{highlight}</div>}
            <div style={{ marginTop: 22, fontSize: 28, lineHeight: 1.35, color: "rgba(255,255,255,0.92)" }}>{subtitle}</div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {chips.slice(0, 3).map((c) => (
              <div key={c} style={{ display: "flex", padding: "10px 20px", borderRadius: 999, border: "2px solid rgba(255,255,255,0.75)", fontSize: 22, fontWeight: 600 }}>{c}</div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f6f6f6", gap: 28 }}>
          <div style={{ width: 300, height: 300, borderRadius: 999, background: "#ffffff", border: "2px solid #e0e0e0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="220" height="110" viewBox="0 0 220 110">
              <path d="M18 70 C18 58 26 52 38 50 L62 46 L86 22 C92 16 100 14 110 14 L150 14 C160 14 168 18 174 26 L190 46 L200 50 C208 54 212 60 212 68 L212 80 C212 84 209 86 205 86 L15 86 C12 86 10 84 10 80 L10 76 C10 72 13 70 18 70 Z" fill="#fb5b21" />
              <path d="M92 26 C96 22 100 20 108 20 L126 20 L126 46 L72 46 Z" fill="#ffd9c9" />
              <path d="M134 20 L150 20 C158 20 163 23 168 30 L180 46 L134 46 Z" fill="#ffd9c9" />
              <circle cx="58" cy="86" r="18" fill="#010101" />
              <circle cx="58" cy="86" r="8" fill="#e0e0e0" />
              <circle cx="166" cy="86" r="18" fill="#010101" />
              <circle cx="166" cy="86" r="8" fill="#e0e0e0" />
            </svg>
          </div>
          <div style={{ display: "flex", padding: "14px 34px", borderRadius: 999, background: "#fb5b21", color: "#ffffff", fontSize: 26, fontWeight: 700 }}>Book a ride</div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
