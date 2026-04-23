library(shiny)
library(ggsql)

ui <- fluidPage(
  tags$p("The ggsqlOutput container owns the chart size (fixed height)."),
  tags$p("This query creates 6 facets (2 rows). The lower row should not be clipped."),
  tags$p("The host height should not change after render; the chart should relayout within the fixed output box."),
  tags$p("If the page becomes narrower than 450px, the chart should scale visually without changing host size."),
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
