import { PageHeader } from "./page-header";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <PageHeader crumbs={[{ href: "/", label: "Home" }, { href: "#", label: title }]} eyebrow="Legal" title={title} subtitle={`Last updated ${updated}`} />
      <article className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <div className="space-y-8 rounded-2xl border bg-card p-5 text-[15px] leading-relaxed text-foreground/85 sm:p-8 [&_a]:text-primary [&_a]:underline [&_h2]:mb-3 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
          {children}
        </div>
      </article>
    </>
  );
}
