import { pool } from '../config/db.js';
import { schema } from './schema.js';

async function migrate() {
  for (const statement of schema) {
    await pool.query(statement);
  }
  const [columns] = await pool.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'employee_payroll'
      AND COLUMN_NAME = 'employee_id'
  `);
  if (!columns.length) {
    await pool.query(`ALTER TABLE employee_payroll ADD COLUMN employee_id BIGINT UNSIGNED NULL AFTER project_id`);
    await pool.query(`ALTER TABLE employee_payroll ADD INDEX idx_employee_payroll_employee (employee_id)`);
  }
  console.log(`PropertyFlow migration complete: ${schema.length} tables checked/created.`);
}

migrate()
  .catch((error) => {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
