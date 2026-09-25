import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";
import { AppProviders } from "@/components/providers/app-providers";
import { publicBaseUrl } from "@/lib/server/env";
import { getSetting } from "@/lib/server/settings";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"], display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const b = await getSetting("business").catch(() => null);
  const name = b?.name ?? "Saarathi Cabs";
  const description =
    b?.tagline ?? "Book a trusted personal driver for outstation, airport and local rides with transparent fares.";
  let base: URL | undefined;
  try {
    base = new URL(publicBaseUrl());
  } catch {
    base = undefined; // unconfigured local build — Next falls back to localhost
  }
  return {
    metadataBase: base,
    title: { default: `${name} — Outstation, Airport & Local Taxi`, template: `%s · ${name}` },
    description,
    applicationName: name,
    openGraph: { type: "website", siteName: name, title: name, description, locale: "en_IN" },
    twitter: { card: "summary_large_image", title: name, description },
    formatDetection: { telephone: false, email: false, address: false },
    appleWebApp: { capable: true, title: name, statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html
      lang="en-IN"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppProviders nonce={nonce}>{children}</AppProviders>
      </body>
    </html>
  );
}
