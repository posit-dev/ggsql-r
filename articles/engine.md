# The ggsql knitr engine

``` r
library(ggsql)
```

The main selling point of the ggsql R package is arguably it’s knitr
engine that allows you to add [ggsql](https://r.ggsql.org) blocks to
your Rmarkdown and Quarto documents. While ggsql also provides a Jupyter
kernel that Quarto can use, Jupyter only allows a single kernel at a
time, so if you wish to mix R and/or Python blocks with ggsql
visualizations, then the ggsql knitr engine is the way.

This vignette will show you how to set it up and use it.

## Registering the engine

Before knitr knows what to do with a [ggsql](https://r.ggsql.org) code
chunk you need to register the ggsql engine. Registration happens
automatically when ggsql is loaded, so the only thing required is to
load the package in the setup chunk:

```` markdown
```{r setup}
library(ggsql) # register the engine

# Other stuff you may want to do
set.seed(7)
```
````

## The `{ggsql}` chunk

Once you’ve registered the engine you can now begin to add
[ggsql](https://r.ggsql.org) blocks to your document containing ggsql
queries:

```` markdown
```{ggsql}
VISUALIZE species AS x FROM ggsql:penguins
DRAW bar
```
````

Which, when rendered will result in:

``` ggsql
VISUALIZE species AS x FROM ggsql:penguins
DRAW bar
```

If the code only contains a pure SQL query, then the table is returned:

``` ggsql
SELECT COUNT(*) AS count, species FROM ggsql:penguins
GROUP BY species
```

| count | species   |
|------:|:----------|
|   124 | Gentoo    |
|   152 | Adelie    |
|    68 | Chinstrap |

### Chunk options

The ggsql knitr engine responds to all the standard plot related chunk
options you are familiar with. However, there are a few exceptions:

- `dev` and `dev.args`: ggsql does not use the R graphics device system
  for rendering
- `fig.showtext`: The showtext package works with the graphics device
  system
- `external` and `sanitize`: ggsql does not use the tikz system for
  rendering

In addition to the standards there are two new options you can use:

- `connection`
- `writer`

Both will be described below.

The ggsql engine supports inline chunk options, using both the standard
SQL comment chararcters (`--`) and the R comment character that many
users will find recognizable for chunk options. Either of these,
proceeded by the pipe character (`--|` and `#|`) will mark a chunk
option line as long as they are the first appearing in the chunk.

#### Defining a backend

By default, a ggsql chunk will provide an in memory DuckDB writer when
used with the knitr engine. This is fine as long as you don’t need to
interact directly with data from your warehouse. If you need something
else you can provide a different connection string in the `connection`
chunk option. Chunks that use the same connection will use the same
writer, so temporary tables and views will be accessible across chunks.
To interact directly with a file based DuckDB database living at
`/data/users.db` you’d set it like so:

```` markdown
```{ggsql}
--| connection: duckdb:///data/users.db
VISUALIZE ...
```
````

#### Choosing a writer

ggsql doesn’t have the concept of graphics devices as you may be
familiar with from R. Instead it has *writers* which are responsible for
rendering. Currently we only provide a Vega-Lite writer, but it comes in
three flavors in the knitr engine: `vegalite`, `vegalite_svg`, and
`vegalite_png`. The former renders to a Vega-Lite spec which is then
rendered to the final graphic when the page HTML is rendered. The latter
two uses Vega-Lite off-screen to render to SVG and PNG respectively,
making the final document fully stand-alone. The default for HTML
documents is to use the `vegalite` writer and for PDF to use the
`vegalite_png` writer, but you can overwrite this using the `writer`
option:

```` markdown
```{ggsql}
--| writer: vegalite_svg
VISUALIZE ...
```
````

The `writer` option also affects rendering of `Spec` objects (as
returned by
[`ggsql_execute()`](https://r.ggsql.org/reference/ggsql_execute.md)) in
standard `{r}` code chunks.

## Communicating with R and Python

The big selling point of the knitr engine over the ggsql Jupyter kernel
is its ability to co-exist with R and Python chunks and use data defined
in them. This means you can bring data into R, do some manipulation or
statistical analysis that would be difficult to express in SQL, and then
use ggsql to directly visualize it.

The way this works borrows the syntax from referencing built-in data in
ggsql. Above, we used `ggsql:penguins` to refer to the penguins dataset
shipped with ggsql. Likewise, you can prefix a table with `r:` and `py:`
to refer to data from the documents R and Python chunks respectively:

``` r
gapminder_2002 <- gapminder::gapminder[gapminder::gapminder$year == 2002, ]
```

``` ggsql
VISUALIZE gdpPercap AS x, lifeExp AS y FROM r:gapminder_2002
DRAW point
  MAPPING continent AS stroke, pop AS size
  SETTING fill => null
LABEL
  title => 'Rendering data from R'
```

### Getting data back from ggsql

While there is certainly more use from the above direction of
communication it is also possible to use tables or views created in
ggsql chunks from R and Python. The way this works mirrors how R and
Python communicate with each other. The ggsql knitr engine provides a
`sql` object in the R and Python environments respectively which can be
indexed to return any table or view available in the ggsql backend. If
your document uses multiple ggsql backends the `connection` option of
the R/Python chunk determines which backend is used to reference into:

``` ggsql
CREATE VIEW may_airquality AS 
SELECT * FROM ggsql:airquality
WHERE Month = 5
```

``` ggsql
CREATE TABLE penguin_count AS 
SELECT COUNT(*) AS number, species FROM ggsql:penguins
GROUP BY species
```

``` r
names(sql)
#> [1] "may_airquality" "penguin_count"

sql$penguin_count
#>   number   species
#> 1    152    Adelie
#> 2     68 Chinstrap
#> 3    124    Gentoo
```
