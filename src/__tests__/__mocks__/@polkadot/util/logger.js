export const logger = () => ({
  debug: () => {},
  info: () => {},
  error: console.error,
  warn: console.warn,
});