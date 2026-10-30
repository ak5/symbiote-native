---
'@symbiote-native/engine': patch
---

Instrument Linux accessibility transport Rust dependencies and rebuild its
standard library in ASan/TSan builds, using the C++ sanitizer runtime. Pin the
nightly toolchain in native CI and require instrumentation symbols before runtime
tests, including TSan atomic operations.
