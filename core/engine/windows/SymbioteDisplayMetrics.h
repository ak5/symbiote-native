#pragma once

#include <windows.h>
#include <cmath>
#include <functional>
#include <memory>
#include <mutex>
#include <optional>
#include <utility>
#include <NativeModules.h>
#include <ReactPropertyBag.h>
#include <winrt/Windows.UI.ViewManagement.h>

namespace symbiote::windows::detail {

namespace React = winrt::Microsoft::ReactNative;

constexpr double scaleForDpi(UINT dpi) noexcept { return dpi / 96.0; }
static_assert(scaleForDpi(96) == 1 && scaleForDpi(120) == 1.25 && scaleForDpi(144) == 1.5 && scaleForDpi(192) == 2);

struct DisplayMetrics {
  double width, height, screenWidth, screenHeight;
  UINT dpi;
  double fontScale;
  bool operator==(DisplayMetrics const &) const = default;

  static std::optional<DisplayMetrics> Read(HWND window, double fontScale) noexcept {
    RECT client{};
    MONITORINFO monitor{sizeof(MONITORINFO)};
    const auto dpi = GetDpiForWindow(window);
    if (!dpi || !std::isfinite(fontScale) || fontScale <= 0 ||
        !GetClientRect(window, &client) ||
        !GetMonitorInfoW(MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST), &monitor)) return {};
    if (client.right < client.left || client.bottom < client.top ||
        monitor.rcMonitor.right <= monitor.rcMonitor.left || monitor.rcMonitor.bottom <= monitor.rcMonitor.top) return {};
    return DisplayMetrics{double(client.right - client.left), double(client.bottom - client.top),
                          double(monitor.rcMonitor.right - monitor.rcMonitor.left),
                          double(monitor.rcMonitor.bottom - monitor.rcMonitor.top), dpi, fontScale};
  }

  React::JSValueObject Payload() const {
    const auto metric = [this](double w, double h) {
      return React::JSValueObject{{"width", w}, {"height", h}, {"scale", scaleForDpi(dpi)},
                                  {"fontScale", fontScale}, {"densityDpi", double(dpi)}};
    };
    return {{"windowPhysicalPixels", metric(width, height)},
            {"screenPhysicalPixels", metric(screenWidth, screenHeight)}};
  }
};

// UI messages produce snapshots; module initialization and constants can run on the JS thread.
class DisplayMetricsState final {
 public:
  explicit DisplayMetricsState(DisplayMetrics snapshot) : snapshot_(snapshot) {}

  React::JSValueObject Payload() const {
    std::lock_guard lock(mutex_);
    return snapshot_.Payload();
  }

  void Subscribe(std::function<void(React::JSValueObject &&)> callback) {
    std::lock_guard lock(mutex_);
    callback_ = std::move(callback);
  }

  void Update(DisplayMetrics snapshot) {
    std::function<void(React::JSValueObject &&)> callback;
    {
      std::lock_guard lock(mutex_);
      if (snapshot_ == snapshot) return;
      snapshot_ = snapshot;
      callback = callback_;
    }
    if (callback) callback(snapshot.Payload());
  }

 private:
  mutable std::mutex mutex_;
  DisplayMetrics snapshot_;
  std::function<void(React::JSValueObject &&)> callback_;
};

inline auto const &DisplayMetricsProperty() {
  static const React::ReactPropertyId<React::ReactNonAbiValue<std::shared_ptr<DisplayMetricsState>>> key{
      L"SymbioteNative.Windows", L"DisplayMetrics"};
  return key;
}

REACT_MODULE_NOREG(DisplayMetricsModule)
struct DisplayMetricsModule : std::enable_shared_from_this<DisplayMetricsModule> {
  REACT_INIT(Initialize)
  void Initialize(React::ReactContext const &context) noexcept {
    context_ = context;
    // Only WindowMessages registers this provider, after installing its own state in these properties.
    const auto holder = context.Properties().Get(DisplayMetricsProperty());
    WINRT_ASSERT(holder && *holder);
    state_ = *holder;
    state_->Subscribe([weak = weak_from_this()](React::JSValueObject &&payload) {
      if (const auto self = weak.lock())
        self->context_.EmitJSEvent(L"RCTDeviceEventEmitter", L"didUpdateDimensions", payload);
    });
  }

  REACT_CONSTANT_PROVIDER(GetConstants)
  void GetConstants(React::ReactConstantProvider &provider) noexcept {
    provider.Add(L"Dimensions", state_->Payload());
  }

 private:
  React::ReactContext context_;
  std::shared_ptr<DisplayMetricsState> state_;
};

struct DisplayMetricsProvider : winrt::implements<DisplayMetricsProvider, React::IReactPackageProvider> {
  void CreatePackage(React::IReactPackageBuilder const &builder) noexcept {
    builder.AddModule(L"DeviceInfo", React::MakeModuleProvider<DisplayMetricsModule>());
  }
};

} // namespace symbiote::windows::detail
