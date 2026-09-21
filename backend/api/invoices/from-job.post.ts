// server/api/invoices/from-job.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { z } from 'zod'
import { requireUser } from '../../utils/authGuard'
import { createInvoiceFromJob } from '../../utils/invoiceStore'

const fromJobSchema = z.object({
  jobId: z.string().optional().default('job_1'),
  jobName: z.string().min(1, 'Job name is required.'),
  jobDescription: z.string().optional(),
  clientName: z.string().optional(),
  clientContact: z.string().optional(),
  quoteAmount: z.number().optional(),
  hoursWorked: z.number().optional(),
  rate: z.number().optional(),
})

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const body = await readBody(event)
  const parseResult = fromJobSchema.safeParse(body)
  if (!parseResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: parseResult.error.errors[0]?.message || 'Invalid job data.',
    })
  }

  const { jobId, jobName, jobDescription, clientName, clientContact, quoteAmount, hoursWorked, rate } = parseResult.data

  const invoice = createInvoiceFromJob({
    id: jobId,
    name: jobName,
    description: jobDescription,
    clientName,
    clientContact,
    quoteAmount,
    hoursWorked,
    rate,
  }, String(user.id))

  return {
    success: true,
    message: `Invoice ${invoice.invoiceNumber} created from job "${jobName}".`,
    invoice,
  }
})
