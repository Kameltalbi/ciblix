import nodemailer from 'nodemailer';

type ScoutAlertOpp = {
  title: string;
  url: string;
  source: string;
  relevanceScore: number;
  category: string;
  deadline?: string | null;
  aiSummary?: string | null;
};

function getSmtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;
  if (!host || !user || !pass || !from) return null;
  return {
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from,
  };
}

function appBaseUrl(): string {
  return (process.env.FRONTEND_URL || process.env.APP_URL || 'https://ciblix.com').replace(/\/$/, '');
}

export async function sendScoutOpportunityAlert(opts: {
  toEmail: string;
  orgName?: string | null;
  opportunities: ScoutAlertOpp[];
  minScore: number;
}): Promise<boolean> {
  const config = getSmtpConfig();
  if (!config) {
    console.warn('[scout-alert] SMTP non configuré — email non envoyé');
    return false;
  }
  if (!opts.opportunities.length) return false;

  const scoutUrl = `${appBaseUrl()}/agents/scout-ai`;
  const rows = opts.opportunities
    .slice(0, 8)
    .map(
      (o) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #e5e7eb;">
          <div style="font-weight:600;color:#0f172a;">${escapeHtml(o.title)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:4px;">
            Score ${o.relevanceScore} · ${escapeHtml(o.source)} · ${escapeHtml(o.category)}
            ${o.deadline ? ` · Deadline ${escapeHtml(o.deadline)}` : ''}
          </div>
          ${o.aiSummary ? `<div style="font-size:13px;color:#334155;margin-top:6px;">${escapeHtml(o.aiSummary.slice(0, 220))}</div>` : ''}
          <a href="${escapeAttr(o.url)}" style="font-size:13px;color:#016AEB;">Voir la source</a>
        </td>
      </tr>`,
    )
    .join('');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1f2937;max-width:640px;margin:0 auto;">
      <div style="background:#016AEB;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;">
        <div style="font-size:12px;opacity:.85;">Veilleur IA · Ciblix</div>
        <h1 style="margin:4px 0 0;font-size:20px;">${opts.opportunities.length} opportunité(s) à fort potentiel</h1>
      </div>
      <div style="border:1px solid #BED6F6;border-top:0;padding:20px;border-radius:0 0 12px 12px;">
        <p style="margin:0 0 12px;">Bonjour${opts.orgName ? ` (${escapeHtml(opts.orgName)})` : ''},</p>
        <p style="margin:0 0 16px;color:#475569;">
          Votre agent a détecté de nouvelles opportunités avec un score ≥ ${opts.minScore}.
        </p>
        <table style="width:100%;border-collapse:collapse;">${rows}</table>
        <p style="margin:20px 0 0;">
          <a href="${scoutUrl}" style="background:#016AEB;color:#fff;padding:12px 16px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600;">
            Ouvrir le Veilleur IA
          </a>
        </p>
      </div>
    </div>
  `;

  const text = opts.opportunities
    .slice(0, 8)
    .map((o) => `- [${o.relevanceScore}] ${o.title}\n  ${o.url}`)
    .join('\n\n');

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
  });

  await transporter.sendMail({
    from: config.from,
    to: opts.toEmail,
    subject: `Veilleur IA — ${opts.opportunities.length} nouvelle(s) opportunité(s) (score ≥ ${opts.minScore})`,
    text: `Nouvelles opportunités Scout AI:\n\n${text}\n\n${scoutUrl}`,
    html,
  });

  return true;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
