
<!-- README.md is generated from README.Rmd. Please edit that file -->

# ggsql <img src="man/figures/logo.png" align="right" height="138" alt="" />

<!-- badges: start -->

[![R-CMD-check](https://github.com/posit-dev/ggsql-r/actions/workflows/R-CMD-check.yaml/badge.svg)](https://github.com/posit-dev/ggsql-r/actions/workflows/R-CMD-check.yaml)
[![Codecov test
coverage](https://codecov.io/gh/posit-dev/ggsql-r/graph/badge.svg)](https://app.codecov.io/gh/posit-dev/ggsql-r)
<!-- badges: end -->

The ggsql R package provides rust bindings to the
[ggsql](https://ggsql.org) visualization tool so that you can hook up
readers and writers to it, execute queries, and visualize the result. It
also contain a knitr engine for supporting `ggsql` blocks, with
facilities for bidirectional data flow between R, Python, and ggsql
blocks. This means that you can prepare some data in one block using
dplyr or pandas, and then visualize it with ggsql in a different block
without having to do anything to pass the data around.

## Installation

You can install the development version of ggsql from
[GitHub](https://github.com/) with:

``` r
# install.packages("pak")
pak::pak("posit-dev/ggsql")
```

## Example

While one of the core appeals of the ggsql R package is the knitr engine
it provides, you can also use it directly in R to execute visual
queries:

``` r
library(ggsql)

# Create an in-memory DuckDB reader
reader <- duckdb_reader()

# Register a dataset in it
ggsql_register(reader, mtcars, "amazing_data")

# Visualize it with a query
ggsql_execute(reader, "
VISUALIZE mpg AS x, disp AS y FROM amazing_data
DRAW point
")
```

![](man/figures/README-unnamed-chunk-2-1.svg)

We could achieve the same in a ggsql code block by referencing an R
dataset directly using the `r:` prefix

``` ggsql
VISUALIZE mpg AS x, disp AS y FROM r:mtcars
DRAW point
LABEL
  title => 'That data came from R 🤯'
```

![](man/figures/README-unnamed-chunk-3-1.svg)

The only thing you need to remember is to load ggsql into R in your
Rmarkdown/Quarto document so the knitr engine is registered.
