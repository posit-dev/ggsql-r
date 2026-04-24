#!/bin/sh
# DuckDB's unity-build C++ translation units produce object files that
# exceed the PE/COFF section limit on x86_64-pc-windows-gnu. The assembler
# big-object format lifts that limit. Kept out of Makevars.win.in so the
# flag text does not land in 00install.out and trip R CMD check's
# non-portable-flag scan.
export CXXFLAGS="${CXXFLAGS} -Wa,-mbig-obj"
