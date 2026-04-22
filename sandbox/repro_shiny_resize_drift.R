library(shiny)
library(ggsql)

ui <- fluidPage(
  tags$p("Resize the bordered box horizontally from about 900px down to about 760px."),
  tags$p("The faceted chart should relayout continuously as width changes."),
  tags$div(
    style = paste(
      "width: 900px;",
      "min-width: 720px;",
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
