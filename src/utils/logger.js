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
    console.log(`[${time}] [${level.toUpperCase()}] [${this.module}] ${message}`);
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
