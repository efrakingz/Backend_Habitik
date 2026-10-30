import { Request, Response } from 'express';
import { InspeccionService } from '../services/inspeccionService';
import { resolveFamilyId, resolveUserId } from '../utils/requestContext';

export class InspeccionController {
  // POST /reto/inspeccion/evidencia (Multipart / Form-Data)
  static async enviarEvidencia(req: Request, res: Response) {
    try {
      const userId = resolveUserId(req);
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

      const familyId = await resolveFamilyId(req);
      if (!familyId) {
        return res.status(400).json({ ok: false, error: 'El usuario no está asignado a un hogar familiar.' });
      }

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
      const userId = resolveUserId(req);
      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Se requiere autenticación de usuario.' });
      }

      const familyId = await resolveFamilyId(req);
      if (!familyId) {
        return res.status(400).json({ ok: false, error: 'No perteneces a ningún hogar familiar.' });
      }

      const pendientes = await InspeccionService.obtenerPendientesFamilia(familyId);
      return res.status(200).json({ ok: true, data: pendientes });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }

  static async aprobar(req: Request, res: Response) {
    try {
      const jefeId = resolveUserId(req);
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
      const jefeId = resolveUserId(req);
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
