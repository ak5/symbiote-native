#pragma once

#include <jsi/jsi.h>
#include <cmath>

namespace symbiote {

inline facebook::jsi::Value allocInt32Array(
    facebook::jsi::Runtime &runtime,
    const facebook::jsi::Value & /*thisValue*/,
    const facebook::jsi::Value *arguments,
    size_t count) {
  namespace jsi = facebook::jsi;
  if (count < 1 || !arguments[0].isNumber()) {
    throw jsi::JSError(runtime, "allocInt32Array expects a length in elements");
  }
  const double requested = arguments[0].getNumber();
  if (!std::isfinite(requested) || requested < 0 || requested != std::floor(requested)) {
    throw jsi::JSError(runtime, "allocInt32Array expects a non-negative integer length");
  }
  // RNW cannot wrap MutableBuffer; runtime-owned storage still exposes the same bytes to C++.
  return runtime.global().getPropertyAsFunction(runtime, "Int32Array")
      .callAsConstructor(runtime, requested);
}

} // namespace symbiote
