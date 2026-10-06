<template>
  <div class="auth-layout animate-fade-in">
    <!-- Ambient Floating Gradient Mesh Orbs -->
    <div class="auth-ambient-orb orb-1"></div>
    <div class="auth-ambient-orb orb-2"></div>
    <div class="auth-ambient-orb orb-3"></div>

    <!-- Main Auth Container -->
    <main class="auth-main">
      <div class="auth-card-wrap">
        <slot />
      </div>
    </main>

    <!-- Footer -->
    <footer class="auth-footer">
      <div>&copy; {{ new Date().getFullYear() }} Wello · Work Value & Income Management</div>
      <div class="auth-footer-links">
        <NuxtLink to="/" class="auth-footer-link">← Home</NuxtLink>
        <span>·</span>
        <NuxtLink to="/login" class="auth-footer-link">Sign In</NuxtLink>
        <span>·</span>
        <NuxtLink to="/register" class="auth-footer-link">Create Account</NuxtLink>
      </div>
    </footer>

    <!-- Global Toast Notifications -->
    <ToastContainer />
  </div>
</template>

<style scoped>
.auth-layout {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #FAFAFC;
  color: #111827;
  font-family: var(--font-family);
  overflow-x: hidden;
  padding: 30px 16px;
}

.auth-ambient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
  z-index: 0;
  opacity: 0.6;
}

.orb-1 {
  top: -80px;
  left: -60px;
  width: 450px;
  height: 450px;
  background: radial-gradient(circle, rgba(255, 159, 28, 0.35) 0%, rgba(255, 56, 125, 0.25) 50%, transparent 70%);
}

.orb-2 {
  top: 30%;
  right: -80px;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(122, 63, 246, 0.35) 0%, rgba(0, 123, 255, 0.2) 60%, transparent 75%);
}

.orb-3 {
  bottom: -60px;
  left: 20%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(255, 56, 125, 0.25) 0%, rgba(122, 63, 246, 0.2) 50%, transparent 70%);
}

.auth-main {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 460px;
  margin: 0 auto;
}

.auth-card-wrap {
  width: 100%;
}

.auth-footer {
  position: relative;
  z-index: 1;
  text-align: center;
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 30px;
}

.auth-footer-links {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 6px;
}

.auth-footer-link {
  color: var(--text-secondary);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.auth-footer-link:hover {
  color: var(--color-purple);
}
</style>
