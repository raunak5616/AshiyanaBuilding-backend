import { z } from 'zod';

const rangeEnum = z.enum(['today', 'yesterday', 'thisWeek', 'thisMonth', 'thisYear', 'custom']).default('thisMonth');

export const getDashboardSchema = {
  query: z.object({
    range: rangeEnum,
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),
};
