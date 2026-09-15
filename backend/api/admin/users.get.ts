// server/api/admin/users.get.ts
import { defineEventHandler } from 'h3'
import { getAllUsers } from '../../utils/authConfig'

export default defineEventHandler(() => {
  return {
    success: true,
    users: getAllUsers(),
  }
})
