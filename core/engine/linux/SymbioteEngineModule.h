#pragma once

#include <SymbioteEngineSpecJSI.h>
#include <memory>

namespace facebook::react {

class SymbioteEngineModule final
    : public NativeSymbioteEngineCxxSpec<SymbioteEngineModule> {
 public:
  explicit SymbioteEngineModule(std::shared_ptr<CallInvoker> jsInvoker);
  double getVersion(jsi::Runtime &runtime);

 private:
  bool installed_ = false;
};

} // namespace facebook::react
