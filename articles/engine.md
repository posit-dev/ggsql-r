# The ggsql knitr engine

``` r
library(ggsql)
```

The main selling point of the ggsql R package is arguably it’s knitr
engine that allows you to add
[ggsql](https://posit-dev.github.io/ggsql-r/) blocks to your Rmarkdown
and Quarto documents. While ggsql also provides a Jupyter kernel that
Quarto can use, Jupyter only allows a single kernel at a time, so if you
wish to mix R and/or Python blocks with ggsql visualizations, then the
ggsql knitr engine is the way.
