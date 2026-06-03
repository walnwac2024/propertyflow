import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';

async function seed() {
  const passwordHash = await bcrypt.hash('Admin@12345', 12);

  await pool.query(`
    INSERT INTO companies (id, name, email, phone, address, status)
    VALUES (1, 'PropertyFlow Management', 'admin@propertyflow.local', '+92 300 0000000', 'Local PropertyFlow Office', 'active')
    ON DUPLICATE KEY UPDATE name = VALUES(name)
  `);

  await pool.query(
    `INSERT INTO users (company_id, name, email, password_hash, role, status)
     VALUES (1, 'Super Admin', 'admin@propertyflow.local', ?, 'super_admin', 'active')
     ON DUPLICATE KEY UPDATE role = 'super_admin', status = 'active'`,
    [passwordHash]
  );

  await pool.query(`
    INSERT IGNORE INTO billing_categories (company_id, name, category_type)
    VALUES
      (1, 'Electricity', 'utility'),
      (1, 'Water', 'utility'),
      (1, 'Gas', 'utility'),
      (1, 'Maintenance', 'maintenance'),
      (1, 'Service Charges', 'service'),
      (1, 'Rent', 'rent')
  `);

  await pool.query(`
    INSERT IGNORE INTO expense_categories (company_id, name)
    VALUES
      (1, 'Repairs'),
      (1, 'Security'),
      (1, 'Cleaning'),
      (1, 'Utilities'),
      (1, 'Administration')
  `);

  console.log('PropertyFlow seed complete. Login: admin@propertyflow.local / Admin@12345');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
