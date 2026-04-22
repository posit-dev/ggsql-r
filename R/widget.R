#' @noRd
ggsql_widget <- function(
  spec_json,
  width = NULL,
  height = NULL,
  asp = NULL,
  caption = NULL,
  align = NULL
) {
  htmlwidgets::createWidget(
    name = "ggsql_viz",
    x = list(
      spec = jsonlite::parse_json(spec_json),
      asp = asp,
      caption = caption,
      align = align
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
