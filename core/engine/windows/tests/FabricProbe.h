#pragma once

// SDK-boundary probe only. The production retained tree is not implemented here.
#include <ReactCommon/TurboModule.h>
#include <cstdlib>
#include <cstring>
#include <fstream>

namespace symbiote::windows::probe {
namespace jsi = facebook::jsi;

inline void report(const std::string &message) {
  const char *path = std::getenv("SYMBIOTE_PROBE_LOG");
  if (path != nullptr) std::ofstream(path, std::ios::app) << message << '\n';
}

struct State final : jsi::NativeState {
  int value = 42;
};

inline void commitAndMeasure(
    jsi::Runtime &runtime, jsi::Object &fabric, const jsi::Object &node,
    double surface, double width) {
  auto children = fabric.getPropertyAsFunction(runtime, "createChildSet").call(runtime, surface);
  fabric.getPropertyAsFunction(runtime, "appendChildToSet").call(runtime, children, node);
  fabric.getPropertyAsFunction(runtime, "completeRoot").call(runtime, surface, children);
  auto measured = std::make_shared<bool>(false);
  auto callback = jsi::Function::createFromHostFunction(
      runtime, jsi::PropNameID::forAscii(runtime, "verifyLayout"), 6,
      [measured, width](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) {
        if (count != 6 || args[2].asNumber() != width || args[3].asNumber() != 80) {
          throw jsi::JSError(rt, "Fabric layout did not reflect the C++ commit");
        }
        *measured = true;
        return jsi::Value::undefined();
      });
  fabric.getPropertyAsFunction(runtime, "measure").call(runtime, node, callback);
  if (!*measured) throw jsi::JSError(runtime, "Fabric measure did not call back synchronously");
}

struct FabricProbe final : facebook::react::TurboModule {
  explicit FabricProbe(std::shared_ptr<facebook::react::CallInvoker> invoker)
      : TurboModule("SymbioteFabricProbe", std::move(invoker)) {}

  jsi::Value create(jsi::Runtime &runtime, const jsi::PropNameID &name) override {
    const auto method = name.utf8(runtime);
    if (method == "reportFailure") {
      return jsi::Function::createFromHostFunction(
          runtime, name, 1,
          [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) {
            report(count == 1 ? "FAIL: " + args[0].asString(rt).utf8(rt) : "FAIL: missing error");
            return jsi::Value::undefined();
          });
    }
    if (method != "run") return jsi::Value::undefined();
    return jsi::Function::createFromHostFunction(
        runtime, name, 1,
        [](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) {
          if (count != 1 || !args[0].isNumber()) throw jsi::JSError(rt, "Expected native surface tag");
          report("START: Windows ABI runtime");
          jsi::Object handle(rt);
          handle.setNativeState(rt, std::make_shared<State>());
          if (handle.getNativeState<State>(rt)->value != 42) {
            throw jsi::JSError(rt, "NativeState did not survive the SDK boundary");
          }
          // Allocate through Hermes: RNW's MutableBuffer constructor is unimplemented.
          auto words = rt.global().getPropertyAsFunction(rt, "Int32Array").callAsConstructor(rt, 4).asObject(rt);
          auto buffer = words.getPropertyAsObject(rt, "buffer").getArrayBuffer(rt);
          const int32_t sentinel = 42;
          if (buffer.size(rt) != 16) throw jsi::JSError(rt, "Unexpected command buffer size");
          std::memcpy(buffer.data(rt), &sentinel, sizeof(sentinel));
          if (words.getProperty(rt, "0").asNumber() != sentinel) {
            throw jsi::JSError(rt, "ArrayBuffer memory is not shared with Hermes");
          }
          auto fabric = rt.global().getPropertyAsObject(rt, "nativeFabricUIManager");
          jsi::Object props(rt);
          props.setProperty(rt, "width", 120);
          props.setProperty(rt, "height", 80);
          props.setProperty(rt, "backgroundColor", static_cast<double>(0xff234567u));
          auto node = fabric.getPropertyAsFunction(rt, "createNode")
              .call(rt, 1048576, jsi::String::createFromAscii(rt, "RCTView"), args[0], props, handle).asObject(rt);
          commitAndMeasure(rt, fabric, node, args[0].asNumber(), 120);
          jsi::Object changed(rt);
          changed.setProperty(rt, "width", 240);
          auto updated = fabric.getPropertyAsFunction(rt, "cloneNodeWithNewProps").call(rt, node, changed).asObject(rt);
          commitAndMeasure(rt, fabric, updated, args[0].asNumber(), 240);
          report("PASS: NativeState, shared command buffer, Fabric create/clone/commit/measure 120->240");
          return jsi::Value::undefined();
        });
  }
};
} // namespace symbiote::windows::probe
