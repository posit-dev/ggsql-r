/* tslint:disable */
/* eslint-disable */

/**
 * A plot document, ready to draw at any size.
 *
 * The low-level binding. A page normally uses the `PlotView` class in
 * `js/hephaestus-svg.js`, which owns the resize and color-scheme wiring and
 * calls through to this.
 *
 * The composition is kept live between draws deliberately: a resize re-solves
 * the layout, and re-reading the document to do that would put a full decode
 * behind every frame of a window drag.
 */
export class PlotDocument {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Dots per inch the document's writer rendered at, if it recorded one.
     *
     * Advisory here in a way it is not on the canvas client, which sizes a
     * backing store from it. This one always draws at 96.
     */
    hintDpi(): number | undefined;
    /**
     * Height, in points, the document's writer rendered at, if it recorded one.
     */
    hintHeight(): number | undefined;
    /**
     * Width, in points, the document's writer rendered at, if it recorded one.
     *
     * Advisory — a document can be drawn at any size. Useful as an aspect
     * ratio for a container that has to be sized before anything is laid out.
     */
    hintWidth(): number | undefined;
    /**
     * Whether the inverted theme is in use.
     */
    isDark(): boolean;
    /**
     * Whether the background rect is suppressed.
     */
    isTransparent(): boolean;
    /**
     * Read `doc`.
     *
     * Synchronous, unlike the canvas client's `create`: there is no adapter
     * or device to acquire. Fails only if the document is unreadable — a
     * truncated file, or one written at a different format major.
     */
    static load(doc: Uint8Array): PlotDocument;
    /**
     * Whether picking attributes are emitted.
     */
    pickIds(): boolean;
    /**
     * Switch between the document's theme and its inverted form.
     *
     * Inversion swaps the palette's paper and ink anchors, which every
     * chrome element references, so gridlines, axis text and titles all
     * follow. A geom given an explicit color keeps it — marks adapt only
     * when the plot expressed them as palette references.
     *
     * Does not draw; call [`Self::to_svg`] after.
     */
    setDark(dark: boolean): void;
    /**
     * Emit `data-pick-id` on primitives and `data-pick-kind` on scope groups.
     *
     * On by default, because hit testing an inline SVG is what the attributes
     * are for and a page gets it with no wasm involved. Turn it off for a
     * dense plot that is never hit-tested: the attributes are pure weight
     * there, and `pointer-events="none"` lands on every unpicked primitive.
     *
     * Does not draw; call [`Self::to_svg`] after.
     */
    setPickIds(on: boolean): void;
    /**
     * Emit no background rect, so whatever is behind the SVG shows through.
     *
     * Off by default, which matches the canvas client: a document names a
     * paper color and honouring it is what makes the two clients agree. A
     * page that owns its own light and dark wants this on.
     */
    setTransparent(transparent: boolean): void;
    /**
     * Draw at `width` x `height` CSS pixels and return the markup.
     *
     * `id_prefix` prefixes every generated id. It is not a nicety: two SVGs
     * inlined into one page that both define `#lg0` will have the second's
     * `url(#lg0)` resolve to the first's definition, in every browser. Pass
     * something unique per view.
     */
    toSvg(width: number, height: number, id_prefix: string): SvgRender;
}

/**
 * One emitted document, and whatever the backend could not express.
 *
 * Warnings travel beside the markup rather than being logged, because each
 * one names something the page is showing an approximation of — a flattened
 * sweep gradient, an image this build has no codec for — and only the host
 * knows whether that is worth surfacing.
 */
export class SvgRender {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * The document, as markup ready to place in the page.
     */
    readonly svg: string;
    /**
     * Everything the scene expressed that SVG could not, deduplicated.
     */
    readonly warnings: string[];
}

/**
 * Major version of the plot-document format this build reads.
 *
 * A document whose major differs is refused outright — the check is equality,
 * not a floor — so a site and whatever writes its documents have to agree on
 * this number. Publish it alongside the bundle and assert on it in a build
 * step: nothing at runtime can recover from a mismatch, and the failure is a
 * plot that never appears.
 */
export function documentFormatVersion(): number;

/**
 * Whether any font family is available to shape with.
 *
 * A browser starts with none, so this answers "does this page still need a
 * font?" — and it answers it after a document has been read, so a document
 * carrying embedded faces counts. That is what lets a fallback be fetched
 * only when it is genuinely needed rather than on a guess.
 */
export function hasFonts(): boolean;

/**
 * Register every font face in `bytes`, returning the family names they
 * landed under.
 *
 * A browser starts with no fonts at all — nothing enumerates a system font
 * set — so a page that registers none renders chrome with no text. Call
 * this before creating any view: the first thing a document decodes is its
 * theme, and that is enough to shape.
 *
 * Shaping is needed here even though the browser does the final drawing.
 * The markup names a family and lets the browser resolve it, but the
 * advances that place each run — and the tick-label widths the layout solver
 * sizes tracks from — come from shaping in wasm. A build with no fonts lays
 * out as if every string were empty.
 *
 * Registration is process-global and permanent, so one call serves every
 * view on the page for the lifetime of the module.
 *
 * The family names are the point of the return value: [`set_generic_family`]
 * takes names, and the only place a family's name exists is inside the file,
 * so a caller cannot pair the two without being told. Guessing from a
 * filename does not survive contact with a real font.
 *
 * Accepts TTF, OTF, TTC, OTC and — with the `webfonts` feature, on by
 * default — WOFF and WOFF2, which are unwrapped to the sfnt inside first.
 * A blob holding no recognisable face is an error rather than an empty
 * list, since registering nothing silently would render a textless plot
 * with no indication why.
 */
export function registerFont(bytes: Uint8Array): string[];

/**
 * Read a document and draw it once, for a caller that keeps no handle.
 *
 * Every call decodes the document again, so this is for a one-shot export
 * rather than for anything that resizes. [`PlotDocument`] is the type for
 * that.
 */
export function renderSvg(doc: Uint8Array, width: number, height: number, id_prefix: string): string;

/**
 * Point a generic family at concrete families already registered.
 *
 * `kind` is one of `serif`, `sans-serif`, `monospace`, `cursive`,
 * `fantasy`, `system-ui`. A generic is an indirection through the font
 * context rather than a name, so registering a font is not enough on its
 * own — a theme asking for `sans-serif` resolves to nothing until this
 * says what `sans-serif` means here. Call it after [`register_font`], since
 * names that aren't registered are skipped.
 */
export function setGenericFamily(kind: string, families: string[]): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_plotdocument_free: (a: number, b: number) => void;
    readonly __wbg_svgrender_free: (a: number, b: number) => void;
    readonly documentFormatVersion: () => number;
    readonly hasFonts: () => number;
    readonly plotdocument_hintDpi: (a: number, b: number) => void;
    readonly plotdocument_hintHeight: (a: number, b: number) => void;
    readonly plotdocument_hintWidth: (a: number, b: number) => void;
    readonly plotdocument_isDark: (a: number) => number;
    readonly plotdocument_isTransparent: (a: number) => number;
    readonly plotdocument_load: (a: number, b: number, c: number) => void;
    readonly plotdocument_pickIds: (a: number) => number;
    readonly plotdocument_setDark: (a: number, b: number) => void;
    readonly plotdocument_setPickIds: (a: number, b: number) => void;
    readonly plotdocument_setTransparent: (a: number, b: number) => void;
    readonly plotdocument_toSvg: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly registerFont: (a: number, b: number, c: number) => void;
    readonly renderSvg: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly setGenericFamily: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly svgrender_svg: (a: number, b: number) => void;
    readonly svgrender_warnings: (a: number, b: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export3: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
