import { Router } from 'express';
import { NotificationController } from '../controllers/notificationController';

const router = Router();

// Rutas REST para notificaciones y alertas
router.post('/evento', NotificationController.sendEvent);
router.post('/eventos', NotificationController.sendEvent);

router.get('/familia/:family_id', NotificationController.getFamilyNotifications);
router.get('/familia/:family_id/eventos', NotificationController.getFamilyNotifications);

router.delete('/familia/:family_id', NotificationController.clearFamilyNotifications);
router.delete('/familia/:family_id/eventos', NotificationController.clearFamilyNotifications);

router.patch('/:id/leida', NotificationController.markRead);

export default router;
