import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../config/db';
import { MailService } from '../services/mailService';

/**
 * ============================================================
 * CONTROLADOR DE RECUPERACIÓN DE CONTRASEÑA — /auth
 * ============================================================
 */

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ message: 'Ingresa un correo electrónico válido.' });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();

  try {
    // 1. Verificar si el usuario existe
    const userRes = await pool.query('SELECT id FROM public.users WHERE email = $1', [cleanEmail]);
    if (userRes.rows.length === 0) {
      res.status(404).json({ message: 'No existe ninguna cuenta registrada con este correo electrónico.' });
      return;
    }

    // 2. Generar código de 6 dígitos numéricos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos de TTL

    // 3. Invalidar códigos previos no utilizados para este correo
    await pool.query('UPDATE public.password_reset_codes SET used = TRUE WHERE email = $1 AND used = FALSE', [cleanEmail]);

    // 4. Guardar código en la BD
    await pool.query(
      'INSERT INTO public.password_reset_codes (email, code, expires_at) VALUES ($1, $2, $3)',
      [cleanEmail, code, expiresAt]
    );

    // 5. Enviar correo electrónico
    await MailService.sendPasswordResetCode(cleanEmail, code);

    res.status(200).json({
      ok: true,
      message: 'Código de verificación enviado. Revisa tu bandeja de entrada o spam.',
      expiresInMinutes: 15,
      // Retornar en desarrollo para facilitar pruebas instantáneas
      devCode: process.env.NODE_ENV !== 'production' ? code : undefined
    });
  } catch (error) {
    console.error('[passwordResetController.forgotPassword]', error);
    res.status(500).json({ message: 'Error interno al procesar la solicitud de recuperación.' });
  }
};

export const verifyResetCode = async (req: Request, res: Response): Promise<void> => {
  const { email, code } = req.body;

  if (!email || !code) {
    res.status(400).json({ message: 'Correo electrónico y código son requeridos.' });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanCode = code.toString().trim();

  try {
    const codeRes = await pool.query(
      `SELECT id, expires_at, used 
       FROM public.password_reset_codes 
       WHERE email = $1 AND code = $2 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [cleanEmail, cleanCode]
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
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    res.status(400).json({ message: 'Correo, código y nueva contraseña son requeridos.' });
    return;
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
    return;
  }

  const cleanEmail = email.toLowerCase().trim();
  const cleanCode = code.toString().trim();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Validar el código nuevamente
    const codeRes = await client.query(
      `SELECT id, expires_at, used 
       FROM public.password_reset_codes 
       WHERE email = $1 AND code = $2 
       ORDER BY created_at DESC 
       LIMIT 1 
       FOR UPDATE`,
      [cleanEmail, cleanCode]
    );

    if (codeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ message: 'Código incorrecto.' });
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
      res.status(400).json({ message: 'El código ha expirado. Solicita uno nuevo.' });
      return;
    }

    // 2. Hashear la nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // 3. Actualizar contraseña del usuario
    await client.query(
      'UPDATE public.users SET password_hash = $1 WHERE email = $2',
      [passwordHash, cleanEmail]
    );

    // 4. Marcar código como usado
    await client.query(
      'UPDATE public.password_reset_codes SET used = TRUE WHERE id = $1',
      [record.id]
    );

    await client.query('COMMIT');

    res.status(200).json({
      ok: true,
      message: 'Contraseña actualizada exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[passwordResetController.resetPassword]', error);
    res.status(500).json({ message: 'Error interno al restablecer la contraseña.' });
  } finally {
    client.release();
  }
};

