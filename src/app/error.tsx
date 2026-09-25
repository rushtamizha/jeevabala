"use client";

import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <span className="grid size-24 place-items-center rounded-full bg-secondary">
        <TriangleAlertIcon className="size-10 text-primary" />
      </span>
      <h1 className="mt-8 text-2xl font-bold tracking-[-0.03em]">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">Please try again. If it keeps happening, contact us{error.digest ? ` with reference ${error.digest}` : ""}.</p>
      <Button size="xl" className="mt-8" onClick={reset}>
        <RotateCcwIcon /> Try again
      </Button>
    </main>
  );
}
