// backend/utils/invoiceSequenceService.ts
import { Knex } from 'knex'
import { getDb } from './db'

export interface SequenceConfig {
  prefix?: string
  formatPattern?: string // e.g. '{{prefix}}-{{year}}-{{seq:4}}' or 'INV-{{seq:5}}'
}

/**
 * Formats a sequence string by interpolating tokens:
 * {{prefix}}, {{year}}, {{seq:N}} (where N is zero-pad length, default 4)
 */
export function formatSequence(pattern: string, prefix: string, year: number, seqNumber: number): string {
  let result = pattern || '{{prefix}}-{{year}}-{{seq:4}}'
  result = result.replace(/\{\{prefix\}\}/gi, prefix)
  result = result.replace(/\{\{year\}\}/gi, String(year))

  const seqMatch = result.match(/\{\{seq(?::(\d+))?\}\}/i)
  if (seqMatch) {
    const padLen = seqMatch[1] ? parseInt(seqMatch[1], 10) : 4
    const padded = String(seqNumber).padStart(padLen, '0')
    result = result.replace(seqMatch[0], padded)
  } else {
    // Fallback if no seq token
    result += `-${String(seqNumber).padStart(4, '0')}`
  }

  return result
}

/**
 * Concurrency-safe, gapless invoice number generator using row-level locking.
 * Executes inside the provided Knex transaction (or creates one).
 */
export async function getNextInvoiceNumber(
  userId: number | string,
  config?: SequenceConfig,
  trx?: Knex.Transaction
): Promise<{ invoiceNumber: string; seqNumber: number }> {
  const runner = async (t: Knex.Transaction) => {
    const currentYear = new Date().getFullYear()
    const prefix = (config?.prefix || 'INV').trim().toUpperCase()
    const pattern = (config?.formatPattern || '{{prefix}}-{{year}}-{{seq:4}}').trim()

    // Query sequence row with FOR UPDATE lock
    let seqRow = await t('invoice_sequences')
      .where({ user_id: Number(userId), prefix, year: currentYear })
      .forUpdate()
      .first()

    if (!seqRow) {
      // Check if user has any sequence record to inherit format_pattern from
      const anySeq = await t('invoice_sequences')
        .where({ user_id: Number(userId) })
        .orderBy('id', 'desc')
        .first()

      const inheritedPattern = pattern || anySeq?.format_pattern || '{{prefix}}-{{year}}-{{seq:4}}'

      // Insert new row starting at next_number = 1
      await t('invoice_sequences').insert({
        user_id: Number(userId),
        prefix,
        year: currentYear,
        format_pattern: inheritedPattern,
        next_number: 1,
        created_at: new Date(),
        updated_at: new Date(),
      })

      seqRow = await t('invoice_sequences')
        .where({ user_id: Number(userId), prefix, year: currentYear })
        .forUpdate()
        .first()
    }

    const currentSeq = Number(seqRow.next_number) || 1
    const activePattern = pattern || seqRow.format_pattern || '{{prefix}}-{{year}}-{{seq:4}}'
    const invoiceNumber = formatSequence(activePattern, prefix, currentYear, currentSeq)

    // Increment sequence atomically
    await t('invoice_sequences')
      .where({ id: seqRow.id })
      .update({
        next_number: currentSeq + 1,
        format_pattern: activePattern,
        updated_at: new Date(),
      })

    return {
      invoiceNumber,
      seqNumber: currentSeq,
    }
  }

  if (trx) {
    return runner(trx)
  }

  const db = getDb()
  return db.transaction(runner)
}

/**
 * Concurrency-safe, gapless credit note number generator.
 */
export async function getNextCreditNoteNumber(
  userId: number | string,
  trx?: Knex.Transaction
): Promise<{ creditNoteNumber: string; seqNumber: number }> {
  const runner = async (t: Knex.Transaction) => {
    const currentYear = new Date().getFullYear()
    const prefix = 'CN'

    let seqRow = await t('invoice_sequences')
      .where({ user_id: Number(userId), prefix, year: currentYear })
      .forUpdate()
      .first()

    if (!seqRow) {
      await t('invoice_sequences').insert({
        user_id: Number(userId),
        prefix,
        year: currentYear,
        format_pattern: '{{prefix}}-{{year}}-{{seq:4}}',
        next_number: 1,
        created_at: new Date(),
        updated_at: new Date(),
      })

      seqRow = await t('invoice_sequences')
        .where({ user_id: Number(userId), prefix, year: currentYear })
        .forUpdate()
        .first()
    }

    const currentSeq = Number(seqRow.next_number) || 1
    const creditNoteNumber = formatSequence('{{prefix}}-{{year}}-{{seq:4}}', prefix, currentYear, currentSeq)

    await t('invoice_sequences')
      .where({ id: seqRow.id })
      .update({
        next_number: currentSeq + 1,
        updated_at: new Date(),
      })

    return {
      creditNoteNumber,
      seqNumber: currentSeq,
    }
  }

  if (trx) {
    return runner(trx)
  }

  const db = getDb()
  return db.transaction(runner)
}
