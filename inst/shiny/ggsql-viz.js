(function() {
  // --- <ggsql-viz> web component ---
  var style = document.createElement("style");
  style.textContent = "ggsql-viz { display: block; overflow: hidden; }";
  document.head.appendChild(style);

  class GgsqlViz extends HTMLElement {
    constructor() {
      super();
      this._view = null;
      this._spec = null;
    }

    connectedCallback() {
      // Children may not be parsed yet when connectedCallback fires.
      // Defer to allow the parser to finish adding child elements.
      requestAnimationFrame(() => this._initFromInlineSpec());
    }

    _initFromInlineSpec() {
      var scriptEl = this.querySelector('script[type="application/json"]');
      if (scriptEl) {
        try {
          this._spec = JSON.parse(scriptEl.textContent);
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

    get spec() {
      return this._spec;
    }

    set spec(value) {
      this._spec = value;
      if (this.isConnected) {
        this._render();
      }
    }

    _finalize() {
      if (this._view) {
        this._view.finalize();
        this._view = null;
      }
    }

    _render() {
      var self = this;
      if (!this._spec) {
        this._finalize();
        this.innerHTML = "";
        return;
      }

      this._finalize();
      vegaEmbed(this, this._spec, { actions: true })
        .then(function(result) {
          self._view = result.view;
        })
        .catch(function(err) {
          self.textContent = "ggsql render error: " + err;
        });
    }
  }

  customElements.define("ggsql-viz", GgsqlViz);

  // --- Shiny output binding (only when Shiny is present) ---
  if (window.Shiny) {
    var GgsqlOutputBinding = new Shiny.OutputBinding();

    Object.assign(GgsqlOutputBinding, {
      find: function(scope) {
        return (scope[0] || scope).querySelectorAll("ggsql-viz.ggsql-output");
      },

      renderValue: function(el, data) {
        el.spec = (data && data.spec) ? data.spec : null;
      },

      renderError: function(el, err) {
        el._finalize();
        el.textContent = err.message;
      },

      clearError: function(el) {
        // No-op: renderValue handles DOM reset
      }
    });

    Shiny.outputBindings.register(
      GgsqlOutputBinding,
      "ggsql.GgsqlOutputBinding"
    );
  }
})();
