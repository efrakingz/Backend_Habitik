import { Router } from 'express';
import { InspeccionController } from '../controllers/inspeccionController';
import { uploadInspeccion } from '../middleware/uploadMiddleware';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.use(verifyToken);

// Middleware para atrapar errores de Multer (tamaño, tipo de archivo)
router.post(
  '/evidencia',
  (req, res, next) => {
    uploadInspeccion.single('foto')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ ok: false, error: err.message });
      }
      next();
    });
  },
  InspeccionController.enviarEvidencia
);

// Gestión del Jefe de Hogar
router.get('/pendientes', InspeccionController.listarPendientes);
router.post('/aprobar', InspeccionController.aprobar);
router.post('/rechazar', InspeccionController.rechazar);

export default router;