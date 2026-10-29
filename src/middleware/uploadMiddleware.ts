import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Asegurar que exista el directorio de destino
const uploadDir = path.join(__dirname, '../../uploads/inspecciones');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const userId = (req as any).auth?.user_id || 'user';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `inspeccion_${userId}_${timestamp}${ext}`);
  }
});

export const uploadInspeccion = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Límite de seguridad: 5 MB
  fileFilter: (_req, file, cb) => {
    const isImageMime = file.mimetype.startsWith('image/');
    const isImageExt = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.originalname);

    if (isImageMime || isImageExt) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen (.jpg, .jpeg, .png, .webp).'));
    }
  }
});