// server/api/admin/roles.get.ts
import { defineEventHandler } from 'h3'
import { getAllAdminUsers, ROLE_DEFINITIONS, ALL_PERMISSIONS } from '../../utils/adminStore'

export default defineEventHandler(() => {
  return {
    success: true,
    admins: getAllAdminUsers(),
    roles: Object.values(ROLE_DEFINITIONS),
    permissions: ALL_PERMISSIONS,
  }
})
