// middleware/admin.ts
// Nuxt route guard to enforce admin account privileges for all /admin routes

export default defineNuxtRouteMiddleware((to) => {
  if (to.path === '/admin/login') return

  const authStore = useAuthStore()

  if (!authStore.isAuthenticated) {
    return navigateTo('/admin/login')
  }

  if (!authStore.isAdmin) {
    return navigateTo('/')
  }
})
