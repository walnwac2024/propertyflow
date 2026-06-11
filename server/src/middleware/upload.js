import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { env } from '../config/env.js';

fs.mkdirSync(env.uploadDir, { recursive: true });

const allowedUploads = new Map([
  ['.jpg', ['image/jpeg']],
  ['.jpeg', ['image/jpeg']],
  ['.png', ['image/png']],
  ['.webp', ['image/webp']],
  ['.gif', ['image/gif']],
  ['.pdf', ['application/pdf']],
  ['.doc', ['application/msword']],
  ['.docx', ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
  ['.xls', ['application/vnd.ms-excel']],
  ['.xlsx', ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']],
  ['.csv', ['text/csv', 'application/csv', 'application/vnd.ms-excel']],
  ['.txt', ['text/plain']]
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, env.uploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedTypes = allowedUploads.get(ext);
    if (!allowedTypes || !allowedTypes.includes(file.mimetype)) {
      const error = new Error('Only images, PDFs, Office documents, CSV, and text files are allowed');
      error.status = 400;
      return cb(error);
    }
    cb(null, true);
  }
});
