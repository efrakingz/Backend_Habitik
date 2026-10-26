import { Router } from 'express';
import { createBillsController } from '../controllers/billsController';
import { verifyToken } from '../middleware/auth';
import { BillsService, billsService } from '../services/billsService';

export function createBillsRouter(service: BillsService = billsService): Router {
  const router = Router();
  const controller = createBillsController(service);
  router.post('/', verifyToken, controller.create);
  router.get('/', verifyToken, controller.list);
  router.delete('/:id', verifyToken, controller.remove);
  return router;
}

export default createBillsRouter();
