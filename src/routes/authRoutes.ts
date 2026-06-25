import { Router } from 'express';
import { register, login } from '../controllers/authController';

const router = Router();

// HU 5.1 + HU 1.1: Registro de Jefe de Familia y creación de Hogar
router.post('/register', register);

// HU 5.1: Inicio de sesión
router.post('/login', login);

export default router;
