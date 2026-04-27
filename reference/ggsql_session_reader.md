# Set the ggsql reader for the current Shiny session

Registers a
[`duckdb_reader()`](https://r.ggsql.org/reference/duckdb_reader.md) for
use by all
[`renderGgsql()`](https://r.ggsql.org/reference/ggsqlOutput.md) outputs
in the current Shiny session. Must be called from within a Shiny server
function (i.e., while a session is active). The reader is automatically
cleaned up when the session ends.

## Usage

``` r
ggsql_session_reader(reader, session = shiny::getDefaultReactiveDomain())
```

## Arguments

- reader:

  A `Reader` object created by
  [`duckdb_reader()`](https://r.ggsql.org/reference/duckdb_reader.md).

- session:

  The Shiny session object. Defaults to the current session.

## Value

The `reader`, invisibly.

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
