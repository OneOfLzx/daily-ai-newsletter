/**
 * @returns {number}
 */
function ttyColumns() {
  const c = typeof process !== 'undefined' && process.stderr?.columns;
  return typeof c === 'number' && c > 0 ? c : 80;
}

/**
 * @returns {number}
 */
function ttyRows() {
  const r = typeof process !== 'undefined' && process.stderr?.rows;
  return typeof r === 'number' && r > 0 ? r : 24;
}

/**
 * @param {string} s
 * @param {number} max
 */
function truncatePlain(s, max) {
  const t = String(s).replace(/\r?\n/g, ' ');
  if (t.length <= max) return t;
  return max >= 2 ? `${t.slice(0, max - 1)}…` : t.slice(0, max);
}

/**
 * Box-drawing (UTF-8). Set ASCII_BOX=1 for + - | fallback.
 */
function boxChars() {
  if (process.env.ASCII_BOX === '1') {
    return { h: '-', v: '|', tl: '+', tr: '+', bl: '+', br: '+', lj: '+', rj: '+' };
  }
  return { h: '─', v: '│', tl: '╭', tr: '╮', bl: '╰', br: '╯', lj: '├', rj: '┤' };
}

/**
 * @param {boolean} useColor
 */
function palette(useColor) {
  if (!useColor) {
    return { dim: '', title: '', label: '', reset: '' };
  }
  return {
    dim: '\x1b[90m',
    title: '\x1b[1m\x1b[97m',
    label: '\x1b[36m',
    reset: '\x1b[0m'
  };
}

/**
 * Alternate-screen dashboard (htop-style): one full-frame write per refresh, optional
 * synchronized output (CSI ?2026) to reduce tear on supported terminals.
 *
 * Stdout logs are expected to be quieted while active (e.g. generator `quiet: true`).
 */
export class LiveTty {
  /**
   * @param {number} workerCount
   */
  constructor(workerCount) {
    this.workerCount = Math.max(0, workerCount);
    const term = process.env.TERM || '';
    this._ttyCapable =
      typeof process !== 'undefined' &&
      process.stderr?.isTTY === true &&
      term !== 'dumb';
    this._active = false;
    /** @type {string | null} */
    this._lastFrame = null;
    this._onResize = this._handleResize.bind(this);
    /** @type {string[]} */
    this._deferredWarns = [];
    /** @type {string[]} */
    this._activityTail = [];
    this._useSync = process.env.TUI_NOSYNC !== '1';
  }

  get isActive() {
    return this._active;
  }

  _handleResize() {
    if (!this._active) return;
    this._lastFrame = null;
  }

  /**
   * While the dashboard is shown, queue a warning for stderr after exit, and show a short line on the panel.
   * @param {string} message
   */
  noteWarning(message) {
    if (!this._active) return;
    const msg = String(message).replace(/\s+/g, ' ').trim();
    this._deferredWarns.push(msg);
    const short = truncatePlain(msg, ttyColumns() - 8);
    this._activityTail.push(short);
    if (this._activityTail.length > 6) this._activityTail.shift();
    this._lastFrame = null;
  }

  /**
   * @returns {string[]} warnings to log with logger.warn after {@link done}
   */
  takeDeferredWarns() {
    const w = this._deferredWarns;
    this._deferredWarns = [];
    return w;
  }

  _minRows() {
    return 9 + this.workerCount;
  }

  /**
   * @returns {boolean}
   */
  init() {
    if (this._active) return true;
    if (!this._ttyCapable) return false;
    if (ttyRows() < this._minRows()) return false;

    const useColor = !process.env.NO_COLOR;
    const p = palette(useColor);
    process.stderr.write(
      `\x1b[?1049h\x1b[?25l\x1b[2J\x1b[H${p.reset}`
    );
    this._active = true;
    if (process.stderr.isTTY) process.stderr.on('resize', this._onResize);
    if (process.stdout.isTTY) process.stdout.on('resize', this._onResize);
    return true;
  }

  /**
   * @param {string[]} workerLines
   * @param {{ input?: number, output?: number, total?: number, prompt?: number, completion?: number }} tokens
   */
  render(workerLines, tokens) {
    if (!this._active) return;

    const rows = ttyRows();
    const cols = ttyColumns();
    if (rows < this._minRows()) {
      this.done();
      return;
    }

    const inTok = tokens?.input ?? tokens?.prompt ?? 0;
    const outTok = tokens?.output ?? tokens?.completion ?? 0;
    const tot = tokens?.total ?? 0;
    const fmt = n => Number(n).toLocaleString('en-US');

    const useColor = !process.env.NO_COLOR;
    const p = palette(useColor);
    const B = boxChars();
    const iw = Math.max(4, cols - 2);

    const dimBar = (tl, tr) =>
      `${p.dim}${tl}${B.h.repeat(Math.max(0, cols - 2))}${tr}${p.reset}`;

    /** @type {string[]} */
    const body = [];
    body.push(dimBar(B.tl, B.tr));
    {
      const plainTitle = ' Daily AI Newsletter — LLM workers';
      const t = truncatePlain(plainTitle, iw);
      const pad = ' '.repeat(Math.max(0, iw - t.length));
      const core = useColor ? `${p.title}${t}${pad}${p.reset}` : `${t}${pad}`;
      body.push(`${p.dim}${B.v}${p.reset}${core}${p.dim}${B.v}${p.reset}`);
    }
    body.push(`${p.dim}${B.lj}${B.h.repeat(Math.max(0, cols - 2))}${B.rj}${p.reset}`);

    for (let w = 0; w < this.workerCount; w++) {
      const raw = workerLines[w] ?? '(idle)';
      const lab = `SubAgent ${w + 1}`;
      const sep = '  ';
      const urlMax = Math.max(8, iw - lab.length - sep.length);
      const u = truncatePlain(raw, urlMax);
      const gap = ' '.repeat(Math.max(0, iw - lab.length - sep.length - u.length));
      const core = useColor
        ? `${p.label}${lab}${p.reset}${sep}${u}${gap}`
        : `${lab}${sep}${u}${gap}`;
      body.push(`${p.dim}${B.v}${p.reset}${core}${p.dim}${B.v}${p.reset}`);
    }

    body.push(`${p.dim}${B.lj}${B.h.repeat(Math.max(0, cols - 2))}${B.rj}${p.reset}`);

    const tokRows = [
      ` Input tokens:    ${fmt(inTok)}`,
      ` Output tokens:   ${fmt(outTok)}`,
      ` Total tokens:    ${fmt(tot)}`
    ];
    for (const tr of tokRows) {
      const t = truncatePlain(tr, iw);
      const pad = ' '.repeat(Math.max(0, iw - t.length));
      body.push(`${p.dim}${B.v}${p.reset}${t}${pad}${p.dim}${B.v}${p.reset}`);
    }

    body.push(`${p.dim}${B.lj}${B.h.repeat(Math.max(0, cols - 2))}${B.rj}${p.reset}`);

    const fixed = body.length;
    const fillerCount = rows - fixed - 1;
    const maxAct = Math.min(6, Math.max(0, fillerCount));
    const act = maxAct > 0 ? this._activityTail.slice(-maxAct) : [];
    const blanks = Math.max(0, fillerCount - act.length);
    for (let b = 0; b < blanks; b++) {
      body.push(`${p.dim}${B.v}${p.reset}${' '.repeat(iw)}${p.dim}${B.v}${p.reset}`);
    }
    for (const a of act) {
      const t = truncatePlain(` ${a}`, iw);
      const pad = ' '.repeat(Math.max(0, iw - t.length));
      body.push(`${p.dim}${B.v}${p.reset}${t}${pad}${p.dim}${B.v}${p.reset}`);
    }

    while (body.length < rows - 1) {
      body.push(`${p.dim}${B.v}${p.reset}${' '.repeat(iw)}${p.dim}${B.v}${p.reset}`);
    }
    body.push(dimBar(B.bl, B.br));

    let frame = '';
    if (this._useSync) frame += '\x1b[?2026h';
    for (let r = 0; r < body.length; r++) {
      frame += `\x1b[${r + 1};1H\x1b[2K${body[r]}`;
    }
    if (this._useSync) frame += '\x1b[?2026l';

    if (frame === this._lastFrame) return;
    this._lastFrame = frame;
    process.stderr.write(frame);
  }

  done() {
    if (!this._active) return;
    if (process.stderr.isTTY) process.stderr.off('resize', this._onResize);
    if (process.stdout.isTTY) process.stdout.off('resize', this._onResize);
    const useColor = !process.env.NO_COLOR;
    const rst = useColor ? '\x1b[0m' : '';
    process.stderr.write(`${rst}\x1b[?25h\x1b[?1049l`);
    this._active = false;
    this._lastFrame = null;
    this._activityTail = [];
  }
}
