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
    "Run `npm run check` to rebuild `inst/htmlwidgets/ggsql_vega.js` from `srcts/`",
    "Create the GitHub Release for this version *before* submitting to CRAN (`gh release create v<version> --notes-file NEWS.md --target main`) so the `release-vendor.yaml` workflow can attach `vendor.tar.xz` + `vendor.tar.xz.sha256` to it",
    "Confirm the `release-vendor.yaml` workflow run finished and both assets are listed on the release page",
    "Smoke-test the externalized vendor path: in a clean checkout without `src/rust/vendor.tar.xz` or `src/rust/vendor/`, run `R CMD build .` and `R CMD INSTALL` the resulting tarball - install should download the archive from the release"
  )
}
