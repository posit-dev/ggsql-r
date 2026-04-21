# Validate a ggsql query

Checks query syntax and semantics without executing SQL. Returns a
validation result that can be inspected for errors and warnings.

## Usage

``` r
ggsql_validate(query)

ggsql_has_visual(x)

ggsql_is_valid(x)
```

## Arguments

- query:

  A ggsql query string.

- x:

  A `ggsql_validated` object

## Value

A `ggsql_validated` object for `ggsql_validate()`. A boolean for
`ggsql_has_visual()` and `ggsql_is_valid()`

## Examples

``` r
result <- ggsql_validate("SELECT 1 AS x, 2 AS y VISUALISE x, y DRAW point")
result
#> <ggsql_validated> [valid]
#> • Has VISUALISE clause
```
