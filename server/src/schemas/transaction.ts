import { z } from 'zod';

export const createTransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.number().finite('Amount must be finite'),
  type: z.enum(['income', 'expense', 'transfer']),
  categoryId: z.string().uuid('Invalid category ID').optional().nullable(),
});

export const updateTransactionSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .optional(),
  description: z.string().min(1).max(500).optional(),
  amount: z.number().finite().optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const listTransactionsQuerySchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
