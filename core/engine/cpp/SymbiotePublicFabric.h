#pragma once

#include <jsi/jsi.h>
#include <utility>

namespace symbiote {

// No native host objects cross this boundary; RNW exposes Fabric through its JSI ABI.
class PublicFabric {
 public:
  explicit PublicFabric(facebook::jsi::Runtime &runtime)
      : runtime_(runtime), binding_(runtime.global().getPropertyAsObject(runtime, "nativeFabricUIManager")) {}

  template <typename... Args>
  facebook::jsi::Value call(const char *method, Args &&...args) {
    return binding_.getPropertyAsFunction(runtime_, method).call(runtime_, std::forward<Args>(args)...);
  }

 private:
  facebook::jsi::Runtime &runtime_;
  facebook::jsi::Object binding_;
};

} // namespace symbiote
