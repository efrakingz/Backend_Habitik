import { Router } from 'express';
import { FeedController } from '../controllers/FeedController';
import { verifyToken } from '../middleware/auth';

const router = Router();

// GET /feed
router.get('/', verifyToken, FeedController.listarFeed);

export default router;