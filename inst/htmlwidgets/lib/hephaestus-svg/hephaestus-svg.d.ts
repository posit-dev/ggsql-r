/**
 * Render a hephaestus plot document to SVG in the browser.
 *
 * The sibling of `hephaestus-wasm`: same documents, no rasteriser. The plot
 * arrives as markup the page puts in the DOM, so a resize replaces it rather
 * than redrawing a canvas, and hit testing is ordinary DOM work.
 */

/** Initialise the wasm module. Call once, and await it, before anything else. */
export default function init(
  module_or_path?: { module_or_path: string | URL | Request | Response | BufferSource | WebAssembly.Module } | string | URL | Request | Response | BufferSource | WebAssembly.Module,
): Promise<unknown>;

/**
 * Major version of the plot-document format this build reads.
 *
 * Compared for equality, not as a floor, so a document written at a different
 * major never loads. Assert on it in a build step.
 */
export function documentFormatVersion(): number;

/** Whether any font family is available to shape with. */
export function hasFonts(): boolean;

/**
 * Register every font face in `bytes`, returning the family names.
 *
 * Accepts TTF, OTF, TTC, OTC, WOFF and WOFF2. Throws if the bytes hold no
 * recognisable face — registering nothing silently would render a plot whose
 * text has no width.
 */
export function registerFont(bytes: Uint8Array): string[];

/**
 * Point a generic family at concrete families already registered.
 *
 * `kind` is one of `serif`, `sans-serif`, `monospace`, `cursive`, `fantasy`,
 * `system-ui`. Call it after {@link registerFont}.
 */
export function setGenericFamily(kind: string, families: string[]): void;

/**
 * Read a document and draw it once.
 *
 * For a one-shot export. Anything that resizes wants {@link PlotView}, which
 * keeps the document decoded between draws.
 */
export function renderSvg(
  doc: Uint8Array,
  width: number,
  height: number,
  idPrefix: string,
): string;

/** Fetch a font file and register it. */
export function registerFontFromUrl(
  url: string,
  opts?: { genericFor?: string; key?: string },
): Promise<string[]>;

/** Register a Google Fonts family, keylessly, through the CSS2 endpoint. */
export function registerGoogleFont(
  family: string,
  opts?: { weights?: number[]; italics?: boolean; subset?: string; genericFor?: string },
): Promise<string[]>;

/**
 * Register the bundled Roboto faces — with the shaper, which measures, and
 * with the page as `@font-face`, which draws.
 */
export function registerDefaultFonts(): Promise<string[]>;

export interface PlotViewOptions {
  /** Theme to draw with. `'auto'` follows `prefers-color-scheme`. Default `'light'`. */
  colorScheme?: 'light' | 'dark' | 'auto';
  /** Observe the container and redraw when it changes size. Default `true`. */
  autoResize?: boolean;
  /**
   * Emit `data-pick-id` / `data-pick-kind` attributes. Default `true`.
   *
   * Turn it off for a dense plot that is never hit-tested: the attributes are
   * pure weight there, and they land on every primitive.
   */
  picking?: boolean;
  /**
   * Emit no background rect, letting the page show through. Default `false`,
   * which honours the paper color the document carried.
   */
  transparent?: boolean;
  /**
   * Width-to-height ratio, for a container whose height comes from its
   * content. Without it such a container and the SVG inside it size each
   * other in a loop.
   */
  aspect?: number;
  /**
   * Prefix for generated ids. Defaults to one unique per view, which is what
   * keeps two plots on a page from resolving each other's gradients.
   */
  idPrefix?: string;
  /** Fetch the bundled font when nothing is registered. Default `true`. */
  defaultFont?: boolean;
}

/** The size and dpi a document's writer recorded. Advisory. */
export interface DocumentHints {
  width?: number;
  height?: number;
  dpi?: number;
}

/** One frame of the scope chain a hit sits in. */
export interface PickScope {
  /** `composition`, `plot`, `region`, `axis`, `legend`, `geom`, `part`, `item`. */
  kind: string;
  name?: string;
  index?: number;
}

/** What the markup knows about a point. */
export interface PickHit {
  /** The row id, where the primitive carries one. Chrome does not. */
  id?: number;
  /** The enclosing scopes, outermost first. */
  path: PickScope[];
  /** The topmost element at the point. */
  element: Element;
}

/**
 * A plot document in a container element, with resize and color-scheme
 * handling.
 */
export class PlotView {
  static create(
    container: HTMLElement,
    doc: Uint8Array | ArrayBuffer,
    opts?: PlotViewOptions,
  ): Promise<PlotView>;

  /** Warnings from the most recent draw — what SVG could not express. */
  warnings: string[];
  /** The prefix generated ids carry. */
  idPrefix: string;

  /** Draw immediately, cancelling any frame already scheduled. */
  redraw(): void;
  /** Draw at an explicit size, in CSS pixels. */
  resize(width: number, height: number): void;
  setColorScheme(scheme: 'light' | 'dark' | 'auto'): void;
  colorScheme(): 'light' | 'dark' | 'auto';
  isDark(): boolean;
  /** The markup currently in the page, for saving or copying. */
  toSvgString(): string;
  /** Everything the markup knows about a point, or `undefined` for empty space. */
  pick(x: number, y: number): PickHit | undefined;
  /** The row id under a point. */
  pickAt(x: number, y: number): number | undefined;
  /** The scope chain under a point, outermost first. */
  pickPathAt(x: number, y: number): PickScope[] | undefined;
  hints(): DocumentHints;
  /** Detach observers and release the wasm-side document. */
  free(): void;
}
