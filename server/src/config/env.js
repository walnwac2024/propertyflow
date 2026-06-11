import dotenv from 'dotenv';

dotenv.config();

const defaultJwtSecret = 'change-this-secret-before-production';

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'propertyflow',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  },
  jwtSecret: process.env.JWT_SECRET || defaultJwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  uploadDir: process.env.UPLOAD_DIR || 'uploads'
};

if (env.nodeEnv === 'production' && env.jwtSecret === defaultJwtSecret) {
  throw new Error('JWT_SECRET must be set to a strong unique value in production');
}
