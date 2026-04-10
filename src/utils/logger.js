class Logger {
  constructor(module = 'default', debugEnabled) {
    this.module = module;
    this.debugEnabled = debugEnabled !== undefined ? debugEnabled : process.argv.includes('--debug');
  }

  #formatTime() {
    return new Date().toLocaleString('zh-CN');
  }

  #log(level, message) {
    const time = this.#formatTime();
    const line = `[${time}] [${level.toUpperCase()}] [${this.module}] ${message}`;
    // Match LiveTty: it prefers stderr for the dashboard when stderr is a TTY; then log to stdout.
    // On Windows Bun --compile, stderr.isTTY is often false while stdout is TTY — TUI uses stdout, log to stderr.
    const stderrIsTty = process.stderr?.isTTY === true;
    if (stderrIsTty) {
      console.log(line);
    } else {
      console.error(line);
    }
  }

  info(message) {
    this.#log('info', message);
  }

  warn(message) {
    this.#log('warn', message);
  }

  error(message) {
    this.#log('error', message);
  }

  debug(message) {
    if (this.debugEnabled) {
      this.#log('debug', message);
    }
  }
}

export default Logger;
