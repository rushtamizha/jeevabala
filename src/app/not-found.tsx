import Link from "next/link";
import { CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="grid size-24 place-items-center rounded-full bg-secondary">
        <CompassIcon className="size-10 text-primary" />
      </span>
      <span className="mt-8 inline-flex h-6 items-center rounded-full border border-primary bg-accent px-2.5 text-[11px] font-medium text-primary">Error 404</span>
      <h1 className="mt-3 text-3xl font-bold tracking-[-0.03em]">Looks like a wrong turn</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">The page you’re looking for doesn’t exist or has moved.</p>
      <div className="mt-8 flex gap-3">
        <Button asChild size="xl"><Link href="/">Back home</Link></Button>
        <Button asChild size="xl" variant="secondary"><Link href="/book">Book a ride</Link></Button>
      </div>
    </main>
  );
}
