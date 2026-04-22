#' @noRd
ggsql_widget <- function(
  spec_json,
  width = NULL,
  height = NULL
) {
  widget <- htmlwidgets::createWidget(
    name = "ggsql_viz",
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
  widget$dependencies <- c(widget$dependencies, list(
    htmltools::htmlDependency(
      name = "ggsql_viz-styles",
      version = utils::packageVersion("ggsql"),
      src = "htmlwidgets",
      package = "ggsql",
      stylesheet = "ggsql_viz.css",
      all_files = FALSE
    )
  ))
  widget
}

#' @noRd
widget_html.ggsql_viz <- function(
  name,
  package,
  id,
  style,
  class,
  inline = FALSE,
  ...
) {
  htmltools::tag("ggsql-viz", list(id = id, style = style, class = class))
}
