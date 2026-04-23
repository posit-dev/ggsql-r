library(shiny)
library(ggsql)

ui <- fluidPage(
  tags$p("The ggsqlOutput container owns the chart size (fixed height)."),
  tags$p("Resize the bordered box horizontally from about 900px down below 450px."),
  tags$p("The chart should relayout within the fixed output box without changing host height (no vertical drift)."),
  tags$p("Below 450px, the chart should remain legible via inner scaling only; returning above 450px should remove the transform."),
  tags$div(
    style = paste(
      "width: 900px;",
      "min-width: 240px;",
      "max-width: 100%;",
      "resize: horizontal;",
      "overflow: auto;",
      "border: 1px solid #ccc;",
      "padding: 8px;"
    ),
    ggsqlOutput("chart", height = "360px")
  )
)

server <- function(input, output, session) {
  ggsql_session_reader(duckdb_reader())

  output$chart <- renderGgsql({
    "
    SELECT mpg, disp, cyl
    FROM r:mtcars
    VISUALISE mpg AS x, disp AS y
    DRAW point
    FACET cyl
    "
  })
}

shinyApp(ui, server)
