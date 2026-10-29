#include "SymbioteEngineModule.h"
#include "SymbioteEngineBindings.h"
#include <utility>

namespace facebook::react {

SymbioteEngineModule::SymbioteEngineModule(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeSymbioteEngineCxxSpec(std::move(jsInvoker)) {}

double SymbioteEngineModule::getVersion(jsi::Runtime &runtime) {
  // The host can create a fresh module on each lookup; bindings belong to the runtime, not this instance.
  if (runtime.global().getProperty(runtime, "__symbioteEngineNative").isUndefined()) {
    symbiote::installBindings(runtime);
  }
  return symbiote::kNativeVersion;
}

} // namespace facebook::react
