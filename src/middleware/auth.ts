import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_12345';

/**
 * ============================================================
 * MIDDLEWARE DE AUTENTICACIÓN JWT — Sprint 1
 * ============================================================
 *
 * Un middleware es una función que se ejecuta ANTES del controlador.
 * Este en particular verifica que el usuario esté autenticado.
 *
 * 🔑 ¿CÓMO FUNCIONA EL TOKEN JWT?
 *   1. El usuario hace POST /auth/login o POST /auth/register
 *   2. El backend genera un token firmado con JWT que contiene:
 *      { user_id, family_id, role }
 *   3. El frontend guarda ese token (en memoria, SharedPreferences, etc.)
 *   4. En cada petición protegida, el frontend envía el token en el header:
 *      Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
 *   5. Este middleware verifica que el token sea válido y no haya expirado
 *   6. Si es válido, adjunta el payload decodificado en req.auth y continúa
 *   7. Si es inválido o expirado → responde 401 Unauthorized
 *
 * ⏰ EXPIRACIÓN: Los tokens del Sprint 1 expiran en 24 horas.
 *
 * 💡 PARA EL FRONTEND:
 *   - Guardar el token al hacer login/register
 *   - Incluirlo en CADA petición autenticada:
 *     headers: { 'Authorization': 'Bearer <token>' }
 *   - Si recibes 401, el token expiró → redirigir al login
 */

/**
 * Estructura del payload decodificado del JWT.
 * El frontend puede decodificar el token (sin verificarlo) para leer estos valores.
 */
export interface JwtPayload {
  user_id: string;              // UUID del usuario — usar para identificar al usuario
  family_id: string | null;     // UUID del hogar — null si aún no pertenece a uno
  role: 'admin' | 'miembro';   // 'admin' = Jefe de Familia | 'miembro' = integrante normal
}

// Extender el tipo de Request de Express para incluir el payload del JWT
declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload; // Disponible en los controladores tras pasar este middleware
    }
  }
}

/**
 * verifyToken — Middleware principal de autenticación
 *
 * Uso en rutas:
 *   router.get('/ruta-protegida', verifyToken, miControlador);
 *
 * Respuestas de error:
 *   401 — No se proporcionó token / Formato inválido / Token expirado o inválido
 */
export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];

  // Verificar que el header Authorization esté presente
  if (!authHeader) {
    res.status(401).json({
      message: 'Acceso denegado. No se proporcionó un token de autorización.',
      hint: 'Incluye el header: Authorization: Bearer <tu_token>'
    });
    return;
  }

  // El header debe tener formato "Bearer TOKEN"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    res.status(401).json({
      message: 'Formato de token inválido.',
      hint: 'Usa el formato: Authorization: Bearer <tu_token>'
    });
    return;
  }

  const token = parts[1];

  try {
    // Verificar y decodificar el token usando el JWT_SECRET
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Adjuntar el payload al objeto request para que los controladores lo usen
    req.auth = decoded;
    next(); // Pasar al siguiente middleware o controlador
  } catch (error) {
    // Token inválido (firma incorrecta) o expirado (después de 24h)
    res.status(401).json({
      message: 'Token inválido o expirado.',
      hint: 'Vuelve a iniciar sesión para obtener un nuevo token.'
    });
    return;
  }
};

/**
 * requireAdmin — Middleware para restringir acceso solo a Jefes de Familia
 *
 * Debe usarse DESPUÉS de verifyToken:
 *   router.patch('/nombre', verifyToken, requireAdmin, miControlador);
 *
 * Respuestas de error:
 *   403 — El usuario está autenticado pero no tiene rol 'admin'
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({
      message: 'Acceso restringido. Solo el Jefe de Familia puede realizar esta acción.'
    });
    return;
  }
  next();
};
