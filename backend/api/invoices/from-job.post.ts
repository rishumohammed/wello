// server/api/invoices/from-job.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { createInvoiceFromJob } from '../../utils/invoiceStore'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const userId = body?.userId || 'u1'

  if (!body?.jobName) {
    throw createError({ statusCode: 400, statusMessage: 'Job name is required.' })
  }

  const invoice = createInvoiceFromJob({
    id: body.jobId || 'job_1',
    name: body.jobName,
    description: body.jobDescription,
    clientName: body.clientName,
    clientContact: body.clientContact,
    quoteAmount: body.quoteAmount,
    hoursWorked: body.hoursWorked,
    rate: body.rate,
  }, userId)

  return {
    success: true,
    message: `Invoice ${invoice.invoiceNumber} created from job "${body.jobName}".`,
    invoice,
  }
})
