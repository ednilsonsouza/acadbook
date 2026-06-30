/**
 * Resolver customizado para Zod v4 + react-hook-form.
 * Necessário porque @hookform/resolvers@5.x tem incompatibilidade de tipos
 * com Zod 4.4.x (espera _zod.version.minor === 0).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { FieldValues, Resolver } from 'react-hook-form'
import type { ZodTypeAny } from 'zod'

export function createZodResolver<T extends FieldValues>(
  schema: ZodTypeAny,
): Resolver<T> {
  return (async (values: T) => {
    const result = await schema.safeParseAsync(values)

    if (result.success) {
      return { values: result.data as T, errors: {} }
    }

    const errors: Record<string, { type: string; message: string }> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join('.')
      if (path && !errors[path]) {
        errors[path] = { type: issue.code, message: issue.message }
      }
    }

    return { values: {} as any, errors: errors as any }
  }) as unknown as Resolver<T>
}
