import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const defaultJwtSecret = 'change-this-secret-before-production';
const defaultClientOrigin = process.env.NODE_ENV === 'production'
  ? 'https://proproperty.cloud'
  : 'http://localhost:5173';

function trustProxyValue() {
  const value = process.env.TRUST_PROXY || (process.env.NODE_ENV === 'production' ? '1' : '0');
  if (value === 'true') return true;
  if (value === 'false') return false;
  return Number(value);
}

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || defaultClientOrigin,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'propertyflow',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  },
  jwtSecret: process.env.JWT_SECRET || defaultJwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  trustProxy: trustProxyValue()
};

if (env.nodeEnv === 'production' && env.jwtSecret === defaultJwtSecret) {
  throw new Error('JWT_SECRET must be set to a strong unique value in production');
}
