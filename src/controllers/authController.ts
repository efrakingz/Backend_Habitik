import { Request, Response } from 'express';
import { AuthService } from '../services/authService';

const authService = new AuthService();

/**
 * ============================================================
 * CONTROLADOR DE AUTENTICACIÓN — /auth
 * ============================================================
 *
 * Maneja los endpoints de registro e inicio de sesión.
 * Delega la lógica de negocio al AuthService.
 *
 * FLUJO GENERAL:
 *   Frontend → POST /auth/register o /auth/login
 *            → authController valida el body
 *            → authService ejecuta la lógica (hashear, crear en BD, firmar JWT)
 *            → Respuesta JSON al frontend con el token
 *
 * 📦 DATOS GUARDADOS EN LA BD:
 *   public.users    → email + password_hash (bcrypt, 10 rondas de salt)
 *   public.profiles → nombre, rol='Jefe', family_id, xp=0, nivel=1, monedas=0
 *   public.families → nombreFamilia, family_code (6 chars alfanuméricos únicos)
 *
 * Todo el registro ocurre dentro de una TRANSACCIÓN de PostgreSQL:
 * si cualquier paso falla, todos los cambios se revierten (ROLLBACK).
 */

/**
 * POST /auth/register
 *
 * ✅ Registra un nuevo Jefe de Familia y crea su Hogar en la misma petición.
 *
 * 📥 BODY ESPERADO (JSON):
 * {
 *   "email":         "jefe@habitik.cl",  // requerido — debe ser único
 *   "password":      "mi_pass_123",      // requerido — mínimo 6 caracteres
 *   "nombre":        "Carlos",           // requerido — nombre del usuario
 *   "nombreFamilia": "Familia López"     // requerido — nombre del hogar
 * }
 *
 * 📤 RESPUESTA EXITOSA 201:
 * {
 *   "user_id":    "uuid-del-usuario",
 *   "family_id":  "uuid-del-hogar",
 *   "token_jwt":  "eyJhbGciOiJIUzI1NiIs..."
 * }
 *
 * ❌ ERRORES:
 *   400 — Faltan campos requeridos / password muy corta
 *   409 — El email ya está registrado
 *   500 — Error interno del servidor
 */
export const register = async (req: Request, res: Response): Promise<void> => {
  const { email, password, nombre, nombreFamilia } = req.body;

  // Validar que todos los campos requeridos estén presentes
  if (!email || !password || !nombre || !nombreFamilia) {
    res.status(400).json({
      message: 'Todos los campos son requeridos: email, password, nombre, nombreFamilia.'
    });
    return;
  }

  // Validar longitud mínima de contraseña
  if (password.length < 6) {
    res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres.' });
    return;
  }

  try {
    // authService crea usuario + perfil + familia en una sola transacción
    const result = await authService.register(email, password, nombre, nombreFamilia);

    // Retornar user_id, family_id y token_jwt según CA-1.1-1
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

/**
 * POST /auth/login
 *
 * ✅ Inicia sesión verificando email y contraseña. Retorna un JWT válido por 24h.
 *
 * 📥 BODY ESPERADO (JSON):
 * {
 *   "email":    "jefe@habitik.cl",
 *   "password": "mi_pass_123"
 * }
 *
 * 📤 RESPUESTA EXITOSA 200:
 * {
 *   "user_id":    "uuid-del-usuario",
 *   "family_id":  "uuid-del-hogar" | null,
 *   "token_jwt":  "eyJhbGciOiJIUzI1NiIs...",
 *   "profile": {
 *     "id":         "uuid",
 *     "email":      "jefe@habitik.cl",
 *     "nombre":     "Carlos",
 *     "rol":        "Jefe",
 *     "family_id":  "uuid-del-hogar",
 *     "xp":         0,
 *     "nivel":      1,
 *     "monedas":    0,
 *     ...
 *   }
 * }
 *
 * ❌ ERRORES:
 *   400 — Faltan campos
 *   401 — Email o contraseña incorrectos
 *   404 — Perfil no encontrado (raro, indica inconsistencia en BD)
 *   500 — Error interno del servidor
 */
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
      // Intencionalmente genérico para no revelar si el email existe o no
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
