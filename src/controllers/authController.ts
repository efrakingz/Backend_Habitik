import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { pool } from '../config/db';

const authService = new AuthService();

/**
 * ============================================================
 * CONTROLADOR DE AUTENTICACIÓN — /auth
 * ============================================================
 */

export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, nombre, nombreFamilia } = req.body;

  if (!email || !password || !nombre || !nombreFamilia) {
    res.status(400).json({
      message: 'Todos los campos son requeridos: email, password, nombre, nombreFamilia.'
    });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
    return;
  }

  try {
    const result = await authService.register(email, password, nombre, nombreFamilia);
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_EXISTS') {
      res.status(409).json({ message: 'El correo electrónico ya se encuentra registrado.' });
      return;
    }
    console.error('[authController.register]', error);
    res.status(500).json({ message: 'Error interno al registrar el usuario.' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: 'Email y contraseña son requeridos.' });
    return;
  }

  try {
    const result = await authService.login(email, password);
    res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
      res.status(401).json({ message: 'Credenciales inválidas.' });
      return;
    }
    if (error instanceof Error && error.message === 'PROFILE_NOT_FOUND') {
      res.status(404).json({ message: 'Perfil de usuario no encontrado.' });
      return;
    }
    console.error('[authController.login]', error);
    res.status(500).json({ message: 'Error interno al iniciar sesión.' });
  }
};

/**
 * GET /perfil/:user_id
 * 
 * ✅ Obtiene la información del perfil gamificado actualizada desde PostgreSQL.
 */
export const getPerfil = async (req: Request, res: Response): Promise<void> => {
  const { user_id } = req.params;

  if (!user_id) {
    res.status(400).json({ message: 'El parámetro user_id es obligatorio.' });
    return;
  }

  try {
    const queryText = `
      SELECT id, email, nombre, rol, family_id, xp, monedas, nivel, racha_dias
      FROM public.profiles 
      WHERE id = $1;
    `;
    const result = await pool.query(queryText, [user_id]);

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Perfil de usuario no encontrado.' });
      return;
    }

    const profile = result.rows[0];
    const totalXp = profile.xp || 0;
    
    // Cálculo dinámico de Nivel y Porcentaje para la barra de progreso
    const nivelCalculado = Math.floor(totalXp / 500) + 1;
    const porcentajeBarra = `${Math.floor(((totalXp % 500) / 500) * 100)}%`;

    res.status(200).json({
      ok: true,
      data: {
        ...profile,
        nivel: nivelCalculado,
        porcentaje_siguiente_nivel: porcentajeBarra
      }
    });
  } catch (error) {
    console.error('[authController.getPerfil]', error);
    res.status(500).json({ message: 'Error interno al consultar el perfil.' });
  }
};