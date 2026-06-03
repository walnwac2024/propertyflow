import { ZodError } from 'zod';

export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error, req, res, next) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      details: error.errors.map((item) => ({
        field: item.path.join('.'),
        message: item.message
      }))
    });
  }

  const status = error.status || 500;
  const message = status === 500 ? 'Internal server error' : error.message;
  if (process.env.NODE_ENV !== 'test') {
    console.error(error);
  }
  res.status(status).json({ message, details: error.details });
}
