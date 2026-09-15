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

<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #F8FAFC;
  background-image:
    radial-gradient(at 0% 0%, rgba(255, 159, 28, 0.04) 0px, transparent 50%),
    radial-gradient(at 100% 100%, rgba(122, 63, 246, 0.05) 0px, transparent 50%);
}

.auth-main {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 16px 40px;
}

.auth-card-wrap {
  width: 100%;
  max-width: 460px;
}

.auth-footer {
  padding: 24px 16px 32px;
  text-align: center;
  font-size: 12px;
  color: #94A3B8;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.hover-underline:hover {
  text-decoration: underline;
  color: var(--color-purple);
}

@media (max-width: 640px) {
  .auth-main {
    padding: 32px 16px 24px;
  }
}
</style>
