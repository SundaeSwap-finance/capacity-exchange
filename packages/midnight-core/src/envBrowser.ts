/** For use in Vite-based browser apps (reads from import.meta.env). */
export function requireBrowserEnv(name: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (import.meta as any).env?.[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
