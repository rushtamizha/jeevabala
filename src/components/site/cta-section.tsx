import { ArrowRightIcon, CarFrontIcon, CrownIcon, GiftIcon, PhoneCallIcon } from "lucide-react";
import Link from "next/link";
import { CircularText } from "@/components/reactbits/circular-text";
import { RotatingText } from "@/components/reactbits/rotating-text";
import { WhatsAppIcon } from "@/components/shared/icons";
import { formatINR, phoneDigits } from "@/lib/format";
import type { LoyaltySettings } from "@/lib/settings-schema";
import { Section } from "./sections";

/** Closing call-to-action: orange band with a rotating destination, a spinning trust badge and the rewards ladder. */
export function CtaSection({ phone, whatsapp, loyalty }: { phone?: string; whatsapp?: string; loyalty: LoyaltySettings }) {
  const tiers = [...loyalty.tiers].sort((a, b) => a.minRides - b.minRides).filter((t) => t.discountPercent > 0);
  return (
    <Section id="rewards">
      <div className="reveal relative isolate overflow-hidden rounded-3xl bg-primary px-6 py-10 text-white sm:px-10 sm:py-12 lg:px-14 lg:py-14">
        <div aria-hidden className="absolute inset-0 -z-10 opacity-[0.14] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_70%_80%_at_70%_50%,black,transparent)]" />
        <div aria-hidden className="absolute -bottom-40 -right-24 -z-10 size-[30rem] rounded-full bg-[radial-gradient(circle,rgb(12_10_9/0.35),transparent_65%)]" />
        <div aria-hidden className="absolute -left-20 -top-32 -z-10 size-[26rem] rounded-full bg-[radial-gradient(circle,rgb(255_255_255/0.22),transparent_65%)]" />

        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <span className="eyebrow eyebrow-dark border-white/30 bg-white/10 before:!bg-white">Ready when you are</span>
            <h2 className="mt-4 text-[2rem] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[2.5rem] lg:text-[2.875rem]">
              <span className="sr-only">Your next trip starts with one tap.</span>
              <span aria-hidden>
                Your next <RotatingText words={["airport run", "weekend getaway", "one-way drop", "family trip"]} className="text-night" />
                <br />
                starts with one tap.
              </span>
            </h2>
            <p className="mt-4 max-w-xl text-pretty text-[15px] leading-relaxed text-white/85 sm:text-base">
              Instant itemised fare, a verified driver at your door and nothing to pay until the trip is done.
            </p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              <Link href="/book" className="star-border inline-flex h-12 items-center gap-2 rounded-full px-7 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 [--star-bg:var(--night)] [--star-color:#ffb18f]">
                Book a ride <ArrowRightIcon className="size-4" />
              </Link>
              {phone && (
                <a href={`tel:${phone}`} className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5">
                  <PhoneCallIcon className="size-4 text-primary" /> {phone}
                </a>
              )}
              {whatsapp && (
                <a href={`https://wa.me/${phoneDigits(whatsapp)}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-full bg-white/12 px-6 text-sm font-semibold ring-1 ring-inset ring-white/35 transition-[transform,translate,scale,background-color] hover:-translate-y-0.5 hover:bg-white/20">
                  <WhatsAppIcon className="size-4" /> WhatsApp
                </a>
              )}
            </div>

            {loyalty.enabled && tiers.length > 0 && (
              <div className="mt-8 flex flex-wrap items-center gap-2 border-t border-white/20 pt-6">
                <span className="mr-1 inline-flex items-center gap-1.5 text-[13px] font-semibold">
                  <CrownIcon className="size-4" /> Rider rewards
                </span>
                {tiers.map((t) => (
                  <span key={t.name} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/12 px-3 text-xs font-medium ring-1 ring-inset ring-white/25">
                    {t.name} <span className="font-bold">{t.discountPercent}% off</span>
                    <span className="text-white/70">· {t.minRides}+ rides</span>
                  </span>
                ))}
                {loyalty.referral.enabled && (
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-night/25 px-3 text-xs font-medium">
                    <GiftIcon className="size-3.5" /> Refer a friend: {formatINR(loyalty.referral.referrerBonus)} credit
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="hidden justify-self-end lg:block">
            <CircularText text="24×7 • verified driver • no surge • " className="size-48 text-white/90">
              <span className="grid size-24 place-items-center rounded-full bg-night text-primary shadow-[0_20px_40px_-12px_rgb(0_0_0/0.5)]">
                <CarFrontIcon className="size-9" strokeWidth={1.6} />
              </span>
            </CircularText>
          </div>
        </div>
      </div>
    </Section>
  );
}
