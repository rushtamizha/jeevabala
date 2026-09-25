/** UPI deep links (NPCI "upi://pay" spec). Client-safe. */

export type UpiParams = { vpa: string; name: string; amountPaise: number; note: string };

function query(p: UpiParams) {
  const params = new URLSearchParams({
    pa: p.vpa,
    pn: p.name.slice(0, 50),
    am: (p.amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: p.note.slice(0, 60),
  });
  // Some UPI apps choke on "+" for spaces or an encoded "@" in the VPA.
  return params.toString().replace(/\+/g, "%20").replace(/%40/g, "@");
}

export function upiUri(p: UpiParams) {
  return `upi://pay?${query(p)}`;
}

export type UpiApp = { id: string; name: string; href: string };

/** App-specific intents – needed on iOS where the generic upi:// scheme isn't routed. */
export function upiAppLinks(p: UpiParams): UpiApp[] {
  const q = query(p);
  return [
    { id: "gpay", name: "Google Pay", href: `gpay://upi/pay?${q}` },
    { id: "phonepe", name: "PhonePe", href: `phonepe://pay?${q}` },
    { id: "paytm", name: "Paytm", href: `paytmmp://upi/pay?${q}` },
    { id: "bhim", name: "BHIM", href: `bhim://upi/pay?${q}` },
  ];
}
