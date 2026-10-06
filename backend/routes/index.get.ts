// backend/routes/index.get.ts
import { defineEventHandler } from 'h3'

export default defineEventHandler((event) => {
  return {
    service: 'Wello Backend API',
    status: 'online',
    version: '1.0.0',
    apiRoot: '/api',
    health: '/api/health',
    message: 'Wello Backend Service is running. Access the frontend application at http://localhost:3000',
  }
})
