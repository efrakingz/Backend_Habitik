import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db';
import { MailService } from '../services/mailService';
import { SmsService } from '../services/smsService';

/**
 * ============================================================
 * CONTROLADOR DE RECUPERACIÓN DE CONTRASEÑA — /auth
 * Soporta recuperación directa por Teléfono (SMS) y por Correo
 * ============================================================
 */

function normalizePhone(input: string): string {
  return input.replace(/[\s\-\(\)\.]/g, '').trim();
}

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { phone, telefono, email } = req.body;

  // Validación de email explícito
  if (email !== undefined) {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ message: 'Ingresa un correo electrónico válido.' });
      return;
    }
  }

  const rawPhone = phone || telefono;
  // Validación de teléfono explícito
  if (email === undefined && rawPhone !== undefined) {
    if (!rawPhone || typeof rawPhone !== 'string' || normalizePhone(rawPhone).length < 8) {
      res.status(400).json({ message: 'Ingresa un número de teléfono móvil válido (mínimo 8 dígitos).' });
      return;
    }
  }

  const rawTarget = rawPhone || email;
  if (!rawTarget || typeof rawTarget !== 'string' || rawTarget.trim().length === 0) {
    res.status(400).json({ message: 'Ingresa un número de teléfono o correo electrónico válido.' });
    return;
  }

  const isPhone = rawPhone !== undefined || !rawTarget.includes('@');
  const target = isPhone ? normalizePhone(rawTarget) : rawTarget.toLowerCase().trim();

  try {
    // 1. Verificar si el usuario existe
    let userRow: any = null;

    if (isPhone) {
      // Búsqueda flexible por teléfono en profiles
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
        res.status(404).json({ message: 'No existe ninguna cuenta registrada con este número de teléfono.' });
        return;
      }
      userRow = userRes.rows[0];
    } else {
      const userRes = await pool.query(
        'SELECT id, email FROM public.users WHERE LOWER(TRIM(email)) = $1 LIMIT 1',
        [target]
      );
      if (userRes.rows.length === 0) {
        res.status(404).json({ message: 'No existe ninguna cuenta registrada con este correo electrónico.' });
        return;
      }
      userRow = userRes.rows[0];
    }

    // 2. Cooldown anti-spam (30 segundos entre solicitudes)
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
      res.status(429).json({ message: 'Por favor espera unos segundos antes de solicitar un nuevo código.' });
      return;
    }

    // 3. Generar código OTP de 6 dígitos numéricos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de TTL

    // 4. Invalidar códigos previos no utilizados
    if (isPhone) {
      await pool.query(
        'UPDATE public.password_reset_codes SET used = TRUE WHERE phone = $1 AND used = FALSE',
        [target]
      );
    } else {
      await pool.query(
        'UPDATE public.password_reset_codes SET used = TRUE WHERE LOWER(TRIM(email)) = $1 AND used = FALSE',
        [target]
      );
    }

    // 5. Guardar código en la BD
    await pool.query(
      'INSERT INTO public.password_reset_codes (phone, email, code, expires_at) VALUES ($1, $2, $3, $4)',
      [isPhone ? target : null, userRow.email, code, expiresAt]
    );

    // 6. Enviar código vía SMS o Correo según el canal solicitado
    let isGatewayReady = false;
    if (isPhone) {
      await SmsService.sendVerificationCode(target, code);
      isGatewayReady = SmsService.isConfigured();
    } else {
      await MailService.sendPasswordResetCode(target, code);
      isGatewayReady = MailService.isConfigured();
    }

    res.status(200).json({
      ok: true,
      channel: isPhone ? 'sms' : 'email',
      target,
      message: isPhone
        ? (isGatewayReady ? 'Código de verificación SMS enviado a tu teléfono.' : 'Código de verificación SMS generado exitosamente.')
        : (isGatewayReady ? 'Código de verificación enviado a tu correo.' : 'Código de verificación generado exitosamente.'),
      expiresInMinutes: 15,
      devCode: (process.env.NODE_ENV !== 'production' || !isGatewayReady) ? code : undefined
    });
  } catch (error) {
    console.error('[passwordResetController.forgotPassword]', error);
    res.status(500).json({ message: 'Error interno al procesar la solicitud de recuperación.' });
  }
};

export const verifyResetCode = async (req: Request, res: Response): Promise<void> => {
  const { phone, telefono, email, code } = req.body;
  const rawTarget = phone || telefono || email;

  if (!rawTarget || !code) {
    res.status(400).json({ message: 'Identificador (teléfono o correo) y código son requeridos.' });
    return;
  }

  const isPhone = (phone !== undefined || telefono !== undefined) || !rawTarget.includes('@');
  const target = isPhone ? normalizePhone(rawTarget) : rawTarget.toLowerCase().trim();
  const cleanCode = code.toString().trim();

  try {
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
      res.status(400).json({ message: 'Código incorrecto. Verifica e intenta nuevamente.' });
      return;
    }

    const record = codeRes.rows[0];

    if (record.used) {
      res.status(400).json({ message: 'Este código ya ha sido utilizado. Solicita uno nuevo.' });
      return;
    }

    if (new Date(record.expires_at) < new Date()) {
      res.status(400).json({ message: 'El código ha expirado (validez de 15 minutos). Solicita uno nuevo.' });
      return;
    }

    res.status(200).json({
      ok: true,
      message: 'Código verificado con éxito.'
    });
  } catch (error) {
    console.error('[passwordResetController.verifyResetCode]', error);
    res.status(500).json({ message: 'Error interno al verificar el código.' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  const { phone, telefono, email, code, newPassword } = req.body;
  const rawTarget = phone || telefono || email;

  if (!rawTarget || !code || !newPassword) {
    res.status(400).json({ message: 'Identificador, código y nueva contraseña son requeridos.' });
    return;
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    return;
  }

  const isPhone = (phone !== undefined || telefono !== undefined) || !rawTarget.includes('@');
  const target = isPhone ? normalizePhone(rawTarget) : rawTarget.toLowerCase().trim();
  const cleanCode = code.toString().trim();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar el código con bloqueo pesimista
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
      await client.query('ROLLBACK');
      res.status(400).json({ message: 'Código incorrecto. Verifica e intenta nuevamente.' });
      return;
    }

    const record = codeRes.rows[0];

    if (record.used) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: 'Este código ya fue utilizado. Solicita uno nuevo.' });
      return;
    }

    if (new Date(record.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: 'El código ha expirado (validez de 15 minutos). Solicita uno nuevo.' });
      return;
    }

    // 2. Hashear la nueva contraseña de forma segura
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 3. Actualizar contraseña del usuario en public.users
    await client.query(
      'UPDATE public.users SET password_hash = $1 WHERE LOWER(TRIM(email)) = LOWER(TRIM($2))',
      [passwordHash, record.email]
    );

    // 4. Marcar código como usado
    await client.query(
      'UPDATE public.password_reset_codes SET used = TRUE WHERE id = $1',
      [record.id]
    );

    await client.query('COMMIT');

    res.status(200).json({
      ok: true,
      message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.',
      target
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[passwordResetController.resetPassword]', error);
    res.status(500).json({ message: 'Error interno al restablecer la contraseña.' });
  } finally {
    client.release();
  }
};
