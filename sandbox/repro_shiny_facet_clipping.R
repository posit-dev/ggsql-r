library(shiny)
library(ggsql)

ui <- fluidPage(
  tags$p("This query creates 6 facets, so the widget should need 2 rows."),
  tags$p("If the bug is present, the lower row is clipped instead of fitting cleanly."),
  tags$div(
    style = "width: 900px; max-width: 100%; border: 1px solid #ccc; padding: 8px;",
    ggsqlOutput("chart", height = "360px")
  )
)

server <- function(input, output, session) {
  ggsql_session_reader(duckdb_reader())

  output$chart <- renderGgsql({
    "
    SELECT mpg, disp, carb
    FROM r:mtcars
    VISUALISE mpg AS x, disp AS y
    DRAW point
    FACET carb
    "
  })
}

shinyApp(ui, server)
