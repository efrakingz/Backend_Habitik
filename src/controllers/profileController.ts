import { Request, Response } from 'express';
import { ProfileService } from '../services/profileService';

export class ProfileController {
  // PUT /perfil/editar
  static async editarPerfil(req: Request, res: Response) {
    try {
      const userId = (req as any).auth?.user_id || (req as any).user?.id;
      const { nombre, color, letra, url, telefono } = req.body;

      if (!userId) {
        return res.status(401).json({ ok: false, error: 'Se requiere autenticación de usuario.' });
      }

      if (!nombre && !color && !letra && url === undefined && telefono === undefined) {
        return res.status(400).json({
          ok: false,
          error: 'Debes proporcionar al menos un campo a modificar (nombre, color, letra, url o telefono).'
        });
      }

      const perfilActualizado = await ProfileService.actualizarPerfil(userId, nombre, color, letra, url, telefono);

      return res.status(200).json({
        ok: true,
        mensaje: 'Perfil y avatar actualizados exitosamente.',
        data: perfilActualizado
      });
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message });
    }
  }
}
