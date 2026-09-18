<template>
  <div class="auth-layout animate-fade-in">
    <!-- Main Auth Container (No Header Bar) -->
    <main class="auth-main">
      <div class="auth-card-wrap">
        <slot />
      </div>
    </main>

    <!-- Footer -->
    <footer class="auth-footer">
      <div>&copy; {{ new Date().getFullYear() }} Wello · Work Value & Income Management</div>
      <div class="flex items-center gap-4 text-xs text-tertiary mt-2">
        <NuxtLink to="/login" class="hover-underline">Sign In</NuxtLink>
        <span>·</span>
        <NuxtLink to="/register" class="hover-underline">Create Account</NuxtLink>
      </div>
    </footer>
  </div>
</template>
