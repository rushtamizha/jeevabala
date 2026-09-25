import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import type { SmtpConfig } from "../settings";

let cached: { key: string; transporter: Transporter } | null = null;

function transporterFor(cfg: SmtpConfig): Transporter {
  const key = [cfg.host, cfg.port, cfg.secure, cfg.user, cfg.pass?.length].join("|");
  if (cached?.key === key) return cached.transporter;
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass ?? "" } : undefined,
    // Always require TLS for credentials; refuse downgrade.
    requireTLS: !cfg.secure,
    tls: { minVersion: "TLSv1.2" },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    pool: true,
    maxConnections: 2,
  });
  cached = { key, transporter };
  return transporter;
}

export type EmailMessage = { to: string; subject: string; html: string; text: string; replyTo?: string };

export async function sendEmail(cfg: SmtpConfig, msg: EmailMessage, fromName: string) {
  if (!cfg.configured || !cfg.host) throw new Error("Email (SMTP) is not configured");
  const fromAddress = cfg.from ?? cfg.user;
  if (!fromAddress) throw new Error("SMTP from address missing");
  // Header injection guard.
  const subject = msg.subject.replace(/[\r\n]+/g, " ").slice(0, 200);
  const safeName = fromName.replace(/["\r\n<>]/g, "").slice(0, 60);
  await transporterFor(cfg).sendMail({
    from: fromAddress.includes("<") ? fromAddress : `"${safeName}" <${fromAddress}>`,
    to: msg.to,
    subject,
    html: msg.html,
    text: msg.text,
    replyTo: msg.replyTo,
    headers: { "X-Auto-Response-Suppress": "OOF, AutoReply" },
  });
}

export async function verifySmtp(cfg: SmtpConfig) {
  await transporterFor(cfg).verify();
}

/* ----------------------------------------------------------------------------
 * Branded HTML layout (inline styles for email-client compatibility)
 * ------------------------------------------------------------------------- */

export function escapeHtml(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type EmailBlock =
  | { type: "p"; text: string }
  | { type: "kv"; rows: [string, string][] }
  | { type: "button"; label: string; href: string }
  | { type: "code"; text: string }
  | { type: "note"; text: string };

export function renderEmail(opts: { brand: string; preheader: string; title: string; blocks: EmailBlock[]; footer?: string }) {
  const b = opts.blocks
    .map((block) => {
      switch (block.type) {
        case "p":
          return `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">${escapeHtml(block.text)}</p>`;
        case "note":
          return `<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#71717a">${escapeHtml(block.text)}</p>`;
        case "code":
          return `<div style="margin:8px 0 24px;padding:18px;border-radius:14px;background:#fafaf9;border:1px solid #e7e5e4;text-align:center;font:600 34px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:10px;color:#18181b">${escapeHtml(block.text)}</div>`;
        case "button":
          return `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:8px 0 24px"><tr><td style="border-radius:12px;background:#dc2626"><a href="${escapeHtml(block.href)}" style="display:inline-block;padding:13px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none">${escapeHtml(block.label)}</a></td></tr></table>`;
        case "kv":
          return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 20px;border:1px solid #e7e5e4;border-radius:14px;border-collapse:separate;overflow:hidden">${block.rows
            .map(
              ([k, v], i) =>
                `<tr><td style="padding:11px 16px;font-size:13px;color:#71717a;${i ? "border-top:1px solid #f0efee;" : ""}width:40%">${escapeHtml(k)}</td><td style="padding:11px 16px;font-size:14px;color:#18181b;font-weight:500;${i ? "border-top:1px solid #f0efee;" : ""}">${escapeHtml(v)}</td></tr>`,
            )
            .join("")}</table>`;
      }
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none!important;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f4f5;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px">
<tr><td style="padding:0 8px 18px"><span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:#dc2626;color:#ffffff;font-weight:800;text-align:center;line-height:28px;font-size:15px;vertical-align:middle">${escapeHtml(opts.brand.charAt(0))}</span><span style="margin-left:10px;font-size:16px;font-weight:700;color:#18181b;vertical-align:middle">${escapeHtml(opts.brand)}</span></td></tr>
<tr><td style="background:#ffffff;border-radius:20px;padding:32px 28px;border:1px solid #e4e4e7">
<h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#18181b">${escapeHtml(opts.title)}</h1>${b}
</td></tr>
<tr><td style="padding:18px 8px;font-size:12px;line-height:1.5;color:#a1a1aa">${escapeHtml(opts.footer ?? `You received this email because of your ride with ${opts.brand}.`)}</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    opts.title,
    "",
    ...opts.blocks.map((block) => {
      switch (block.type) {
        case "p":
        case "note":
          return block.text;
        case "code":
          return `Code: ${block.text}`;
        case "button":
          return `${block.label}: ${block.href}`;
        case "kv":
          return block.rows.map(([k, v]) => `${k}: ${v}`).join("\n");
      }
    }),
    "",
    `— ${opts.brand}`,
  ].join("\n");

  return { html, text };
}
