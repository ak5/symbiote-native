#include "SymbioteEngineModule.h"
#include "SymbioteEngineBindings.h"
#include <utility>

namespace facebook::react {

SymbioteEngineModule::SymbioteEngineModule(std::shared_ptr<CallInvoker> jsInvoker)
    : NativeSymbioteEngineCxxSpec(std::move(jsInvoker)) {}

double SymbioteEngineModule::getVersion(jsi::Runtime &runtime) {
  // The generated factory has no runtime; this synchronous probe precedes every engine consumer.
  if (!installed_) {
    symbiote::installBindings(runtime);
    installed_ = true;
  }
  return symbiote::kNativeVersion;
}

} // namespace facebook::react
