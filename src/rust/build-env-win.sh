#!/bin/sh
# DuckDB's unity-build C++ translation units produce object files that
# exceed the PE/COFF section limit on x86_64-pc-windows-gnu. The assembler
# big-object format lifts that limit. Kept out of Makevars.win.in so the
# flag text does not land in 00install.out and trip R CMD check's
# non-portable-flag scan.
export CXXFLAGS="${CXXFLAGS} -Wa,-mbig-obj"

# On Windows arm64 the host rustc triple is aarch64-pc-windows-msvc, and
# cargo compiles build scripts (libduckdb-sys -> reqwest -> rustls -> ring)
# for that host triple. ring's build.rs hardcodes clang as its C compiler on
# Windows aarch64, but the clang shipped with Rtools (llvm-mingw) has no MSVC
# sysroot, so <assert.h> is not found. cc-rs appends per-target env CFLAGS
# after its own flags, so this trailing --target wins and redirects those
# host-only objects to the mingw sysroot that Rtools clang does have; the
# resulting COFF objects link fine into the build-script executables.
# Skipped when a real MSVC environment (INCLUDE) is available.
host_triple=$(rustc -vV 2>/dev/null | sed -n 's/^host: //p')
if [ "$host_triple" = "aarch64-pc-windows-msvc" ] && [ -z "${INCLUDE}" ]; then
  export CFLAGS_aarch64_pc_windows_msvc="--target=aarch64-w64-mingw32"
fi
