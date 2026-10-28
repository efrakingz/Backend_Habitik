import { Request, Response } from 'express';
import { InspeccionService } from '../services/inspeccionService';

export class InspeccionController {
  // POST /reto/inspeccion/evidencia (Multipart / Form-Data)
  static async enviarEvidencia(req: Request, res: Response) {
    try {
      const userId = (req as any).auth?.user_id || req.body.user_id;
      const familyId = (req as any).auth?.family_id || req.body.family_id;
      const { titulo_mision } = req.body;

      if (!req.file) {
        return res.status(400).json({ ok: false, error: 'Debes incluir un archivo de imagen (campo: foto).' });
      }

      if (!userId || !familyId || !titulo_mision) {
        return res.status(400).json({ ok: false, error: 'Faltan parámetros requeridos (titulo_mision).' });
      }

      // Construcción de la URL pública alojada en Railway
      const protocol = req.protocol;
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
      const familyId = (req as any).auth?.family_id || req.query.family_id;
      if (!familyId) {
        return res.status(400).json({ ok: false, error: 'Se requiere family_id.' });
      }

      const pendientes = await InspeccionService.obtenerPendientesFamilia(String(familyId));
      return res.status(200).json({ ok: true, data: pendientes });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }

  static async aprobar(req: Request, res: Response) {
    try {
      const jefeId = (req as any).auth?.user_id || req.body.jefe_id;
      const { evidencia_id } = req.body;

      if (!jefeId || !evidencia_id) {
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
      const jefeId = (req as any).auth?.user_id || req.body.jefe_id;
      const { evidencia_id, motivo } = req.body;

      if (!jefeId || !evidencia_id) {
        return res.status(400).json({ ok: false, error: 'Falta evidencia_id o motivo.' });
      }

      const resultado = await InspeccionService.rechazarEvidencia(jefeId, evidencia_id, motivo);
      return res.status(200).json({ ok: true, data: resultado });
    } catch (error: any) {
      return res.status(400).json({ ok: false, error: error.message });
    }
  }
}