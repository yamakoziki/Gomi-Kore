// Test-only stand-in for the "virtual:pwa-register" module that vite-plugin-pwa
// injects at build/dev time. Vitest doesn't run that plugin, so this alias
// (see vitest.config.ts) keeps imports of it resolvable in tests.
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return async () => {};
}
