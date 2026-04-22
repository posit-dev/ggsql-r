(function() {
  var PADDING_X = 80;
  var PADDING_Y = 120;
  var LEGEND_WIDTH = 120;
  var LEGEND_CHANNELS = ["color", "fill", "stroke", "shape", "size", "opacity"];

  function isCompound(spec) {
    return (
      "facet" in spec ||
      "hconcat" in spec ||
      "vconcat" in spec ||
      "concat" in spec
    );
  }

  function _specsForLegendSearch(spec) {
    if ("hconcat" in spec) return spec.hconcat;
    if ("vconcat" in spec) return spec.vconcat;
    if ("concat" in spec) return spec.concat;
    return [spec];
  }

  function _specHasLegend(s) {
    var layers = s.layer ? s.layer : [s];
    for (var i = 0; i < layers.length; i++) {
      var enc = layers[i].encoding;
      if (!enc) continue;
      for (var ci = 0; ci < LEGEND_CHANNELS.length; ci++) {
        var ch = LEGEND_CHANNELS[ci];
        if (enc[ch] && enc[ch].field !== undefined) {
          return true;
        }
      }
    }
    return false;
  }

  function hasLegend(spec) {
    var specs = _specsForLegendSearch(spec);
    for (var i = 0; i < specs.length; i++) {
      if (_specHasLegend(specs[i])) return true;
    }
    return false;
  }

  function fitToContainer(spec, containerWidth, containerHeight) {
    var padX = PADDING_X;
    var padY = PADDING_Y;

    if (hasLegend(spec)) {
      padX += LEGEND_WIDTH;
    }

    var usableW = Math.max(containerWidth - padX, 100);
    var usableH = Math.max(containerHeight - padY, 100);

    if ("facet" in spec) {
      var ncol = spec.columns || 1;
      var cellW = Math.floor(usableW / ncol);
      var result = Object.assign({}, spec);
      result.width = cellW;
      result.height = usableH;
      return result;
    }

    if ("hconcat" in spec) {
      var n = spec.hconcat.length;
      var cellW = Math.floor(usableW / n);
      var result = Object.assign({}, spec);
      result.hconcat = spec.hconcat.map(function(sub) {
        return Object.assign({}, sub, { width: cellW, height: usableH });
      });
      return result;
    }

    if ("vconcat" in spec) {
      var n = spec.vconcat.length;
      var cellH = Math.floor(usableH / n);
      var result = Object.assign({}, spec);
      result.vconcat = spec.vconcat.map(function(sub) {
        return Object.assign({}, sub, { width: usableW, height: cellH });
      });
      return result;
    }

    if ("concat" in spec) {
      var n = spec.concat.length;
      var ncol = spec.columns || n;
      var cellW = Math.floor(usableW / ncol);
      var result = Object.assign({}, spec);
      result.concat = spec.concat.map(function(sub) {
        return Object.assign({}, sub, { width: cellW });
      });
      return result;
    }

    return Object.assign({}, spec);
  }

  window.GgsqlSizing = {
    isCompound: isCompound,
    hasLegend: hasLegend,
    fitToContainer: fitToContainer
  };
})();
