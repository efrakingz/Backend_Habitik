import bcrypt from 'bcryptjs';
import { pool } from '../config/db';
import { MailService } from './mailService';
import { SmsService } from './smsService';

export class PasswordResetError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function normalizePhone(input: string): string {
  return input.replace(/[\s\-\(\)\.]/g, '').trim();
}

export class PasswordResetService {
  static async requestResetCode(params: { phone?: string; telefono?: string; email?: string }) {
    const { phone, telefono, email } = params;

    if (email !== undefined) {
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        throw new PasswordResetError(400, 'Ingresa un correo electrónico válido.');
      }
    }

    const rawPhone = phone || telefono;
    if (email === undefined && rawPhone !== undefined) {
      if (!rawPhone || typeof rawPhone !== 'string' || normalizePhone(rawPhone).length < 8) {
        throw new PasswordResetError(400, 'Ingresa un número de teléfono móvil válido (mínimo 8 dígitos).');
      }
    }

    const rawTarget = rawPhone || email;
    if (!rawTarget || typeof rawTarget !== 'string' || rawTarget.trim().length === 0) {
      throw new PasswordResetError(400, 'Ingresa un número de teléfono o correo electrónico válido.');
    }

    const isPhone = rawPhone !== undefined || !rawTarget.includes('@');
    const target = isPhone ? normalizePhone(rawTarget) : rawTarget.toLowerCase().trim();

    let userRow: any = null;

    if (isPhone) {
      const digitsOnly = target.replace(/\+/g, '');
      const userRes = await pool.query(
        `SELECT u.id, u.email, p.nombre, p.telefono
         FROM public.profiles p
         JOIN public.users u ON p.id = u.id
         WHERE p.telefono IS NOT NULL 
           AND (
             REPLACE(REPLACE(REPLACE(p.telefono, ' ', ''), '-', ''), '+', '') = $1
             OR RIGHT(REPLACE(REPLACE(REPLACE(p.telefono, ' ', ''), '-', ''), '+', ''), 8) = RIGHT($1, 8)
           )
         LIMIT 1;`,
        [digitsOnly]
      );
      if (userRes.rows.length === 0) {
        throw new PasswordResetError(404, 'No existe ninguna cuenta registrada con este número de teléfono.');
      }
      userRow = userRes.rows[0];
    } else {
      const userRes = await pool.query(
        'SELECT id, email FROM public.users WHERE LOWER(TRIM(email)) = $1 LIMIT 1',
        [target]
      );
      if (userRes.rows.length === 0) {
        throw new PasswordResetError(404, 'No existe ninguna cuenta registrada con este correo electrónico.');
      }
      userRow = userRes.rows[0];
    }

    const recentRes = isPhone
      ? await pool.query(
          `SELECT created_at FROM public.password_reset_codes 
           WHERE phone = $1 AND created_at > NOW() - INTERVAL '30 seconds'
           ORDER BY created_at DESC LIMIT 1`,
          [target]
        )
      : await pool.query(
          `SELECT created_at FROM public.password_reset_codes 
           WHERE LOWER(TRIM(email)) = $1 AND created_at > NOW() - INTERVAL '30 seconds'
           ORDER BY created_at DESC LIMIT 1`,
          [target]
        );

    if (recentRes.rows.length > 0) {
      throw new PasswordResetError(429, 'Por favor espera unos segundos antes de solicitar un nuevo código.');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Invalidar códigos anteriores e insertar el nuevo en una sola consulta CTE
    if (isPhone) {
      await pool.query(
        `WITH invalidated AS (
           UPDATE public.password_reset_codes SET used = TRUE WHERE phone = $1 AND used = FALSE
         )
         INSERT INTO public.password_reset_codes (phone, email, code, expires_at)
         VALUES ($1, $2, $3, $4);`,
        [target, userRow.email, code, expiresAt]
      );
    } else {
      await pool.query(
        `WITH invalidated AS (
           UPDATE public.password_reset_codes SET used = TRUE WHERE LOWER(TRIM(email)) = $1 AND used = FALSE
         )
         INSERT INTO public.password_reset_codes (phone, email, code, expires_at)
         VALUES (NULL, $2, $3, $4);`,
        [target, userRow.email, code, expiresAt]
      );
    }

    let isGatewayReady = false;
    if (isPhone) {
      await SmsService.sendVerificationCode(target, code);
      isGatewayReady = SmsService.isConfigured();
    } else {
      await MailService.sendPasswordResetCode(target, code);
      isGatewayReady = MailService.isConfigured();
    }

    return {
      ok: true,
      channel: isPhone ? 'sms' : 'email',
      target,
      message: isPhone
        ? (isGatewayReady ? 'Código de verificación SMS enviado a tu teléfono.' : 'Código de verificación SMS generado exitosamente.')
        : (isGatewayReady ? 'Código de verificación enviado a tu correo.' : 'Código de verificación generado exitosamente.'),
      expiresInMinutes: 15,
      devCode: (process.env.NODE_ENV !== 'production' || !isGatewayReady) ? code : undefined
    };
  }

  static async verifyCode(params: { phone?: string; telefono?: string; email?: string; code?: string }) {
    const { phone, telefono, email, code } = params;
    const rawTarget = phone || telefono || email;

    if (!rawTarget || !code) {
      throw new PasswordResetError(400, 'Identificador (teléfono o correo) y código son requeridos.');
    }

    const isPhone = (phone !== undefined || telefono !== undefined) || !rawTarget.includes('@');
    const target = isPhone ? normalizePhone(rawTarget) : rawTarget.toLowerCase().trim();
    const cleanCode = code.toString().trim();

    const codeRes = isPhone
      ? await pool.query(
          `SELECT id, expires_at, used 
           FROM public.password_reset_codes 
           WHERE phone = $1 AND code = $2 
           ORDER BY created_at DESC 
           LIMIT 1`,
          [target, cleanCode]
        )
      : await pool.query(
          `SELECT id, expires_at, used 
           FROM public.password_reset_codes 
           WHERE LOWER(TRIM(email)) = $1 AND code = $2 
           ORDER BY created_at DESC 
           LIMIT 1`,
          [target, cleanCode]
        );

    if (codeRes.rows.length === 0) {
      throw new PasswordResetError(400, 'Código incorrecto. Verifica e intenta nuevamente.');
    }

    const record = codeRes.rows[0];

    if (record.used) {
      throw new PasswordResetError(400, 'Este código ya ha sido utilizado. Solicita uno nuevo.');
    }

    if (new Date(record.expires_at) < new Date()) {
      throw new PasswordResetError(400, 'El código ha expirado (validez de 15 minutos). Solicita uno nuevo.');
    }

    return {
      ok: true,
      message: 'Código verificado con éxito.'
    };
  }

  static async resetPasswordWithCode(params: { phone?: string; telefono?: string; email?: string; code?: string; newPassword?: string }) {
    const { phone, telefono, email, code, newPassword } = params;
    const rawTarget = phone || telefono || email;

    if (!rawTarget || !code || !newPassword) {
      throw new PasswordResetError(400, 'Identificador, código y nueva contraseña son requeridos.');
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new PasswordResetError(400, 'La nueva contraseña debe tener al menos 6 caracteres.');
    }

    const isPhone = (phone !== undefined || telefono !== undefined) || !rawTarget.includes('@');
    const target = isPhone ? normalizePhone(rawTarget) : rawTarget.toLowerCase().trim();
    const cleanCode = code.toString().trim();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const codeRes = isPhone
        ? await client.query(
            `SELECT id, email, expires_at, used 
             FROM public.password_reset_codes 
             WHERE phone = $1 AND code = $2 
             ORDER BY created_at DESC 
             LIMIT 1 
             FOR UPDATE`,
            [target, cleanCode]
          )
        : await client.query(
            `SELECT id, email, expires_at, used 
             FROM public.password_reset_codes 
             WHERE LOWER(TRIM(email)) = $1 AND code = $2 
             ORDER BY created_at DESC 
             LIMIT 1 
             FOR UPDATE`,
            [target, cleanCode]
          );

      if (codeRes.rows.length === 0) {
        throw new PasswordResetError(400, 'Código incorrecto. Verifica e intenta nuevamente.');
      }

      const record = codeRes.rows[0];

      if (record.used) {
        throw new PasswordResetError(400, 'Este código ya fue utilizado. Solicita uno nuevo.');
      }

      if (new Date(record.expires_at) < new Date()) {
        throw new PasswordResetError(400, 'El código ha expirado (validez de 15 minutos). Solicita uno nuevo.');
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      await client.query(
        'UPDATE public.users SET password_hash = $1 WHERE LOWER(TRIM(email)) = LOWER(TRIM($2))',
        [passwordHash, record.email]
      );

      await client.query(
        'UPDATE public.password_reset_codes SET used = TRUE WHERE id = $1',
        [record.id]
      );

      await client.query('COMMIT');

      return {
        ok: true,
        message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.',
        target
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
