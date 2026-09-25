import { WhatsAppIcon } from "@/components/shared/icons";
import { phoneDigits } from "@/lib/format";

/** Floating WhatsApp bubble, thumb-reachable above the bottom nav on phones (pops in with CSS, no JS). */
export function FloatingContact({ whatsapp, brand }: { phone?: string; whatsapp?: string; brand: string }) {
  if (!whatsapp) return null;
  return (
    <a
      href={`https://wa.me/${phoneDigits(whatsapp)}?text=${encodeURIComponent(`Hi ${brand}, I'd like to book a ride.`)}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="no-print fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 grid size-13 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_28px_-10px_rgb(37_211_102/0.7)] ring-4 ring-white transition-transform animate-pop-in [animation-delay:1.2s] hover:scale-105 md:bottom-6 md:right-6"
    >
      <WhatsAppIcon className="size-6" />
    </a>
  );
}
