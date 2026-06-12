import { z } from 'zod'

export const columnTypeSchema = z.enum(['string', 'date', 'enum', 'decimal', 'integer'])

export const reportColumnSchema = z.object({
  name: z.string(),
  type: columnTypeSchema,
})

const reportRowSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]))

const queryScopingSchema = z.object({
  scope: z.string(),
  ambiguous: z.boolean(),
  candidates: z.array(z.string()),
})

const reportMetaSchema = z.object({
  row_count: z.number(),
  truncated: z.boolean(),
  limit: z.number().optional(),
  limit_defaulted: z.boolean().optional(),
  unsupported_note: z.string().nullable(),
  query_scoping: queryScopingSchema.optional(),
  sql_debug: z.string().optional(),
})

export const reportEnvelopeSchema = z.object({
  spec: z.record(z.string(), z.unknown()),
  title: z.string().nullable(),
  data: z.array(reportRowSchema),
  columns: z.array(reportColumnSchema),
  meta: reportMetaSchema,
})

export const reportErrorSchema = z.object({
  error: z.object({
    code: z.enum(['validation_failed', 'bad_request', 'timeout', 'upstream_error', 'internal']),
    message: z.string().optional(),
    details: z.array(z.string()).optional(),
  }),
})

export type ColumnType = z.infer<typeof columnTypeSchema>
export type ReportColumn = z.infer<typeof reportColumnSchema>
export type ReportRow = z.infer<typeof reportRowSchema>
export type ReportMeta = z.infer<typeof reportMetaSchema>
export type ReportEnvelope = z.infer<typeof reportEnvelopeSchema>
export type ReportError = z.infer<typeof reportErrorSchema>
