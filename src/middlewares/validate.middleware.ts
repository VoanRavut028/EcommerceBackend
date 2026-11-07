import type { NextFunction, Request, Response } from "express";
import { z, type ZodType } from "zod";

export function validateBody<TSchema extends ZodType>(schema: TSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: "Invalid request body",
        errors: z.flattenError(result.error),
      });
      return;
    }

    req.body = result.data;
    next();
  };
}

export const validateProduct = validateBody;
