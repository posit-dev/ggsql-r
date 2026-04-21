// @ts-check

/**
 * @typedef {Object} VegaView
 * @property {() => void} finalize
 */

/**
 * @typedef {Object} VegaEmbedResult
 * @property {VegaView} view
 */

/**
 * @typedef {function(HTMLElement|string, Object, Object=): Promise<VegaEmbedResult>} VegaEmbedFn
 */

(function() {
  /** @type {number} */
  var MIN_WIDTH = 450;

  var style = document.createElement("style");
  style.textContent = "ggsql-viz { display: block; overflow: hidden; }";
  document.head.appendChild(style);

  class GgsqlViz extends HTMLElement {
    constructor() {
      super();
      /** @type {VegaView | null} */
      this._view = null;
      /** @type {Object | null} */
      this._spec = null;
      /** @type {HTMLDivElement | null} */
      this._container = null;
      /** @type {ResizeObserver | null} */
      this._resizeObserver = null;
      /** @type {string} */
      this._baseHeight = "";
      /** @type {boolean} */
      this._isScaled = false;
      /** @type {number} */
      this._renderVersion = 0;
    }

    connectedCallback() {
      // Children may not be parsed yet when connectedCallback fires.
      requestAnimationFrame(() => this._initFromInlineSpec());
    }

    /** @returns {void} */
    _initFromInlineSpec() {
      var scriptEl = this.querySelector('script[type="application/json"]');
      if (scriptEl) {
        try {
          this._spec = JSON.parse(scriptEl.textContent || "");
        } catch (e) {
          this.textContent = "ggsql: invalid JSON spec";
          return;
        }
        scriptEl.remove();
        this._render();
      }
    }

    disconnectedCallback() {
      this._finalize();
    }

    /** @returns {Object | null} */
    get spec() {
      return this._spec;
    }

    /** @param {Object | null} value */
    set spec(value) {
      this._spec = value;
      if (this.isConnected) {
        this._render();
      }
    }

    /** @returns {void} */
    _finalize() {
      if (this._resizeObserver) {
        this._resizeObserver.disconnect();
        this._resizeObserver = null;
      }
      if (this._view) {
        this._view.finalize();
        this._view = null;
      }
      this._container = null;
    }

    /** @returns {void} */
    _scaleToFit() {
      var available = this.clientWidth;
      if (!this._container) return;
      if (available < MIN_WIDTH) {
        if (!this._isScaled) {
          this._baseHeight = this.style.height;
        }
        var scale = available / MIN_WIDTH;
        this._container.style.transform = "scale(" + scale + ")";
        this._container.style.transformOrigin = "top left";
        this.style.height = (this._container.scrollHeight * scale) + "px";
        this._isScaled = true;
      } else {
        this._container.style.transform = "";
        if (this._isScaled) {
          this.style.height = this._baseHeight;
          this._isScaled = false;
        }
      }
    }

    /** @returns {void} */
    _render() {
      var self = this;
      if (!this._spec) {
        this._finalize();
        this.innerHTML = "";
        return;
      }

      if (!this._isScaled) {
        this._baseHeight = this.style.height;
      }
      this._finalize();

      var container = document.createElement("div");
      container.style.minWidth = MIN_WIDTH + "px";
      this.innerHTML = "";
      this.appendChild(container);
      this._container = container;
      var renderVersion = ++this._renderVersion;

      /** @type {VegaEmbedFn} */
      var embed = /** @type {any} */ (window).vegaEmbed;
      embed(container, this._spec, { actions: true })
        .then(function(result) {
          // A newer render may have started while this embed was in flight.
          if (renderVersion !== self._renderVersion || self._container !== container) {
            result.view.finalize();
            return;
          }
          self._view = result.view;
          self._scaleToFit();
          self._resizeObserver = new ResizeObserver(function() {
            self._scaleToFit();
          });
          self._resizeObserver.observe(self);
        })
        .catch(function(err) {
          if (renderVersion !== self._renderVersion || self._container !== container) {
            return;
          }
          self.textContent = "ggsql render error: " + err;
        });
    }
  }

  customElements.define("ggsql-viz", GgsqlViz);

  // --- Shiny output binding (only when Shiny is present) ---
  if (/** @type {any} */ (window).Shiny) {
    var Shiny = /** @type {any} */ (window).Shiny;

    /** @type {Object} */
    var GgsqlOutputBinding = new Shiny.OutputBinding();

    Object.assign(GgsqlOutputBinding, {
      /**
       * @param {HTMLElement | JQuery} scope
       * @returns {NodeListOf<GgsqlViz>}
       */
      find: function(scope) {
        var el = /** @type {HTMLElement} */ (scope[0] || scope);
        return el.querySelectorAll("ggsql-viz.ggsql-output");
      },

      /**
       * @param {GgsqlViz} el
       * @param {{ spec?: Object } | null} data
       * @returns {void}
       */
      renderValue: function(el, data) {
        el.spec = (data && data.spec) ? data.spec : null;
      },

      /**
       * @param {GgsqlViz} el
       * @param {{ message: string }} err
       * @returns {void}
       */
      renderError: function(el, err) {
        el._finalize();
        el.textContent = err.message;
      },

      /**
       * @param {GgsqlViz} _el
       * @returns {void}
       */
      clearError: function(_el) {
        // No-op: renderValue handles DOM reset
      }
    });

    Shiny.outputBindings.register(
      GgsqlOutputBinding,
      "ggsql.GgsqlOutputBinding"
    );
  }
})();
