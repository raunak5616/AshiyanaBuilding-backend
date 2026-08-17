import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createSlideSchema = {
  body: z.object({
    categoryId: z
      .string()
      .regex(objectIdRegex, 'Invalid category ID')
      .optional()
      .or(z.literal(''))
      .transform((val) => (val === '' ? undefined : val)),
  }),
};

export const slideIdParamsSchema = {
  params: z.object({
    id: z.string().regex(objectIdRegex, 'Invalid slide ID'),
  }),
};
