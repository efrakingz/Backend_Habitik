import { Router } from 'express';
import { submitOnboarding } from '../controllers/onboardingController';
import { verifyToken } from '../middleware/auth';

const router = Router();

// HU 1.3: Onboarding con encuesta condicional por rol
router.post('/', verifyToken, submitOnboarding);

export default router;
