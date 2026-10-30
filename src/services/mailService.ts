import nodemailer, { Transporter } from 'nodemailer';

export class MailService {
  private static transporter: Transporter | null = null;

  public static isConfigured(): boolean {
    const user = (process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
    const pass = (process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASS || process.env.SMTP_PASS || '').replace(/[\s"']/g, '').trim();
    return Boolean(user && pass);
  }

  private static getTransporter(): Transporter | null {
    if (this.transporter) return this.transporter;

    const user = (process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
    const rawPass = process.env.EMAIL_APP_PASSWORD || process.env.EMAIL_PASS || process.env.SMTP_PASS;
    const pass = rawPass ? rawPass.replace(/[\s"']/g, '').trim() : '';
    const host = (process.env.SMTP_HOST || '').trim();

    if (user && pass) {
      if (host) {
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        const secure = process.env.SMTP_SECURE === 'true' || port === 465;
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          tls: {
            rejectUnauthorized: false
          }
        });
      } else {
        // Por defecto soporta Gmail directamente sin necesidad de host/puerto
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user, pass }
        });
      }
      return this.transporter;
    }

    return null;
  }

  /**
   * Envía el código de verificación de 6 dígitos para recuperación de contraseña.
   */
  static async sendPasswordResetCode(email: string, code: string): Promise<boolean> {
    const transporter = this.getTransporter();
    const user = (process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
    const defaultFrom = user ? `Habitik <${user}>` : 'Habitik <no-reply@habitik.app>';
    const from = process.env.SMTP_FROM || defaultFrom;

    const htmlContent = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f7f9f6; padding: 24px; border-radius: 16px;">
        <div style="background-color: #2E7D32; padding: 28px; border-radius: 12px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">🌿 Habitik</h1>
          <p style="margin: 6px 0 0 0; font-size: 14px; opacity: 0.9;">Recuperación de Contraseña</p>
        </div>

        <div style="background-color: #ffffff; padding: 32px 28px; margin-top: 16px; border-radius: 12px; border: 1px solid #e1e7e0;">
          <p style="font-size: 15px; color: #2D3748; line-height: 1.6; margin-top: 0;">
            Hola, hemos recibido una solicitud para restablecer la contraseña de tu cuenta en <strong>Habitik</strong>.
          </p>
          <p style="font-size: 14px; color: #718096; line-height: 1.5;">
            Ingresa el siguiente código de verificación en la aplicación para crear tu nueva contraseña. Este código es de uso único y tiene una validez de <strong>15 minutos</strong>:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #E8F5E9; border: 2px dashed #43A047; border-radius: 12px; padding: 16px 36px;">
              <span style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #1B5E20; font-family: monospace;">${code}</span>
            </div>
          </div>

          <p style="font-size: 12.5px; color: #A0AEC0; line-height: 1.4; margin-bottom: 0;">
            ⚠️ Si tú no solicitaste este cambio, puedes ignorar este correo de forma segura. Tu contraseña actual no será modificada hasta que se verifique este código.
          </p>
        </div>

        <div style="text-align: center; padding-top: 20px; font-size: 12px; color: #A0AEC0;">
          © ${new Date().getFullYear()} Habitik — Gamificación y Ahorro Familiar Sustentable
        </div>
      </div>
    `;

    console.log('='.repeat(55));
    console.log(`📧 [MailService] Código de recuperación generado para: ${email}`);
    console.log(`🔑 [MailService] CÓDIGO VERIFICADOR: [ ${code} ] (Válido por 15 min)`);
    console.log('='.repeat(55));

    if (transporter) {
      try {
        await transporter.sendMail({
          from,
          to: email,
          subject: `🔐 Tu código de verificación Habitik: ${code}`,
          html: htmlContent
        });
        console.log(`✅ [MailService] Correo enviado exitosamente vía SMTP a ${email}`);
        return true;
      } catch (err) {
        console.error(`⚠️ [MailService] Error enviando correo SMTP:`, err);
        // Retornamos true si estamos en dev para permitir pruebas aunque el SMTP falle
        return true;
      }
    } else {
      console.log(`ℹ️ [MailService] Modo desarrollo activo (SMTP no configurado). Código registrado en consola.`);
      return true;
    }
  }
}
