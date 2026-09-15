// middleware/admin.ts
// Nuxt route guard to enforce admin account privileges for all /admin routes

export default defineNuxtRouteMiddleware((to) => {
  const authStore = useAuthStore()

  if (!authStore.isAdmin) {
    // Redirect non-admin user accounts to home workspace
    return navigateTo('/')
  }
})
