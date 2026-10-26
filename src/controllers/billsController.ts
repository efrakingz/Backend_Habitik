import { Request, Response } from 'express';
import { BillValidationError } from '../services/billValidation';
import { BillFamilyConflictError, BillNotFoundError, BillPermissionError, BillsService, billsService } from '../services/billsService';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createBillsController(service: BillsService = billsService) {
  const handleError = (error: unknown, res: Response) => {
    if (error instanceof BillValidationError) return res.status(400).json({ message: error.message });
    if (error instanceof BillPermissionError) return res.status(403).json({ message: error.message });
    if (error instanceof BillFamilyConflictError) return res.status(409).json({ message: error.message });
    if (error instanceof BillNotFoundError) return res.status(404).json({ message: error.message });
    return res.status(500).json({ message: 'Error interno al procesar la boleta.' });
  };

  return {
    create: async (req: Request, res: Response) => {
      try {
        const bill = await service.create(req.auth!.user_id, req.body);
        return res.status(201).json(bill);
      } catch (error) {
        return handleError(error, res);
      }
    },
    list: async (req: Request, res: Response) => {
      try {
        const bills = await service.list(req.auth!.user_id, req.query);
        return res.status(200).json(bills);
      } catch (error) {
        return handleError(error, res);
      }
    },
    remove: async (req: Request, res: Response) => {
      if (!uuidPattern.test(req.params.id)) return res.status(400).json({ message: 'id debe ser un UUID válido.' });
      try {
        await service.remove(req.auth!.user_id, req.params.id);
        return res.status(204).send();
      } catch (error) {
        return handleError(error, res);
      }
    },
  };
}
