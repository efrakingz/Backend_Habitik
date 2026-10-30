import { Request, Response } from 'express';
import { InspeccionService } from '../services/inspeccionService';
import { pool } from '../config/db';

export class InspeccionController {
  // POST /reto/inspeccion/evidencia (Multipart / Form-Data)
  static async enviarEvidencia(req: Request, res: Response) {
    try {
      const userId = (req as any).auth?.user_id || (req as any).user?.id;
      let familyId = (req as any).auth?.family_id || (req as any).user?.family_id;
      const { titulo_mision } = req.body;

      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Se requiere autenticación de usuario.' });
      }

      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'Debes incluir un archivo de imagen (campo: foto).' });
      }

      if (!titulo_mision) {
        return res.status(400).json({ ok: false, error: 'Falta parámetro requerido: titulo_mision.' });
      }

      // Si family_id no viene en el token JWT, buscarlo de forma segura en la base de datos
      if (!familyId) {
        const profRes = await pool.query('SELECT family_id FROM public.profiles WHERE id = $1', [userId]);
        familyId = profRes.rows[0]?.family_id;
      }

      if (!familyId) {
        return res.status(400).json({ ok: false, error: 'El usuario no está asignado a un hogar familiar.' });
      }

      // Construcción de la URL pública alojada forzando HTTPS en entornos remotos
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.get('host');
      const fotoUrl = `${protocol}://${host}/uploads/inspecciones/${req.file.filename}`;

      const resultado = await InspeccionService.enviarEvidencia(userId, familyId, titulo_mision, fotoUrl);

      return res.status(201).json({
        ok: true,
        mensaje: 'Evidencia subida y enviada a validación del Jefe de Hogar.',
        data: resultado
      });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }

  static async listarPendientes(req: Request, res: Response) {
    try {
      const userId = (req as any).auth?.user_id || (req as any).user?.id;
      let familyId = (req as any).auth?.family_id || (req as any).user?.family_id;

      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Se requiere autenticación de usuario.' });
      }

      if (!familyId) {
        const profRes = await pool.query('SELECT family_id FROM public.profiles WHERE id = $1', [userId]);
        familyId = profRes.rows[0]?.family_id;
      }

      if (!familyId) {
        return res.status(400).json({ ok: false, error: 'No perteneces a ningún hogar familiar.' });
      }

      const pendientes = await InspeccionService.obtenerPendientesFamilia(String(familyId));
      return res.status(200).json({ ok: true, data: pendientes });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }

  static async aprobar(req: Request, res: Response) {
    try {
      const jefeId = (req as any).auth?.user_id || (req as any).user?.id;
      const { evidencia_id } = req.body;

      if (!jefeId) {
        return res.status(401).json({ ok: false, error: 'Se requiere autenticación.' });
      }

      if (!evidencia_id) {
        return res.status(400).json({ ok: false, error: 'Falta evidencia_id.' });
      }

      const resultado = await InspeccionService.aprobarEvidencia(jefeId, evidencia_id);
      return res.status(200).json({ ok: true, data: resultado });
    } catch (error: any) {
      return res.status(400).json({ ok: false, error: error.message });
    }
  }

  static async rechazar(req: Request, res: Response) {
    try {
      const jefeId = (req as any).auth?.user_id || (req as any).user?.id;
      const { evidencia_id, motivo } = req.body;

      if (!jefeId) {
        return res.status(401).json({ ok: false, error: 'Se requiere autenticación.' });
      }

      if (!evidencia_id) {
        return res.status(400).json({ ok: false, error: 'Falta evidencia_id.' });
      }

      const resultado = await InspeccionService.rechazarEvidencia(jefeId, evidencia_id, motivo);
      return res.status(200).json({ ok: true, data: resultado });
    } catch (error: any) {
      return res.status(400).json({ ok: false, error: error.message });
    }
  }
}
