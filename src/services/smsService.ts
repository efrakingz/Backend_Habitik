/**
 * Servicio de mensajería SMS para verificación y recuperación de cuentas.
 * Soporta proveedores de pasarela SMS (Twilio / AWS SNS) en producción
 * y conmutación transparente a modo simulación / consola en desarrollo.
 */
export class SmsService {
  /**
   * Verifica si Twilio o un gateway SMS real está configurado en las variables de entorno.
   */
  public static isConfigured(): boolean {
    const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
    const authToken = (process.env.TWILIO_AUTH_TOKEN || '').trim();
    const fromPhone = (process.env.TWILIO_PHONE_NUMBER || '').trim();
    return Boolean(accountSid && authToken && fromPhone);
  }

  /**
   * Envía un código OTP de 6 dígitos al número de teléfono indicado.
   */
  public static async sendVerificationCode(phone: string, code: string): Promise<boolean> {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '').trim();

    if (this.isConfigured()) {
      try {
        // En producción con Twilio configurado
        const accountSid = process.env.TWILIO_ACCOUNT_SID!;
        const authToken = process.env.TWILIO_AUTH_TOKEN!;
        const from = process.env.TWILIO_PHONE_NUMBER!;

        // Envío directo vía HTTP Basic Auth a la API REST de Twilio sin requerir SDK pesado
        const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
        const body = new URLSearchParams({
          To: cleanPhone,
          From: from,
          Body: `🌿 Habitik: Tu código de verificación es ${code}. Válido por 15 minutos.`
        });

        const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: body.toString()
        });

        if (res.ok) {
          console.log(`📱 [SmsService] SMS enviado exitosamente vía Twilio a ${cleanPhone}`);
          return true;
        } else {
          const errData = await res.text();
          console.warn(`⚠️ [SmsService] Error en respuesta de Twilio: ${errData}`);
        }
      } catch (err: any) {
        console.warn(`⚠️ [SmsService] Error de red enviando SMS: ${err.message}`);
      }
    }

    // Modo simulación / consola para desarrollo y pruebas
    console.log(`📱 [SmsService - MOCK/DEV] SMS para ${cleanPhone}: "🌿 Habitik: Tu código de verificación es [${code}]."`);
    return true;
  }
}
