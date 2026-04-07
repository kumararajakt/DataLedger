import 'dotenv/config';
import { pool } from './pool';

interface SystemCategory {
  name: string;
  type: string;
  color: string;
  icon: string;
}

interface SystemRule {
  keyword: string;
  categoryName: string;
}

const SYSTEM_CATEGORIES: SystemCategory[] = [
  { name: 'Salary', type: 'Income', color: '#22C55E', icon: '💰' },
  { name: 'Food & Dining', type: 'Expense', color: '#F97316', icon: '🍔' },
  { name: 'Entertainment', type: 'Expense', color: '#A855F7', icon: '🎬' },
  { name: 'Shopping', type: 'Expense', color: '#EC4899', icon: '🛍️' },
  { name: 'Transportation', type: 'Expense', color: '#3B82F6', icon: '🚗' },
  { name: 'Utilities', type: 'Expense', color: '#EAB308', icon: '💡' },
  { name: 'Healthcare', type: 'Expense', color: '#EF4444', icon: '🏥' },
  { name: 'Income', type: 'Income', color: '#22C55E', icon: '💵' },
  { name: 'Transfer', type: 'Transfer', color: '#6B7280', icon: '🔄' },
  { name: 'Cash Withdrawal', type: 'Expense', color: '#9CA3AF', icon: '💸' },
  { name: 'Loan Repayment', type: 'Expense', color: '#92400E', icon: '📉' },
  { name: 'Investments', type: 'Expense', color: '#059669', icon: '📈' },
  { name: 'Other', type: 'Expense', color: '#6B7280', icon: '❓' },
];

const SYSTEM_RULES: SystemRule[] = [
  { keyword: 'swiggy', categoryName: 'Food & Dining' },
  { keyword: 'zomato', categoryName: 'Food & Dining' },
  { keyword: 'netflix', categoryName: 'Entertainment' },
  { keyword: 'spotify', categoryName: 'Entertainment' },
  { keyword: 'amazon', categoryName: 'Shopping' },
  { keyword: 'flipkart', categoryName: 'Shopping' },
  { keyword: 'uber', categoryName: 'Transportation' },
  { keyword: 'ola', categoryName: 'Transportation' },
  { keyword: 'petrol', categoryName: 'Transportation' },
  { keyword: 'salary', categoryName: 'Salary' },
  { keyword: 'credited', categoryName: 'Income' },
  { keyword: 'interest', categoryName: 'Income' },
  { keyword: 'atm', categoryName: 'Cash Withdrawal' },
  { keyword: 'cash withdrawal', categoryName: 'Cash Withdrawal' },
  { keyword: 'emi', categoryName: 'Loan Repayment' },
  { keyword: 'hdfc emi', categoryName: 'Loan Repayment' },
  { keyword: 'mutual fund', categoryName: 'Investments' },
  { keyword: 'sip', categoryName: 'Investments' },
  { keyword: 'electricity', categoryName: 'Utilities' },
  { keyword: 'airtel', categoryName: 'Utilities' },
  { keyword: 'jio', categoryName: 'Utilities' },
];

async function seed(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log('Seeding system categories...');

    // Insert system categories that don't already exist
    for (const cat of SYSTEM_CATEGORIES) {
      const result = await client.query(
        `INSERT INTO categories (name, color, icon, is_system, user_id)
         VALUES ($1, $2, $3, true, NULL)
         ON CONFLICT (name) WHERE is_system = true AND user_id IS NULL
         DO NOTHING
         RETURNING id, name`,
        [cat.name, cat.color, cat.icon]
      );

      if (result.rowCount && result.rowCount > 0) {
        console.log(`  ✓ Created system category: ${cat.name}`);
      } else {
        console.log(`  - System category already exists: ${cat.name}`);
      }
    }

    console.log('\nSeeding system categorization rules...');

    for (const rule of SYSTEM_RULES) {
      // Find the system category by name
      const catResult = await client.query(
        `SELECT id FROM categories WHERE name = $1 AND is_system = true AND user_id IS NULL`,
        [rule.categoryName]
      );

      if (catResult.rows.length === 0) {
        console.warn(`  ⚠ Category not found for rule: ${rule.keyword} -> ${rule.categoryName}`);
        continue;
      }

      const categoryId = catResult.rows[0].id;

      // Check if rule already exists
      const existingRule = await client.query(
        `SELECT id FROM categorization_rules
         WHERE keyword = $1 AND user_id IS NULL AND category_id = $2`,
        [rule.keyword, categoryId]
      );

      if (existingRule.rows.length === 0) {
        await client.query(
          `INSERT INTO categorization_rules (keyword, category_id, priority, user_id)
           VALUES ($1, $2, 0, NULL)`,
          [rule.keyword, categoryId]
        );
        console.log(`  ✓ Created rule: "${rule.keyword}" -> ${rule.categoryName}`);
      } else {
        console.log(`  - Rule already exists: "${rule.keyword}" -> ${rule.categoryName}`);
      }
    }

    console.log('\nSeeding completed successfully.');
  } catch (err) {
    console.error('Seeding failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed script failed:', err);
  process.exit(1);
});
