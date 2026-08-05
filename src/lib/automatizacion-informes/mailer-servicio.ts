/**
 * Mailer cuenta servicio · KEEP adaptado (sin IMAP / sin casilla personal).
 * Si no hay SMTP_* en env → escribe outbox local (prueba sin saturar casilla).
 */
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

export type MailAdjunto = { filename: string; content: Buffer; contentType?: string };

export type MailResultado = {
  ok: boolean;
  canal: "smtp" | "outbox" | "skip";
  to: string;
  error?: string;
  path?: string;
};

function smtpConfig() {
  const host = process.env.SMTP_HOST || process.env.MAIL_HOST;
  const user = process.env.SMTP_USER || process.env.MAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.MAIL_PASS;
  const port = Number(process.env.SMTP_PORT || process.env.MAIL_PORT || 465);
  const from = process.env.SMTP_FROM || process.env.MAIL_FROM || user;
  if (!host || !user || !pass || !from) return null;
  return { host, user, pass, port, from };
}

async function enviarSmtp(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAdjunto[];
}): Promise<MailResultado> {
  const cfg = smtpConfig();
  if (!cfg) {
    return { ok: false, canal: "skip", to: opts.to, error: "SMTP no configurado" };
  }
  try {
    // Carga dinámica — no romper build si no está instalado
    const nodemailer = (await import("nodemailer")) as typeof import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.port === 465,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    await transporter.sendMail({
      from: `RIMEC Informes <${cfg.from}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType || "application/pdf",
      })),
    });
    return { ok: true, canal: "smtp", to: opts.to };
  } catch (e) {
    return {
      ok: false,
      canal: "smtp",
      to: opts.to,
      error: e instanceof Error ? e.message : "SMTP fail",
    };
  }
}

function escribirOutbox(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAdjunto[];
}): MailResultado {
  const dir = resolve(process.cwd(), ".tmp", "outbox-automatizacion");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = resolve(dir, `${stamp}_${opts.to.replace(/[@.]/g, "_")}`);
  writeFileSync(
    `${base}.html`,
    `<!doctype html><meta charset="utf-8"><title>${opts.subject}</title>
<p><b>Para:</b> ${opts.to}</p><p><b>Asunto:</b> ${opts.subject}</p>${opts.html}
<p>Adjuntos: ${(opts.attachments ?? []).map((a) => a.filename).join(", ")}</p>`,
    "utf8",
  );
  for (const a of opts.attachments ?? []) {
    writeFileSync(`${base}__${a.filename}`, a.content);
  }
  return { ok: true, canal: "outbox", to: opts.to, path: `${base}.html` };
}

/**
 * Aviso corto + adjuntos opcionales.
 * Preferencia piloto: adjuntar PDFs en outbox; SMTP solo si hay config (evitar saturar).
 */
export async function enviarAvisoInforme(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: MailAdjunto[];
  /** Si true y hay SMTP, manda real; si no, outbox */
  forzarSmtp?: boolean;
}): Promise<MailResultado> {
  const cfg = smtpConfig();
  if (cfg && (opts.forzarSmtp || process.env.SMTP_AUTO_INFORMES === "1")) {
    const r = await enviarSmtp(opts);
    if (r.ok) return r;
  }
  return escribirOutbox(opts);
}

export function smtpDisponible(): boolean {
  return smtpConfig() != null;
}
