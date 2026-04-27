#' Set the ggsql reader for the current Shiny session
#'
#' Registers a [duckdb_reader()] for use by all [renderGgsql()] outputs in the
#' current Shiny session. Must be called from within a Shiny server function
#' (i.e., while a session is active). The reader is automatically cleaned up
#' when the session ends.
#'
#' @param reader A `Reader` object created by [duckdb_reader()].
#' @param session The Shiny session object. Defaults to the current session.
#'
#' @return The `reader`, invisibly.
#'
#' @export
#'
#' @examplesIf interactive() && requireNamespace("shiny", quietly = TRUE)
#' library(shiny)
#'
#' ui <- fluidPage(
#'   ggsqlOutput("chart")
#' )
#'
#' server <- function(input, output, session) {
#'   ggsql_session_reader(duckdb_reader())
#'
#'   output$chart <- renderGgsql({
#'     "SELECT * FROM r:mtcars VISUALISE mpg AS x, disp AS y DRAW point"
#'   })
#' }
#'
#' shinyApp(ui, server)
ggsql_session_reader <- function(
  reader,
  session = shiny::getDefaultReactiveDomain()
) {
  rlang::check_installed("shiny", reason = "for ggsql Shiny bindings.")
  if (is.null(session)) {
    cli::cli_abort(
      "{.fn ggsql_session_reader} must be called from within a Shiny server function."
    )
  }
  session$userData$.ggsql_reader <- reader
  # Drop the reference so GC can invoke the Rust finalizer on the DuckDB
  # connection. Deterministic $close() doesn't exist yet on Reader.
  session$onSessionEnded(function() {
    session$userData$.ggsql_reader <- NULL
  })
  invisible(reader)
}

get_session_reader <- function(session) {
  session$userData$.ggsql_reader
}

#' Shiny bindings for ggsql
#'
#' Render ggsql visualizations in a Shiny application. `renderGgsql()` accepts
#' either a ggsql query string or a `Spec` object (returned by
#' [ggsql_execute()]). When given a string, it validates and executes the query
#' against `reader`.
#'
#' @param outputId Output variable to read from.
#' @param width,height CSS dimensions for the output container.
#'
#' @return `ggsqlOutput()` returns a Shiny UI element. `renderGgsql()` returns
#' a Shiny render function.
#'
#' @export
#'
#' @examplesIf interactive() && requireNamespace("shiny", quietly = TRUE)
#' library(shiny)
#'
#' ui <- fluidPage(
#'   ggsqlOutput("chart")
#' )
#'
#' server <- function(input, output, session) {
#'   ggsql_session_reader(duckdb_reader())
#'
#'   output$chart <- renderGgsql({
#'     "SELECT * FROM r:mtcars VISUALISE mpg AS x, disp AS y DRAW point"
#'   })
#' }
#'
#' shinyApp(ui, server)
ggsqlOutput <- function(outputId, width = "100%", height = "400px") {
  htmlwidgets::shinyWidgetOutput(
    outputId,
    name = "ggsql_vega",
    width = width,
    height = height,
    package = "ggsql"
  )
}

#' @param expr An expression that returns a ggsql query string or a `Spec`
#'   object. Strings may contain `r:varname` references that resolve variables
#'   from the expression's local scope (see Examples).
#' @param reader A `Reader` object created by [duckdb_reader()]. When `NULL`
#'   (the default), the session reader set by [ggsql_session_reader()] is used.
#' @param env The environment in which to evaluate `expr`.
#' @param quoted Logical. Is `expr` a quoted expression?
#'
#' @rdname ggsqlOutput
#' @export
renderGgsql <- function(
  expr,
  reader = NULL,
  env = parent.frame(),
  quoted = FALSE
) {
  if (!quoted) {
    expr <- substitute(expr)
  }
  force(env)

  render_expr <- quote({
    eval_env <- new.env(parent = env)
    value <- eval(expr, envir = eval_env)

    if (inherits(value, "htmlwidget")) {
      return(value)
    }

    if (inherits(value, "Spec")) {
      json <- ggsql_render(vegalite_writer(), value)
      return(ggsql_widget(json))
    }

    if (!is.character(value) || length(value) != 1L) {
      cli::cli_abort(
        "Expected a ggsql query string or a {.cls Spec} object, not {.cls {class(value)}}."
      )
    }

    session <- shiny::getDefaultReactiveDomain()
    r <- reader %||% get_session_reader(session)
    if (is.null(r)) {
      cli::cli_abort(
        c(
          "No ggsql reader available.",
          i = "Call {.code ggsql_session_reader(duckdb_reader())} in your server function before using {.fn renderGgsql}.",
          i = "Or pass a {.arg reader} argument directly to {.fn renderGgsql}."
        )
      )
    }
    query <- resolve_data_refs(value, r, envir = eval_env)
    validated <- ggsql_validate(query)
    if (!validated$has_visual) {
      cli::cli_abort(
        "{.fn renderGgsql} only accepts ggsql queries with a {.code VISUALISE} clause."
      )
    }
    spec <- ggsql_execute(r, query)
    json <- ggsql_render(vegalite_writer(), spec)
    ggsql_widget(json)
  })

  htmlwidgets::shinyRenderWidget(
    render_expr,
    ggsqlOutput,
    env = environment(),
    quoted = TRUE
  )
}
