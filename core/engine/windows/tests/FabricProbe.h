#pragma once

// SDK-boundary probe only. The production retained tree is not implemented here.
#include <ReactCommon/TurboModule.h>
#include "SymbioteBuffer.h"
#include <cstring>
#include <fstream>
#include <limits>

namespace symbiote::windows::probe {
namespace jsi = facebook::jsi;

inline void report(const std::string &message) {
  std::ofstream("windows-fabric-runtime.log", std::ios::app) << message << '\n';
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
    if (method == "reportFailure" || method == "reportResult") {
      const std::string prefix = method == "reportFailure" ? "FAIL: " : "PASS: ";
      return jsi::Function::createFromHostFunction(
          runtime, name, 1,
          [prefix](jsi::Runtime &rt, const jsi::Value &, const jsi::Value *args, size_t count) {
            report(count == 1 ? prefix + args[0].asString(rt).utf8(rt) : "FAIL: missing message");
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
          const jsi::Value length(4);
          auto words = allocInt32Array(rt, jsi::Value::undefined(), &length, 1).asObject(rt);
          for (size_t index = 0; index < 4; ++index) {
            if (words.getProperty(rt, std::to_string(index).c_str()).asNumber() != 0) {
              throw jsi::JSError(rt, "Command buffer must start zeroed");
            }
          }
          auto buffer = words.getPropertyAsObject(rt, "buffer").getArrayBuffer(rt);
          const int32_t sentinel = 42;
          if (buffer.size(rt) != 16) throw jsi::JSError(rt, "Unexpected command buffer size");
          std::memcpy(buffer.data(rt), &sentinel, sizeof(sentinel));
          if (words.getProperty(rt, "0").asNumber() != sentinel) {
            throw jsi::JSError(rt, "ArrayBuffer memory is not shared with Hermes");
          }
          words.setProperty(rt, "0", -17);
          int32_t fromScript = 0;
          std::memcpy(&fromScript, buffer.data(rt), sizeof(fromScript));
          if (fromScript != -17) throw jsi::JSError(rt, "Native buffer did not see JS write");
          const jsi::Value zero(0);
          auto empty = allocInt32Array(rt, jsi::Value::undefined(), &zero, 1).asObject(rt);
          if (empty.getProperty(rt, "length").asNumber() != 0) {
            throw jsi::JSError(rt, "Zero-length allocation failed");
          }
          const jsi::Value invalid[] = {
              jsi::Value(-1), jsi::Value(0.5), jsi::Value(std::numeric_limits<double>::infinity()),
              jsi::Value(std::numeric_limits<double>::quiet_NaN()), jsi::Value::undefined(),
              jsi::Value(jsi::String::createFromAscii(rt, "4"))};
          for (const auto &value : invalid) {
            bool rejected = false;
            try { allocInt32Array(rt, jsi::Value::undefined(), &value, 1); }
            catch (const jsi::JSError &) { rejected = true; }
            if (!rejected) throw jsi::JSError(rt, "Invalid buffer length was accepted");
          }
          bool missingRejected = false;
          try { allocInt32Array(rt, jsi::Value::undefined(), nullptr, 0); }
          catch (const jsi::JSError &) { missingRejected = true; }
          if (!missingRejected) throw jsi::JSError(rt, "Missing buffer length was accepted");
          auto fabric = rt.global().getPropertyAsObject(rt, "nativeFabricUIManager");
          jsi::Object props(rt);
          props.setProperty(rt, "width", 120);
          props.setProperty(rt, "height", 80);
          props.setProperty(rt, "backgroundColor", static_cast<double>(0xff234567u));
          auto node = fabric.getPropertyAsFunction(rt, "createNode")
              .call(rt, 67108864, jsi::String::createFromAscii(rt, "RCTView"), args[0], props, handle).asObject(rt);
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
