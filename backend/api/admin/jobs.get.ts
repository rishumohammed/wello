// server/api/admin/jobs.get.ts
import { defineEventHandler } from 'h3'

export default defineEventHandler(() => {
  // Return structured jobs/services for admin moderation
  const sampleJobs = [
    { id: 'job_101', title: 'Full-Stack Nuxt 3 E-Commerce Platform', userEmail: 'rahul@mehtatech.in', userName: 'Rahul Mehta', category: 'Software & Web Development', status: 'in_progress', quoteAmount: 125000, estHours: 80, createdAt: new Date(Date.now() - 5 * 86400000).toISOString() },
    { id: 'job_102', title: 'Fintech Mobile App UI/UX Redesign', userEmail: 'priya.sharma@design.io', userName: 'Priya Sharma', category: 'UI/UX & Visual Design', status: 'approved', quoteAmount: 85000, estHours: 50, createdAt: new Date(Date.now() - 10 * 86400000).toISOString() },
    { id: 'job_103', title: 'API Integration & Webhook Architecture', userEmail: 'amit.patel@devs.in', userName: 'Amit Patel', category: 'Software & Web Development', status: 'completed', quoteAmount: 45000, estHours: 25, createdAt: new Date(Date.now() - 15 * 86400000).toISOString() },
    { id: 'job_104', title: 'Technical Whitepaper & Documentation', userEmail: 'sneha.rao@content.co', userName: 'Sneha Rao', category: 'Content & Copywriting', status: 'quoted', quoteAmount: 32000, estHours: 20, createdAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  ]

  return {
    success: true,
    jobs: sampleJobs,
  }
})
