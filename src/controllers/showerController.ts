import { Request, Response } from 'express';
import { ShowerService } from '../services/showerService';

const showerService = new ShowerService();

/**
 * ============================================================
 * CONTROLADOR DE DUCHA (RETO) — /reto
 * ============================================================
 *
 * Recibe y valida el registro del cronómetro de ducha del usuario.
 *
 * 📦 DATOS GUARDADOS EN LA BD:
 *   public.shower_logs → user_id, duracion_segundos, estado ('valido'|'invalido')
 *
 * 🛡️  VALIDACIÓN ANTI-TRAMPA (CA-2.1-2):
 *   Si la duración registrada es MENOR A 180 SEGUNDOS (3 minutos),
 *   el registro se guarda con estado = 'invalido'.
 *   De esta forma queda registrado el intento pero no cuenta para métricas.
 *   La respuesta HTTP sigue siendo 200, pero incluye valido: false.
 *
 * 💡 LÓGICA EN EL FRONTEND:
 *   1. El usuario abre la pantalla de ducha → inicia el cronómetro en el dispositivo
 *   2. Al terminar la ducha → el frontend envía el tiempo medido a este endpoint
 *   3. El backend valida y guarda el registro
 *   4. Si valido: false → mostrar mensaje de "ducha muy corta, inténtalo de nuevo"
 *   5. Si valido: true  → mostrar animación de éxito / otorgar recompensa
 */

/**
 * POST /reto/ducha
 *
 * ✅ Registra la duración de una ducha cronometrada.
 *
 * 🔐 REQUIERE: JWT válido (cualquier usuario autenticado)
 *    El user_id se extrae automáticamente del token JWT.
 *
 * 📥 BODY ESPERADO (JSON):
 * {
 *   "duracion_segundos": 420   // número entero positivo — segundos medidos por el app
 * }
 *
 * 📤 RESPUESTA EXITOSA — Ducha VÁLIDA (201):
 * {
 *   "message": "Ducha registrada exitosamente: 7m 0s.",
 *   "log": {
 *     "id":                 "uuid-del-registro",
 *     "user_id":            "uuid-del-usuario",
 *     "duracion_segundos":  420,
 *     "estado":             "valido",
 *     "created_at":         "2025-01-15T10:30:00Z"
 *   },
 *   "valido": true
 * }
 *
 * 📤 RESPUESTA — Ducha INVÁLIDA por anti-trampa (200):
 * {
 *   "message":  "Registro guardado, pero marcado como inválido. La ducha fue menor a 3 minutos.",
 *   "log": { ... "estado": "invalido" ... },
 *   "valido":   false,
 *   "razon":    "La duración mínima válida es de 3 minutos (180 segundos)."
 * }
 *
 * ❌ ERRORES:
 *   400 — duracion_segundos no fue enviado o no es un número positivo
 *   401 — Token JWT inválido/expirado
 *   500 — Error interno del servidor
 */
export const registerShower = async (req: Request, res: Response): Promise<void> => {
  // El user_id lo extraemos del token JWT, no del body (más seguro)
  const userId = req.auth?.user_id;

  if (!userId) {
    res.status(401).json({ message: 'No autenticado.' });
    return;
  }

  const { duracion_segundos } = req.body;

  if (duracion_segundos === undefined || duracion_segundos === null) {
    res.status(400).json({
      message: 'El campo duracion_segundos es requerido.',
      hint: 'Envía el tiempo medido en segundos: { "duracion_segundos": 420 }'
    });
    return;
  }

  const duracion = Number(duracion_segundos);

  if (isNaN(duracion) || duracion <= 0) {
    res.status(400).json({
      message: 'duracion_segundos debe ser un número entero positivo.'
    });
    return;
  }

  try {
    // El servicio aplica la regla anti-trampa y guarda en public.shower_logs
    const log = await showerService.registerShowerTime(userId, duracion);

    if (log.estado === 'invalido') {
      // Ducha válida en tiempo real pero muy corta (< 3 min) → anti-trampa activado
      res.status(200).json({
        message: 'Registro guardado, pero marcado como inválido. La ducha fue menor a 3 minutos.',
        log,
        valido: false,
        razon: 'La duración mínima válida es de 3 minutos (180 segundos).'
      });
    } else {
      // Ducha válida → puede contar para métricas de ahorro
      const minutos = Math.floor(duracion / 60);
      const segundos = duracion % 60;
      res.status(201).json({
        message: `Ducha registrada exitosamente: ${minutos}m ${segundos}s.`,
        log,
        valido: true
      });
    }
  } catch (error) {
    console.error('[showerController.registerShower]', error);
    res.status(500).json({ message: 'Error interno al registrar la ducha.' });
  }
};
