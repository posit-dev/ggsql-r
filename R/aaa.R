check_custom <- function(
  x,
  test,
  expected,
  ...,
  allow_null = FALSE,
  arg = caller_arg(x),
  call = caller_env()
) {
  if (!missing(x) && ((allow_null && is.null(x)) || test(x))) {
    return(invisible(NULL))
  }

  stop_input_type(
    x,
    expected,
    ...,
    allow_na = FALSE,
    allow_null = allow_null,
    arg = arg,
    call = call
  )
}

check_r6 <- function(
  x,
  class,
  ...,
  allow_null = FALSE,
  arg = caller_arg(x),
  call = caller_env()
) {
  check_custom(x, function(x) R6::is.R6(x) && inherits(x, class), paste0("a ", class, "/R6 object"))
}
