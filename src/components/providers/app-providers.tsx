"use client";

import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children, nonce }: { children: React.ReactNode; nonce?: string }) {
  // The public site follows the light-mode UI kit exactly; only the admin console offers a dark variant.
  const forcedTheme = usePathname().startsWith("/admin") ? undefined : "light";
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme={forcedTheme} disableTransitionOnChange nonce={nonce}>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster position="top-center" closeButton />
      </TooltipProvider>
    </ThemeProvider>
  );
}
