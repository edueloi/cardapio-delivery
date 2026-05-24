import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST ?? "smtp.hostinger.com";
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
const SMTP_SECURE = process.env.SMTP_SECURE !== "false"; // true por padrão (porta 465)
const SMTP_USER = process.env.SMTP_USER ?? "contato@boxsys.com.br";
const SMTP_PASS = process.env.SMTP_PASS ?? "";
const MAIL_FROM = process.env.MAIL_FROM ?? '"BoxSys" <contato@boxsys.com.br>';
const APP_URL = process.env.APP_URL ?? "https://menu.develoi.com.br";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

function baseLayout(content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>BoxSys</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.08);">
        <!-- Header -->
        <tr>
          <td style="background:#0D1B3E;padding:32px 40px;text-align:center;">
            <span style="font-size:28px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
              Box<span style="color:#C9A227;">Sys</span>
            </span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">
              BoxSys — Sistema de Gestão para Restaurantes<br/>
              <a href="${APP_URL}" style="color:#C9A227;text-decoration:none;">${APP_URL}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Email: convite de cadastro ───────────────────────────────────────────────

export async function sendInviteEmail(to: string, inviteToken: string, note?: string | null) {
  const link = `${APP_URL}/cadastro/${inviteToken}`;
  const html = baseLayout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0D1B3E;">Você foi convidado!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Você recebeu um convite para criar sua conta no <strong>BoxSys</strong> e começar a gerenciar seu estabelecimento.
    </p>
    ${note ? `<div style="background:#f1f5f9;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:13px;color:#64748b;">${note}</p>
    </div>` : ""}
    <p style="margin:0 0 12px;font-size:14px;color:#64748b;">Clique no botão abaixo para criar sua conta:</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${link}" style="display:inline-block;background:#C9A227;color:#ffffff;font-size:15px;font-weight:900;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.5px;">
        Criar minha conta
      </a>
    </div>
    <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">Ou copie o link abaixo no navegador:</p>
    <p style="margin:0;font-size:12px;color:#C9A227;word-break:break-all;">${link}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 20px;"/>
    <p style="margin:0;font-size:12px;color:#94a3b8;">
      Este convite expira em <strong>48 horas</strong>. Se você não solicitou, pode ignorar este e-mail.
    </p>
  `);

  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject: "Seu convite para o BoxSys chegou!",
    html,
  });
}

// ─── Email: redefinição de senha ──────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetToken: string, name: string) {
  const link = `${APP_URL}/redefinir-senha/${resetToken}`;
  const html = baseLayout(`
    <h2 style="margin:0 0 8px;font-size:22px;font-weight:900;color:#0D1B3E;">Redefinir sua senha</h2>
    <p style="margin:0 0 20px;font-size:15px;color:#475569;line-height:1.6;">
      Olá, <strong>${name}</strong>! Recebemos uma solicitação para redefinir a senha da sua conta no <strong>BoxSys</strong>.
    </p>
    <p style="margin:0 0 12px;font-size:14px;color:#64748b;">Clique no botão abaixo para escolher uma nova senha:</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${link}" style="display:inline-block;background:#0D1B3E;color:#ffffff;font-size:15px;font-weight:900;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.5px;">
        Redefinir senha
      </a>
    </div>
    <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;">Ou copie o link abaixo no navegador:</p>
    <p style="margin:0;font-size:12px;color:#C9A227;word-break:break-all;">${link}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 20px;"/>
    <p style="margin:0;font-size:12px;color:#94a3b8;">
      Este link expira em <strong>1 hora</strong>. Se você não solicitou a redefinição, ignore este e-mail — sua senha não será alterada.
    </p>
  `);

  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject: "Redefinição de senha — BoxSys",
    html,
  });
}
