export interface Logger {
  info(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
  success(...args: any[]): void;
}

/**
 * Create a simple logger that prefixes messages with timestamp and level
 */
export function createLogger(): Logger {
  const timestamp = () => new Date().toISOString();

  return {
    info: (...args: any[]) => console.log(`[INFO] ${timestamp()}`, ...args),
    error: (...args: any[]) => console.error(`[ERROR] ${timestamp()}`, ...args),
    warn: (...args: any[]) => console.warn(`[WARN] ${timestamp()}`, ...args),
    success: (...args: any[]) =>
      console.log(`[SUCCESS] ${timestamp()}`, ...args),
  };
}
