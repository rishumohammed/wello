// backend/database/migrations/20260921000016_admin_security_and_audit_chain.cjs

/**
 * Migration: Admin Console Security, Financial Isolation & Tamper-Evident Audit Chain
 * - Expands audit_logs with previous_hash, hash, actor_email, permission_used, reason, user_agent, diff_json
 * - Extends auth_sessions for time-boxed, read-only user impersonation
 * - Extends projects for job moderation flag handling
 * - Registers new permissions (users.financial_view, users.impersonate, analytics.export)
 */
exports.up = async function (knex) {
  // 1. EXTEND audit_logs FOR CRYPTOGRAPHIC CHAIN INTEGRITY
  const hasAuditLogs = await knex.schema.hasTable('audit_logs')
  if (hasAuditLogs) {
    const hasActorEmail = await knex.schema.hasColumn('audit_logs', 'actor_email')
    const hasActorId = await knex.schema.hasColumn('audit_logs', 'actor_id')
    const hasPermUsed = await knex.schema.hasColumn('audit_logs', 'permission_used')
    const hasReason = await knex.schema.hasColumn('audit_logs', 'reason')
    const hasUserAgent = await knex.schema.hasColumn('audit_logs', 'user_agent')
    const hasDiffJson = await knex.schema.hasColumn('audit_logs', 'diff_json')
    const hasPrevHash = await knex.schema.hasColumn('audit_logs', 'previous_hash')
    const hasHash = await knex.schema.hasColumn('audit_logs', 'hash')

    await knex.schema.alterTable('audit_logs', (table) => {
      if (!hasActorEmail) table.string('actor_email', 255).nullable()
      if (!hasActorId) table.integer('actor_id').unsigned().nullable()
      if (!hasPermUsed) table.string('permission_used', 100).nullable()
      if (!hasReason) table.text('reason').nullable()
      if (!hasUserAgent) table.string('user_agent', 500).nullable()
      if (!hasDiffJson) table.json('diff_json').nullable()
      if (!hasPrevHash) table.string('previous_hash', 64).notNullable().defaultTo('0000000000000000000000000000000000000000000000000000000000000000')
      if (!hasHash) table.string('hash', 64).notNullable().defaultTo('0000000000000000000000000000000000000000000000000000000000000000')
    })
  }

  // 2. EXTEND auth_sessions FOR READ-ONLY IMPERSONATION
  const hasAuthSessions = await knex.schema.hasTable('auth_sessions')
  if (hasAuthSessions) {
    const hasIsImp = await knex.schema.hasColumn('auth_sessions', 'is_impersonation')
    const hasImpEmail = await knex.schema.hasColumn('auth_sessions', 'impersonator_email')
    const hasImpId = await knex.schema.hasColumn('auth_sessions', 'impersonator_id')
    const hasImpReason = await knex.schema.hasColumn('auth_sessions', 'impersonation_reason')

    await knex.schema.alterTable('auth_sessions', (table) => {
      if (!hasIsImp) table.boolean('is_impersonation').notNullable().defaultTo(false)
      if (!hasImpEmail) table.string('impersonator_email', 255).nullable()
      if (!hasImpId) table.integer('impersonator_id').unsigned().nullable()
      if (!hasImpReason) table.text('impersonation_reason').nullable()
    })
  }

  // 3. EXTEND projects (Jobs) FOR MODERATION FLAGS
  const hasProjects = await knex.schema.hasTable('projects')
  if (hasProjects) {
    const hasIsFlagged = await knex.schema.hasColumn('projects', 'is_flagged')
    const hasFlagReason = await knex.schema.hasColumn('projects', 'flag_reason')
    const hasFlaggedAt = await knex.schema.hasColumn('projects', 'flagged_at')
    const hasModeratedAt = await knex.schema.hasColumn('projects', 'moderated_at')
    const hasModeratorEmail = await knex.schema.hasColumn('projects', 'moderator_email')

    await knex.schema.alterTable('projects', (table) => {
      if (!hasIsFlagged) table.boolean('is_flagged').notNullable().defaultTo(false)
      if (!hasFlagReason) table.string('flag_reason', 255).nullable()
      if (!hasFlaggedAt) table.dateTime('flagged_at', { precision: 3 }).nullable()
      if (!hasModeratedAt) table.dateTime('moderated_at', { precision: 3 }).nullable()
      if (!hasModeratorEmail) table.string('moderator_email', 255).nullable()
    })
  }

  // 4. REGISTER NEW PERMISSIONS & ROLE ASSIGNMENTS
  const hasAdminPerms = await knex.schema.hasTable('admin_permissions')
  if (hasAdminPerms) {
    const newPerms = [
      {
        permission_key: 'users.financial_view',
        module: 'Users',
        name: 'View User Financials',
        description: 'View individual user quotes, invoices, payments, and rates. Requires a justification reason.',
      },
      {
        permission_key: 'users.impersonate',
        module: 'Users',
        name: 'Impersonate User',
        description: 'Time-boxed read-only support impersonation of user accounts with mandatory reason logging.',
      },
      {
        permission_key: 'analytics.export',
        module: 'Analytics',
        name: 'Export Analytics',
        description: 'Export platform aggregated analytics and reporting datasets.',
      },
    ]

    for (const p of newPerms) {
      const exists = await knex('admin_permissions').where({ permission_key: p.permission_key }).first()
      if (!exists) {
        await knex('admin_permissions').insert(p)
      }
    }

    const hasRolePerms = await knex.schema.hasTable('admin_role_permissions')
    if (hasRolePerms) {
      // Role mappings
      const mappings = [
        { role_key: 'SUPER_ADMIN', permission_key: 'users.financial_view' },
        { role_key: 'SUPER_ADMIN', permission_key: 'users.impersonate' },
        { role_key: 'SUPER_ADMIN', permission_key: 'analytics.export' },
        { role_key: 'SUPPORT', permission_key: 'users.impersonate' },
        { role_key: 'ADMIN', permission_key: 'analytics.export' },
        { role_key: 'ANALYST', permission_key: 'analytics.export' },
      ]

      for (const m of mappings) {
        const exists = await knex('admin_role_permissions').where(m).first()
        if (!exists) {
          await knex('admin_role_permissions').insert(m)
        }
      }
    }
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  // Graceful rollback if needed
}
