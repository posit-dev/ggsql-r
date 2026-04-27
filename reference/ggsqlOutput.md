# Shiny bindings for ggsql

Render ggsql visualizations in a Shiny application. `renderGgsql()`
accepts either a ggsql query string or a `Spec` object (returned by
[`ggsql_execute()`](https://r.ggsql.org/reference/ggsql_execute.md)).
When given a string, it validates and executes the query against
`reader`.

## Usage

``` r
ggsqlOutput(outputId, width = "100%", height = "400px")

renderGgsql(expr, reader = NULL, env = parent.frame(), quoted = FALSE)
```

## Arguments

- outputId:

  Output variable to read from.

- width, height:

  CSS dimensions for the output container.

- expr:

  An expression that returns a ggsql query string or a `Spec` object.
  Strings may contain `r:varname` references that resolve variables from
  the expression's local scope (see Examples).

- reader:

  A `Reader` object created by
  [`duckdb_reader()`](https://r.ggsql.org/reference/duckdb_reader.md).
  When `NULL` (the default), the session reader set by
  [`ggsql_session_reader()`](https://r.ggsql.org/reference/ggsql_session_reader.md)
  is used.

- env:

  The environment in which to evaluate `expr`.

- quoted:

  Logical. Is `expr` a quoted expression?

## Value

`ggsqlOutput()` returns a Shiny UI element. `renderGgsql()` returns a
Shiny render function.

## Examples

``` r
if (FALSE) { # interactive() && requireNamespace("shiny", quietly = TRUE)
library(shiny)

ui <- fluidPage(
  ggsqlOutput("chart")
)

server <- function(input, output, session) {
  ggsql_session_reader(duckdb_reader())

  output$chart <- renderGgsql({
    "SELECT * FROM r:mtcars VISUALISE mpg AS x, disp AS y DRAW point"
  })
}

shinyApp(ui, server)
}
```
