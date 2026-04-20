import { z } from 'zod';

export const widgetSchema = z.object({
  id:       z.string().uuid(),
  type:     z.enum(['stat', 'pie', 'line', 'bar', 'table', 'bank_breakdown']),
  enabled:  z.boolean(),
  position: z.number().int().min(0),
  colSpan:  z.number().int().min(1).max(12).default(12),
  rowSpan:  z.number().int().min(1).max(4).default(1),
  config:   z.record(z.unknown()),
});

export const saveDashboardConfigSchema = z.object({
  widgets: z.array(widgetSchema),
});

export type Widget = z.infer<typeof widgetSchema>;
export type SaveDashboardConfigInput = z.infer<typeof saveDashboardConfigSchema>;
