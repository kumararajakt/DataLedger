import { z } from 'zod';

export const createBudgetSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  month: z
    .string()
    .regex(
      /^\d{4}-\d{2}-01$/,
      'Month must be in YYYY-MM-01 format (first of month)'
    ),
  amount: z.number().positive('Amount must be positive').finite(),
});

export const updateBudgetSchema = z.object({
  amount: z.number().positive('Amount must be positive').finite(),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
