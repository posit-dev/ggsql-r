// Page-facing API for the hephaestus SVG client.
//
// The wasm module is deliberately imperative — load a document, ask for
// markup at a size — and everything browser-shaped lives here:
// ResizeObserver, matchMedia, requestAnimationFrame, fetch, and hit testing,
// which on this client is ordinary DOM work rather than anything the
// renderer has to answer. JavaScript costs a page nothing to download twice
// over; wasm bytes are the thing worth being careful with.

import init, {
  PlotDocument,
  documentFormatVersion,
  hasFonts,
  registerFont,
  renderSvg,
  setGenericFamily,
} from './hephaestus_svg_wasm.js';

export {
  init as default,
  documentFormatVersion,
  hasFonts,
  registerFont,
  renderSvg,
  setGenericFamily,
};

// Fonts are registered into a process-global context that lives as long as
// the module, so registering the same file twice is waste rather than an
// error. Tracking what has been asked for lets several plots on one page
// each request the font they need without refetching.
const registered = new Set();

/**
 * Fetch a font file and register it.
 *
 * Accepts TTF, OTF, TTC, OTC, WOFF and WOFF2 — the container formats are
 * unwrapped to the sfnt inside on the wasm side, so a URL from a font CDN
 * works as-is.
 *
 * **A variable font is the best thing to point this at.** The shaper applies
 * the `wght` axis, so one file serves every weight — including interpolated
 * ones a static set cannot reach — which means one call rather than one per
 * weight, and no per-face subset to choose. Italic is still a second file,
 * since it is a separate axis-space in practice.
 *
 * @param {string} url
 * @param {{ genericFor?: string, key?: string }} [opts] `genericFor` also
 *   points that generic family at whatever families the file turned out to
 *   contain — which a theme asking for `sans-serif` needs, and which is why
 *   the family name comes back from `registerFont` rather than being guessed
 *   here. `key` overrides the dedupe key, normally the URL.
 * @returns {Promise<string[]>} family names registered, or `[]` if this URL
 *   was already registered.
 */
export async function registerFontFromUrl(url, opts = {}) {
  const key = opts.key ?? url;
  if (registered.has(key)) return [];

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`font fetch failed: ${response.status} ${response.statusText} for ${url}`);
  }
  const families = registerFont(new Uint8Array(await response.arrayBuffer()));
  registered.add(key);
  if (opts.genericFor) setGenericFamily(opts.genericFor, families);
  return families;
}

/**
 * Register a Google Fonts family. No API key needed.
 *
 * Uses the keyless CSS2 endpoint, which is possible because WOFF2 is decoded
 * (the `webfonts` feature). CORS allows the `fetch`, and the response is
 * WOFF2 whatever a page does — `User-Agent` is a forbidden header, so the
 * TTF the native `google-fonts` cargo feature relies on is unreachable here.
 *
 * **Exactly one file is registered per weight/style, by design.** Google
 * splits every face into per-script subset files sharing one family name, and
 * the shaper selects within a family by weight and style with no notion of CSS
 * `unicode-range` — so registering several subsets lets one without basic
 * Latin win and turns every label into tofu. `subset` picks which to take.
 *
 * Worth knowing on this client in particular: registering a family here makes
 * it the family the *markup names*, so the page has to be able to resolve it
 * too. Load the same family through CSS — a `<link>` to the same Google
 * stylesheet is exactly right — or the browser substitutes and `textLength`
 * squeezes the substitute into the width this shaped for.
 *
 * @param {string} family e.g. `'Inter'`, `'Open Sans'`. Case-sensitive.
 * @param {{ weights?: number[], italics?: boolean, subset?: string,
 *           genericFor?: string }} [opts] `weights` defaults to `[400, 700]`
 *   and `italics` to `true`, which is what the theme and markdown chrome
 *   between them ask for. `subset` defaults to `'latin'`.
 * @returns {Promise<string[]>} family names registered.
 */
export async function registerGoogleFont(family, opts = {}) {
  const weights = opts.weights ?? [400, 700];
  const italics = opts.italics !== false;
  const subset = opts.subset ?? 'latin';

  // ital,wght axis spec: 0 is upright, 1 italic, and the pairs must be sorted.
  const specs = [];
  for (const ital of italics ? [0, 1] : [0]) {
    for (const w of [...weights].sort((a, b) => a - b)) specs.push(`${ital},${w}`);
  }
  const url = new URL('https://fonts.googleapis.com/css2');
  url.searchParams.set('family', `${family}:ital,wght@${specs.join(';')}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Google Fonts CSS2 failed: ${response.status} ${response.statusText} ` +
        `for ${JSON.stringify(family)}`,
    );
  }
  const css = await response.text();

  // Each @font-face is preceded by a comment naming its subset.
  const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g)]
    .map(([, name, body]) => ({
      subset: name,
      weight: (body.match(/font-weight:\s*(\d+)/) || [])[1],
      style: (body.match(/font-style:\s*(\w+)/) || [])[1],
      src: (body.match(/url\((https:[^)]+)\)/) || [])[1],
    }))
    .filter((b) => b.src);
  if (!blocks.length) {
    throw new Error(`no @font-face blocks for ${JSON.stringify(family)} — check the name`);
  }

  const wanted = blocks.filter((b) => b.subset === subset);
  if (!wanted.length) {
    const available = [...new Set(blocks.map((b) => b.subset))].join(', ');
    throw new Error(
      `${JSON.stringify(family)} has no ${JSON.stringify(subset)} subset; available: ${available}`,
    );
  }

  const names = new Set();
  for (const b of wanted) {
    for (const n of await registerFontFromUrl(b.src, {
      key: `google:${family}:${subset}:${b.style}:${b.weight}`,
    })) {
      names.add(n);
    }
  }
  const out = [...names];
  if (opts.genericFor && out.length) setGenericFamily(opts.genericFor, out);
  return out;
}

/**
 * The bundled faces, resolved against this module so a CDN copy finds its own.
 *
 * Four static instances rather than one variable font: `gvar` deltas survive
 * charset subsetting, so a variable roman/italic pair at this coverage is
 * about 1 MB against ~260 kB brotli for these four. The trade is that a theme
 * asking for weight 500 snaps to 400 or 700 rather than interpolating; the
 * built-in themes only use 400 and 700.
 */
const DEFAULT_FACES = ['regular', 'bold', 'italic', 'bolditalic'].map(
  (v) => new URL(`./fonts/roboto-${v}.ttf`, import.meta.url).href,
);

/** Family the bundled faces register under. */
const DEFAULT_FAMILY = 'Roboto';

/**
 * A `@font-face` block pointing CSS at the same bundled faces wasm shaped
 * with, so the browser draws the family the markup names.
 *
 * This is the half a canvas client does not need. There, shaping and drawing
 * both happen in wasm and a registered face is the whole story. Here wasm
 * only *measures*: the browser draws, resolving `font-family="Roboto"`
 * against whatever it has. If the page has no Roboto it substitutes, and
 * because every run is placed by one anchor plus `textLength` the substitute
 * is squeezed into a width measured from a different face — legible, and
 * visibly not what was intended.
 */
const DEFAULT_FACE_CSS = [
  ['regular', 400, 'normal'],
  ['bold', 700, 'normal'],
  ['italic', 400, 'italic'],
  ['bolditalic', 700, 'italic'],
]
  .map(
    ([v, weight, style]) =>
      `@font-face{font-family:'${DEFAULT_FAMILY}';font-style:${style};font-weight:${weight};` +
      `font-display:block;src:url('${new URL(`./fonts/roboto-${v}.ttf`, import.meta.url).href}') ` +
      `format('truetype');}`,
  )
  .join('\n');

/** Id of the injected stylesheet, so several views share one. */
const DEFAULT_FACE_STYLE_ID = 'hephaestus-svg-default-faces';

/**
 * Give the page the same faces wasm registered, once per document.
 *
 * Idempotent by element id rather than by a module-level flag, so two copies
 * of this module on one page still inject one stylesheet.
 */
function installDefaultFaceCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(DEFAULT_FACE_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = DEFAULT_FACE_STYLE_ID;
  style.textContent = DEFAULT_FACE_CSS;
  document.head.appendChild(style);
}

/**
 * Register the bundled default font — Roboto, four faces.
 *
 * Covers latin, latin-ext, Greek, Cyrillic and Vietnamese, in regular, bold,
 * italic and bold-italic. All four matter: the theme sets a bold plot title,
 * and the rich-text sheet maps weight and italic independently, so markdown
 * chrome reaches every combination including nested `***emphasis***`. CJK is
 * deliberately absent — a CJK face is megabytes, and stays a bring-your-own
 * case.
 *
 * Registers them **twice over**, and both halves are needed: with the shaper,
 * which measures, and with the page as `@font-face`, which draws. See
 * {@link DEFAULT_FACE_CSS}.
 *
 * OFL-1.1; `fonts/OFL-Roboto.txt` ships alongside.
 */
export async function registerDefaultFonts() {
  const families = await Promise.all(
    DEFAULT_FACES.map((url) => registerFontFromUrl(url, { key: url })),
  );
  // After the faces, so the name the mapping points at exists.
  setGenericFamily('sans-serif', [DEFAULT_FAMILY]);
  installDefaultFaceCss();
  return [...new Set(families.flat())];
}

/** Distinguishes ids generated for different views on one page. */
let nextViewId = 0;

/**
 * A plot document in a container element, with resize and color-scheme
 * handling.
 *
 * Every mutator marks the view dirty and schedules one animation frame, so a
 * resize and a theme change in the same tick cost one render. Unlike the
 * canvas client there is no reason to draw synchronously: the markup already
 * in the page stays visible until it is replaced, so a deferred draw shows
 * the *previous* plot rather than a cleared buffer, and there is nothing to
 * flicker. `redraw()` forces one immediately.
 */
export class PlotView {
  /**
   * @param {HTMLElement} container the element the SVG is placed inside. Its
   *   content box is what the plot is laid out to, and its existing content
   *   is left alone until there is markup to replace it with — so a producer
   *   that put a natively-emitted SVG in the served HTML gets an exact swap
   *   for free, and a client that never boots leaves that picture on screen.
   * @param {Uint8Array|ArrayBuffer} doc bytes of a `.hep` document.
   * @param {PlotViewOptions} [opts]
   */
  static async create(container, doc, opts = {}) {
    const bytes = doc instanceof Uint8Array ? doc : new Uint8Array(doc);

    // A browser enumerates no system fonts, so a page that has registered
    // none would lay out as if every string were empty — no error, just
    // collapsed chrome and missing glyphs. Before `load`, not after: reading
    // a document decodes its theme, which is already enough to shape.
    if (opts.defaultFont !== false && !hasFonts()) {
      await registerDefaultFonts();
    }

    return new PlotView(container, PlotDocument.load(bytes), opts);
  }

  /** @private — use {@link PlotView.create}. */
  constructor(container, plot, opts) {
    this.container = container;
    this.plot = plot;
    /** Warnings from the most recent draw. @type {string[]} */
    this.warnings = [];
    this.idPrefix = opts.idPrefix ?? `hep${nextViewId++}-`;
    this._aspect = opts.aspect ?? null;
    this._frame = null;
    this._observer = null;
    this._media = null;
    this._onMedia = null;
    this._lastSize = null;
    this._freed = false;

    if (opts.picking === false) this.plot.setPickIds(false);
    if (opts.transparent === true) this.plot.setTransparent(true);

    this.setColorScheme(opts.colorScheme ?? 'light');

    if (opts.autoResize !== false) {
      // ResizeObserver rather than a window resize listener: the container
      // can change size from a flex reflow or a sibling appearing, neither of
      // which resizes the window.
      this._observer = new ResizeObserver((entries) => this._onObserved(entries));
      // The plain content box, not `device-pixel-content-box`: there is no
      // backing store here whose resolution has to line up with the device
      // pixel ratio. The browser rasterises the markup for whatever display
      // it lands on.
      this._observer.observe(this.container);
    }
    this._renderNow();
  }

  /** Draw immediately, cancelling any frame already scheduled. */
  redraw() {
    this._renderNow();
  }

  /**
   * Draw at an explicit size, in CSS pixels.
   *
   * Only needed when `autoResize` is off, or to drive the size from something
   * the observer cannot see.
   */
  resize(width, height) {
    if (this._freed) return;
    this._draw(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  }

  /**
   * Choose the theme: as authored, inverted, or following the OS.
   *
   * `'auto'` attaches a `prefers-color-scheme` listener and re-renders when
   * it changes. Inversion swaps the palette's paper and ink anchors, so
   * chrome follows; a geom given an explicit color keeps it.
   *
   * @param {'light'|'dark'|'auto'} scheme
   */
  setColorScheme(scheme) {
    if (this._freed) return;
    if (!['light', 'dark', 'auto'].includes(scheme)) {
      throw new Error(`unknown color scheme ${JSON.stringify(scheme)}`);
    }
    this._detachMedia();
    this._scheme = scheme;

    if (scheme === 'auto') {
      this._media = window.matchMedia('(prefers-color-scheme: dark)');
      this._onMedia = (e) => {
        this.plot.setDark(e.matches);
        this._schedule();
      };
      this._media.addEventListener('change', this._onMedia);
      this.plot.setDark(this._media.matches);
    } else {
      this.plot.setDark(scheme === 'dark');
    }
    this._schedule();
  }

  /** The scheme last asked for — `'auto'` if it is following the OS. */
  colorScheme() {
    return this._scheme;
  }

  /** Whether the inverted theme is currently drawn. Resolves `'auto'`. */
  isDark() {
    return this.plot.isDark();
  }

  /**
   * The markup currently in the page, for saving or copying.
   *
   * This client's answer to the canvas one's PNG export, and a better one:
   * the bytes are the plot rather than a picture of it at one size. There is
   * no rasteriser here, so a PNG would need the page to draw the SVG into a
   * canvas itself.
   */
  toSvgString() {
    return this.container.firstElementChild?.outerHTML ?? '';
  }

  /**
   * The row id under a point, or `undefined` where there is none.
   *
   * Takes CSS pixels relative to the container's top-left — `offsetX` /
   * `offsetY` of an event on the container. Answered from the DOM rather
   * than from a hit index in wasm, which is what the `data-pick-id`
   * attributes are for: the markup on screen *is* the index, so the answer
   * cannot lag the frame.
   *
   * `undefined` covers three different things, which {@link PlotView#pick}
   * separates: empty space, an occluding primitive, and chrome — which is
   * hittable but carries no id, reporting through its scope chain instead.
   */
  pickAt(x, y) {
    return this.pick(x, y)?.id;
  }

  /**
   * The scope chain under a point, outermost first.
   *
   * The `composition → plot → region → axis|legend|geom → part → item`
   * nesting the SVG backend emits as `<g data-pick-kind>` groups, which is
   * what lets a hit report *what* it hit rather than only which row.
   * `undefined` for empty space or an occluding primitive.
   *
   * @returns {PickScope[]|undefined}
   */
  pickPathAt(x, y) {
    return this.pick(x, y)?.path;
  }

  /**
   * Everything the markup knows about the point: the row id if the primitive
   * carries one, and the scope chain it sits in.
   *
   * The two halves are independent, which is the whole picking model rather
   * than a quirk here. A geom mark carries an id and no meaningful scope
   * below the geom; a tick label carries no id at all — chrome has none to
   * carry — and is identified entirely by its `part` / `item` scopes.
   *
   * `undefined` for empty space, and for a point covered by a primitive
   * drawn with `PickId::Block`: an opaque panel occludes what is under it
   * without being interactive.
   *
   * @returns {{ id?: number, path: PickScope[], element: Element }|undefined}
   */
  pick(x, y) {
    const el = this._elementAt(x, y);
    // `Skip` primitives outside a target scope carry `pointer-events="none"`,
    // so they are never returned here at all — an unpicked gridline over a
    // mark does not swallow the hit.
    if (!el) return undefined;
    // Occlusion, and the reason `Block` has an attribute of its own: sharing
    // `data-pick-id="0"` with an ordinary mark would make the two
    // indistinguishable from here.
    if (el.closest('[data-pick-block]')) return undefined;

    const idEl = el.closest('[data-pick-id]');
    const path = this._scopesOf(el);
    // Neither an id nor a scope means the background rect or the bare
    // `<svg>` — empty space, not a hit.
    if (!idEl && path.length === 0) return undefined;

    const id = idEl ? Number(idEl.getAttribute('data-pick-id')) : NaN;
    return {
      id: Number.isFinite(id) ? id : undefined,
      path,
      element: el,
    };
  }

  /** The `data-pick-kind` groups enclosing an element, outermost first. */
  _scopesOf(el) {
    const scopes = [];
    for (let n = el; n && n !== this.container; n = n.parentElement) {
      const kind = n.getAttribute?.('data-pick-kind');
      if (kind == null) continue;
      const index = n.getAttribute('data-pick-index');
      scopes.push({
        kind,
        name: n.getAttribute('data-pick-name') ?? undefined,
        index: index === null ? undefined : Number(index),
      });
    }
    return scopes.reverse();
  }

  /**
   * The size and dpi the document's writer recorded, if any.
   *
   * Advisory. Useful as an aspect ratio for a container that must be sized
   * before the plot is laid out — which is what the `aspect` option is for.
   */
  hints() {
    return {
      width: this.plot.hintWidth(),
      height: this.plot.hintHeight(),
      dpi: this.plot.hintDpi(),
    };
  }

  /** Detach observers and release the wasm-side document. */
  free() {
    if (this._freed) return;
    this._freed = true;
    if (this._frame !== null) cancelAnimationFrame(this._frame);
    this._observer?.disconnect();
    this._detachMedia();
    this.plot.free();
  }

  /**
   * The topmost element of this view's markup at a container-relative point.
   *
   * `elementFromPoint` takes viewport coordinates and answers about the whole
   * page, so the result is checked to be inside this container — an overlay
   * or a neighbouring view would otherwise be reported as a hit.
   */
  _elementAt(x, y) {
    if (this._freed) return null;
    const rect = this.container.getBoundingClientRect();
    const el = document.elementFromPoint(rect.left + x, rect.top + y);
    return el && this.container.contains(el) ? el : null;
  }

  _onObserved(entries) {
    if (this._freed) return;
    // Reading the entry rather than clientWidth avoids forcing a layout
    // flush inside the callback.
    const box = entries[entries.length - 1].contentBoxSize?.[0];
    const width = box ? box.inlineSize : this.container.clientWidth;
    const height = box ? box.blockSize : this.container.clientHeight;
    this._draw(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)));
  }

  /**
   * Emit at a size and put the markup in the page.
   *
   * Skips the work when the size has not changed, which is what keeps an
   * observer callback that fires on an unrelated reflow from re-solving the
   * layout and re-parsing the document's worth of SVG.
   */
  _draw(width, height) {
    const h = this._aspect ? Math.max(1, Math.round(width / this._aspect)) : height;
    if (this._lastSize && this._lastSize[0] === width && this._lastSize[1] === h) return;
    this._emit(width, h);
  }

  _emit(width, height) {
    const render = this.plot.toSvg(width, height, this.idPrefix);
    try {
      this.warnings = render.warnings;
      this.container.innerHTML = render.svg;
      this._lastSize = [width, height];
    } finally {
      // wasm-bindgen objects are not garbage collected; a leak here is one
      // per frame of a window drag.
      render.free();
    }
  }

  /** Draw now, dropping any frame already scheduled. */
  _renderNow() {
    if (this._freed) return;
    if (this._frame !== null) {
      cancelAnimationFrame(this._frame);
      this._frame = null;
    }
    this._sizeAndEmit();
  }

  /**
   * Coalesce a draw into the next frame.
   *
   * Safe for everything here, unlike on the canvas client: replacing markup
   * does not clear anything, so the previous plot stays on screen until the
   * new one is ready.
   */
  _schedule() {
    if (this._freed || this._frame !== null) return;
    this._frame = requestAnimationFrame(() => {
      this._frame = null;
      if (!this._freed) this._sizeAndEmit();
    });
  }

  /** Measure the container and emit unconditionally. */
  _sizeAndEmit() {
    // clientWidth is 0 for a container that isn't laid out (display:none, or
    // detached); the document's own hint is the best guess left.
    const width = Math.max(1, Math.round(this.container.clientWidth || this.plot.hintWidth() || 1));
    const height = this._aspect
      ? Math.max(1, Math.round(width / this._aspect))
      : Math.max(1, Math.round(this.container.clientHeight || this.plot.hintHeight() || 1));
    this._emit(width, height);
  }

  _detachMedia() {
    if (this._media && this._onMedia) {
      this._media.removeEventListener('change', this._onMedia);
    }
    this._media = null;
    this._onMedia = null;
  }
}
