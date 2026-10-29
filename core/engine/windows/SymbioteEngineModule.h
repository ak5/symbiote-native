#pragma once

#include <ReactCommon/TurboModule.h>
#include "SymbioteEngineBindings.h"
#include <utility>

namespace symbiote::windows {

// Register with AddTurboModuleProvider<SymbioteEngineModule>(builder, L"SymbioteEngine").
class SymbioteEngineModule final : public facebook::react::TurboModule {
 public:
  explicit SymbioteEngineModule(std::shared_ptr<facebook::react::CallInvoker> invoker)
      : TurboModule("SymbioteEngine", std::move(invoker)) {}

  facebook::jsi::Value create(
      facebook::jsi::Runtime &runtime, const facebook::jsi::PropNameID &name) override {
    namespace jsi = facebook::jsi;
    if (name.utf8(runtime) != "getVersion") return jsi::Value::undefined();
    return jsi::Function::createFromHostFunction(
        runtime, name, 0,
        [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *, size_t) {
          // A host may recreate the module; bindings belong to the runtime and must survive lookup.
          if (rt.global().getProperty(rt, "__symbioteEngineNative").isUndefined()) {
            symbiote::installBindings(rt);
          }
          return jsi::Value(symbiote::kNativeVersion);
        });
  }
};

} // namespace symbiote::windows
