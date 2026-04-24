test_that("tools/check-js.sh emits skip message when tools missing", {
  skip_on_cran()

  shell_path <- Sys.which("sh")
  if (!nzchar(shell_path)) {
    skip("POSIX `sh` not available")
  }

  script_path <- normalizePath(
    testthat::test_path("..", "..", "tools", "check-js.sh"),
    mustWork = TRUE
  )

  placeholder_dir <- tempfile("js-helper-path-")
  dir.create(placeholder_dir, recursive = TRUE)
  on.exit(unlink(placeholder_dir, recursive = TRUE), add = TRUE)

  raw_output <- system2(
    shell_path,
    args = script_path,
    stdout = TRUE,
    stderr = TRUE,
    env = c(sprintf("PATH=%s", placeholder_dir))
  )
  exit_status <- attr(raw_output, "status")
  if (is.null(exit_status)) {
    exit_status <- 0L
  }

  output_text <- paste(raw_output, collapse = "\n")

  expect_equal(exit_status, 0L)
  expect_match(
    output_text,
    "skipping JS verification",
    ignore.case = TRUE
  )
})
