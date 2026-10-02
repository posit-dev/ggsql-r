/* @ts-self-types="./hephaestus_svg_wasm.d.ts" */

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
    static __wrap(ptr) {
        const obj = Object.create(PlotDocument.prototype);
        obj.__wbg_ptr = ptr;
        PlotDocumentFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        PlotDocumentFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_plotdocument_free(ptr, 0);
    }
    /**
     * Dots per inch the document's writer rendered at, if it recorded one.
     *
     * Advisory here in a way it is not on the canvas client, which sizes a
     * backing store from it. This one always draws at 96.
     * @returns {number | undefined}
     */
    hintDpi() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.plotdocument_hintDpi(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r2 = getDataViewMemory0().getFloat64(retptr + 8 * 1, true);
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Height, in points, the document's writer rendered at, if it recorded one.
     * @returns {number | undefined}
     */
    hintHeight() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.plotdocument_hintHeight(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r2 = getDataViewMemory0().getFloat64(retptr + 8 * 1, true);
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Width, in points, the document's writer rendered at, if it recorded one.
     *
     * Advisory — a document can be drawn at any size. Useful as an aspect
     * ratio for a container that has to be sized before anything is laid out.
     * @returns {number | undefined}
     */
    hintWidth() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.plotdocument_hintWidth(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r2 = getDataViewMemory0().getFloat64(retptr + 8 * 1, true);
            return r0 === 0 ? undefined : r2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Whether the inverted theme is in use.
     * @returns {boolean}
     */
    isDark() {
        const ret = wasm.plotdocument_isDark(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Whether the background rect is suppressed.
     * @returns {boolean}
     */
    isTransparent() {
        const ret = wasm.plotdocument_isTransparent(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Read `doc`.
     *
     * Synchronous, unlike the canvas client's `create`: there is no adapter
     * or device to acquire. Fails only if the document is unreadable — a
     * truncated file, or one written at a different format major.
     * @param {Uint8Array} doc
     * @returns {PlotDocument}
     */
    static load(doc) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(doc, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.plotdocument_load(retptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return PlotDocument.__wrap(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Whether picking attributes are emitted.
     * @returns {boolean}
     */
    pickIds() {
        const ret = wasm.plotdocument_pickIds(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Switch between the document's theme and its inverted form.
     *
     * Inversion swaps the palette's paper and ink anchors, which every
     * chrome element references, so gridlines, axis text and titles all
     * follow. A geom given an explicit color keeps it — marks adapt only
     * when the plot expressed them as palette references.
     *
     * Does not draw; call [`Self::to_svg`] after.
     * @param {boolean} dark
     */
    setDark(dark) {
        wasm.plotdocument_setDark(this.__wbg_ptr, dark);
    }
    /**
     * Emit `data-pick-id` on primitives and `data-pick-kind` on scope groups.
     *
     * On by default, because hit testing an inline SVG is what the attributes
     * are for and a page gets it with no wasm involved. Turn it off for a
     * dense plot that is never hit-tested: the attributes are pure weight
     * there, and `pointer-events="none"` lands on every unpicked primitive.
     *
     * Does not draw; call [`Self::to_svg`] after.
     * @param {boolean} on
     */
    setPickIds(on) {
        wasm.plotdocument_setPickIds(this.__wbg_ptr, on);
    }
    /**
     * Emit no background rect, so whatever is behind the SVG shows through.
     *
     * Off by default, which matches the canvas client: a document names a
     * paper color and honouring it is what makes the two clients agree. A
     * page that owns its own light and dark wants this on.
     * @param {boolean} transparent
     */
    setTransparent(transparent) {
        wasm.plotdocument_setTransparent(this.__wbg_ptr, transparent);
    }
    /**
     * Draw at `width` x `height` CSS pixels and return the markup.
     *
     * `id_prefix` prefixes every generated id. It is not a nicety: two SVGs
     * inlined into one page that both define `#lg0` will have the second's
     * `url(#lg0)` resolve to the first's definition, in every browser. Pass
     * something unique per view.
     * @param {number} width
     * @param {number} height
     * @param {string} id_prefix
     * @returns {SvgRender}
     */
    toSvg(width, height, id_prefix) {
        const ptr0 = passStringToWasm0(id_prefix, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.plotdocument_toSvg(this.__wbg_ptr, width, height, ptr0, len0);
        return SvgRender.__wrap(ret);
    }
}
if (Symbol.dispose) PlotDocument.prototype[Symbol.dispose] = PlotDocument.prototype.free;

/**
 * One emitted document, and whatever the backend could not express.
 *
 * Warnings travel beside the markup rather than being logged, because each
 * one names something the page is showing an approximation of — a flattened
 * sweep gradient, an image this build has no codec for — and only the host
 * knows whether that is worth surfacing.
 */
export class SvgRender {
    static __wrap(ptr) {
        const obj = Object.create(SvgRender.prototype);
        obj.__wbg_ptr = ptr;
        SvgRenderFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SvgRenderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_svgrender_free(ptr, 0);
    }
    /**
     * The document, as markup ready to place in the page.
     * @returns {string}
     */
    get svg() {
        let deferred1_0;
        let deferred1_1;
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.svgrender_svg(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            deferred1_0 = r0;
            deferred1_1 = r1;
            return getStringFromWasm0(r0, r1);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
            wasm.__wbindgen_export3(deferred1_0, deferred1_1, 1);
        }
    }
    /**
     * Everything the scene expressed that SVG could not, deduplicated.
     * @returns {string[]}
     */
    get warnings() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.svgrender_warnings(retptr, this.__wbg_ptr);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayJsValueFromWasm0(r0, r1);
            wasm.__wbindgen_export3(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) SvgRender.prototype[Symbol.dispose] = SvgRender.prototype.free;

/**
 * Major version of the plot-document format this build reads.
 *
 * A document whose major differs is refused outright — the check is equality,
 * not a floor — so a site and whatever writes its documents have to agree on
 * this number. Publish it alongside the bundle and assert on it in a build
 * step: nothing at runtime can recover from a mismatch, and the failure is a
 * plot that never appears.
 * @returns {number}
 */
export function documentFormatVersion() {
    const ret = wasm.documentFormatVersion();
    return ret;
}

/**
 * Whether any font family is available to shape with.
 *
 * A browser starts with none, so this answers "does this page still need a
 * font?" — and it answers it after a document has been read, so a document
 * carrying embedded faces counts. That is what lets a fallback be fetched
 * only when it is genuinely needed rather than on a guess.
 * @returns {boolean}
 */
export function hasFonts() {
    const ret = wasm.hasFonts();
    return ret !== 0;
}

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
 * @param {Uint8Array} bytes
 * @returns {string[]}
 */
export function registerFont(bytes) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        wasm.registerFont(retptr, ptr0, len0);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        if (r3) {
            throw takeObject(r2);
        }
        var v2 = getArrayJsValueFromWasm0(r0, r1);
        wasm.__wbindgen_export3(r0, r1 * 4, 4);
        return v2;
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

/**
 * Read a document and draw it once, for a caller that keeps no handle.
 *
 * Every call decodes the document again, so this is for a one-shot export
 * rather than for anything that resizes. [`PlotDocument`] is the type for
 * that.
 * @param {Uint8Array} doc
 * @param {number} width
 * @param {number} height
 * @param {string} id_prefix
 * @returns {string}
 */
export function renderSvg(doc, width, height, id_prefix) {
    let deferred4_0;
    let deferred4_1;
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passArray8ToWasm0(doc, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(id_prefix, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.renderSvg(retptr, ptr0, len0, width, height, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
        var ptr3 = r0;
        var len3 = r1;
        if (r3) {
            ptr3 = 0; len3 = 0;
            throw takeObject(r2);
        }
        deferred4_0 = ptr3;
        deferred4_1 = len3;
        return getStringFromWasm0(ptr3, len3);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
        wasm.__wbindgen_export3(deferred4_0, deferred4_1, 1);
    }
}

/**
 * Point a generic family at concrete families already registered.
 *
 * `kind` is one of `serif`, `sans-serif`, `monospace`, `cursive`,
 * `fantasy`, `system-ui`. A generic is an indirection through the font
 * context rather than a name, so registering a font is not enough on its
 * own — a theme asking for `sans-serif` resolves to nothing until this
 * says what `sans-serif` means here. Call it after [`register_font`], since
 * names that aren't registered are skipped.
 * @param {string} kind
 * @param {string[]} families
 */
export function setGenericFamily(kind, families) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArrayJsValueToWasm0(families, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        wasm.setGenericFamily(retptr, ptr0, len0, ptr1, len1);
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        if (r1) {
            throw takeObject(r0);
        }
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_67e7344beaa85059: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return addHeapObject(ret);
        },
        __wbg___wbindgen_string_get_92ab86bb19cbc12f: function(arg0, arg1) {
            const obj = getObject(arg1);
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_5d9e815e6fdf150f: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbindgen_generic_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_object_drop_ref: function(arg0) {
            takeObject(arg0);
        },
    };
    return {
        __proto__: null,
        "./hephaestus_svg_wasm_bg.js": import0,
    };
}

const PlotDocumentFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_plotdocument_free(ptr, 1));
const SvgRenderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_svgrender_free(ptr, 1));

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function dropObject(idx) {
    if (idx < 1028) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(takeObject(mem.getUint32(i, true)));
    }
    return result;
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getObject(idx) { return heap[idx]; }

let heap = new Array(1024).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function isLikeNone(x) {
    return x === undefined || x === null;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayJsValueToWasm0(array, malloc) {
    const ptr = malloc(array.length * 4, 4) >>> 0;
    const mem = getDataViewMemory0();
    for (let i = 0; i < array.length; i++) {
        mem.setUint32(ptr + 4 * i, addHeapObject(array[i]), true);
    }
    WASM_VECTOR_LEN = array.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('hephaestus_svg_wasm_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
