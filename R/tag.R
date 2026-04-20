#' @noRd
ggsql_viz_tag <- function(spec_json, width = "100%", height = "400px",
                          asp = NULL, caption = NULL, align = NULL) {
  css_width <- htmltools::validateCssUnit(width %||% "100%")
  size_css <- if (is.null(asp)) {
    css_height <- htmltools::validateCssUnit(height %||% "400px")
    sprintf("height: %s;", css_height)
  } else {
    sprintf("aspect-ratio: %s;", asp)
  }

  margin_style <- switch(
    align %||% "center",
    center = "margin-left: auto; margin-right: auto;",
    right = "margin-left: auto;",
    ""
  )

  style <- sprintf("display: block; width: %s; %s", css_width, size_css)
  if (nzchar(margin_style)) {
    style <- paste(style, margin_style)
  }

  viz <- htmltools::tag("ggsql-viz", list(
    style = style,
    htmltools::tags$script(type = "application/json", htmltools::HTML(spec_json)),
    ggsql_viz_dep()
  ))

  if (!is.null(caption) && nzchar(caption)) {
    htmltools::tagList(
      htmltools::tags$figure(
        viz,
        htmltools::tags$figcaption(caption)
      )
    )
  } else {
    htmltools::tagList(viz)
  }
}

#' @noRd
ggsql_viz_dep <- function() {
  list(
    htmltools::htmlDependency(
      name = "vega",
      version = "6.2.0",
      package = "ggsql",
      src = "lib/vega",
      script = list(src = "vega.min.js", defer = NA)
    ),
    htmltools::htmlDependency(
      name = "vega-lite",
      version = "6.4.2",
      package = "ggsql",
      src = "lib/vega-lite",
      script = list(src = "vega-lite.min.js", defer = NA)
    ),
    htmltools::htmlDependency(
      name = "vega-embed",
      version = "7.1.0",
      package = "ggsql",
      src = "lib/vega-embed",
      script = list(src = "vega-embed.min.js", defer = NA)
    ),
    htmltools::htmlDependency(
      name = "ggsql-viz",
      version = utils::packageVersion("ggsql"),
      package = "ggsql",
      src = "shiny",
      script = list(src = "ggsql-viz.js", defer = NA)
    )
  )
}
