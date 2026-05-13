import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(request: Request) {
  try {
    const { name, email, subject, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { success: false, error: "Nome, email e mensagem são obrigatórios." },
        { status: 400 }
      );
    }

    const fromEmail = process.env.EMAIL_FROM || "FOLIA <noreply@folia-vercel.app>";
    // O destino deve ser o suporte ou o próprio e-mail configurado do sistema
    const toEmail = process.env.CONTACT_EMAIL || fromEmail;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_LOGIN,
        pass: process.env.SMTP_KEY,
      },
    });

    const emailHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nova Mensagem de Contato</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px; }
          .content { background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .highlight { background: #ecfdf5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📩 Novo Contato - Plataforma FOLIA</h1>
          </div>
          <div class="content">
            <p>Você recebeu uma nova mensagem através da página de contato.</p>
            <div class="highlight">
              <p><strong>Nome:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Assunto:</strong> ${subject || "Sem assunto"}</p>
            </div>
            <p><strong>Mensagem:</strong></p>
            <p style="white-space: pre-wrap; background: #f9fafb; padding: 15px; border-radius: 8px;">${message}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      replyTo: email,
      subject: `[Contato FOLIA] ${subject || "Nova mensagem de " + name}`,
      html: emailHtml,
    });

    return NextResponse.json({
      success: true,
      message: "Sua mensagem foi enviada com sucesso! Entraremos em contato em breve.",
    });
  } catch (error) {
    console.error("Error in contact route:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Ocorreu um erro ao enviar a mensagem. Tente novamente mais tarde.",
      },
      { status: 500 }
    );
  }
}
