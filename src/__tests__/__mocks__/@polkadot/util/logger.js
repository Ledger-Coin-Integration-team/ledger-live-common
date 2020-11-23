const logger = () => ({
  debug: () => {},
  info: () => {},
  error: console.error,
  warn: console.warn,
});

export default logger;
