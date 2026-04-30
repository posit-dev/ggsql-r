.onLoad <- function(lib, pkg) {
  run_on_load()
}

 .onUnload <- function(libpath) {
   unlink(file.path(tempdir(), c("penguins.parquet", "airquality.parquet")))
 }

release_bullets <- function() {
  c(
    "Bump rust version to match package version",
    "Re-vendor rust dependencies",
    "Run `rextendr::document()` to refresh extendr wrappers and Rd files",
    "Run `npm run check` to rebuild `inst/htmlwidgets/ggsql_vega.js` from `srcts/`"
  )
}
