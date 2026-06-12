import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import projectRoutes from './routes/projects.js';
import floorRoutes from './routes/floors.js';
import unitRoutes from './routes/units.js';
import contactRoutes from './routes/contacts.js';
import billingRoutes from './routes/billing.js';
import expenseRoutes from './routes/expenses.js';
import employeeRoutes from './routes/employees.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import { errorHandler, notFound } from './middleware/error.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.set('trust proxy', env.trustProxy);
app.use(helmet());
app.use(cors({ origin: env.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use('/uploads', express.static(path.resolve(__dirname, '../../', env.uploadDir)));

app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'PropertyFlow' }));
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/floors', floorRoutes);
app.use('/api/units', unitRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`PropertyFlow API running on http://localhost:${env.port}/api`);
});
