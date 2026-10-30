import { Request, Response } from 'express';
import { PasswordResetError, PasswordResetService } from '../services/passwordResetService';

/**
 * ============================================================
 * CONTROLADOR DE RECUPERACIÓN DE CONTRASEÑA — /auth
 * Delega la lógica de negocio y consultas en PasswordResetService
 * ============================================================
 */

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await PasswordResetService.requestResetCode(req.body);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof PasswordResetError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    console.error('[passwordResetController.forgotPassword]', error);
    res.status(500).json({ message: 'Error interno al procesar la solicitud de recuperación.' });
  }
};

export const verifyResetCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await PasswordResetService.verifyCode(req.body);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof PasswordResetError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    console.error('[passwordResetController.verifyResetCode]', error);
    res.status(500).json({ message: 'Error interno al verificar el código.' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await PasswordResetService.resetPasswordWithCode(req.body);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof PasswordResetError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    console.error('[passwordResetController.resetPassword]', error);
    res.status(500).json({ message: 'Error interno al restablecer la contraseña.' });
  }
};
