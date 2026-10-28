import { Router } from 'express';
import { InspeccionController } from '../controllers/inspeccionController';
import { uploadInspeccion } from '../middleware/uploadMiddleware';
import { verifyToken } from '../middleware/auth';

const router = Router();

router.use(verifyToken);

// Carga de archivo directa mediante multipart/form-data
router.post('/evidencia', uploadInspeccion.single('foto'), InspeccionController.enviarEvidencia);

// Gestión del Jefe de Hogar
router.get('/pendientes', InspeccionController.listarPendientes);
router.post('/aprobar', InspeccionController.aprobar);
router.post('/rechazar', InspeccionController.rechazar);

export default router;