#' @noRd
ggsql_widget <- function(
  spec_json,
  width = NULL,
  height = NULL
) {
  widget <- htmlwidgets::createWidget(
    name = "ggsql_vega",
    x = list(
      spec = jsonlite::parse_json(spec_json)
    ),
    width = width,
    height = height,
    sizingPolicy = htmlwidgets::sizingPolicy(
      viewer.fill = TRUE,
      browser.fill = TRUE,
      knitr.figure = TRUE,
      knitr.defaultWidth = "100%",
      knitr.defaultHeight = "400px"
    ),
    package = "ggsql"
  )
  widget$dependencies <- c(
    widget$dependencies,
    vega_dependencies(),
    widget_dependencies()
  )
  widget
}

vega_dependencies <- function() {
  list(
    htmltools::htmlDependency(
      name = "vega",
      version = vega_version,
      src = "htmlwidgets/lib/vega",
      package = "ggsql",
      script = "vega.min.js"
    ),
    htmltools::htmlDependency(
      name = "vega-lite",
      version = vega_lite_version,
      src = "htmlwidgets/lib/vega-lite",
      package = "ggsql",
      script = "vega-lite.min.js"
    ),
    htmltools::htmlDependency(
      name = "vega-embed",
      version = vega_embed_version,
      src = "htmlwidgets/lib/vega-embed",
      package = "ggsql",
      script = "vega-embed.min.js"
    )
  )
}

widget_dependencies <- function() {
  list(
    htmltools::htmlDependency(
      name = "ggsql-vega-styles",
      version = utils::packageVersion("ggsql"),
      src = "htmlwidgets",
      package = "ggsql",
      stylesheet = "ggsql_vega.css",
      all_files = FALSE
    )
  )
}

#' @noRd
widget_html.ggsql_vega <- function(
  name,
  package,
  id,
  style,
  class,
  inline = FALSE,
  ...
) {
  htmltools::tag(
    "ggsql-vega",
    list(
      id = id,
      style = paste0("display:block;", style),
      class = class
    )
  )
}
