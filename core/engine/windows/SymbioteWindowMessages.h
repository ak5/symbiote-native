#pragma once

#include <windows.h>
#include <commctrl.h>
#include <memory>
#include <unordered_map>
#include <DesktopWindowBridge.h>
#include "SymbioteDisplayMetrics.h"

#pragma comment(lib, "comctl32.lib")

namespace symbiote::windows {

// Own the host's window notifications and opt in to client-area, DPI-aware DeviceInfo.
class WindowMessages final {
 public:
  WindowMessages(HWND window, winrt::Microsoft::ReactNative::ReactInstanceSettings const &settings)
      : window_(window), notifications_(settings.Notifications()), properties_(settings.Properties()) {
    const auto snapshot = detail::DisplayMetrics::Read(window_, uiSettings_.TextScaleFactor());
    if (!snapshot) throw winrt::hresult_error(E_FAIL, L"Cannot read native display metrics");
    if (properties_.Get(detail::DisplayMetricsProperty()))
      throw winrt::hresult_invalid_argument(L"Display metrics are already configured for this React host");
    metrics_ = std::make_shared<detail::DisplayMetricsState>(*snapshot);
    textScaleMessage_ = RegisterWindowMessageW(L"SymbioteNative.Windows.TextScaleFactorChanged");
    if (!textScaleMessage_) winrt::throw_last_error();
    textScaleChanged_ = uiSettings_.TextScaleFactorChanged(winrt::auto_revoke,
        [window, message = textScaleMessage_](auto const &, auto const &) { PostMessageW(window, message, 0, 0); });
    const auto providers = settings.PackageProviders();
    const auto provider = winrt::make<detail::DisplayMetricsProvider>();
    properties_.Set(detail::DisplayMetricsProperty(), metrics_);
    try {
      providers.Append(provider);
    } catch (...) {
      properties_.Remove(detail::DisplayMetricsProperty());
      throw;
    }
    // Install last: a throwing constructor must never leave a subclass pointing at an unconstructed object.
    if (!SetWindowSubclass(window_, HandleMessage, reinterpret_cast<UINT_PTR>(this),
                           reinterpret_cast<DWORD_PTR>(this))) {
      providers.RemoveAtEnd();
      properties_.Remove(detail::DisplayMetricsProperty());
      throw winrt::hresult_error(E_FAIL, L"Cannot attach the host window message bridge");
    }
  }

  WindowMessages(WindowMessages const &) = delete;
  WindowMessages &operator=(WindowMessages const &) = delete;

  ~WindowMessages() {
    textScaleChanged_.revoke();
    metrics_->Subscribe({});
    if (window_) RemoveWindowSubclass(window_, HandleMessage, reinterpret_cast<UINT_PTR>(this));
    // DeviceInfo is cached per host; retain its state to reject rebinding that runtime to a second window.
  }

 private:
  void UpdateMetrics() noexcept {
    try {
      if (const auto snapshot = detail::DisplayMetrics::Read(window_, uiSettings_.TextScaleFactor()))
        metrics_->Update(*snapshot);
      else
        OutputDebugStringW(L"SymbioteNative: cannot update native display metrics; keeping the previous snapshot\n");
    } catch (winrt::hresult_error const &) {
      OutputDebugStringW(L"SymbioteNative: native display metrics update failed\n");
    }
  }

  static LRESULT CALLBACK HandleMessage(HWND window, UINT message, WPARAM wParam, LPARAM lParam,
                                       UINT_PTR id, DWORD_PTR data) noexcept {
    auto self = reinterpret_cast<WindowMessages *>(data);
    if (message == WM_NCDESTROY) {
      self->textScaleChanged_.revoke();
      self->metrics_->Subscribe({});
      RemoveWindowSubclass(window, HandleMessage, id);
      self->window_ = nullptr;
      return DefSubclassProc(window, message, wParam, lParam);
    }
    if (message == WM_WINDOWPOSCHANGED) {
      const auto position = reinterpret_cast<WINDOWPOS const *>(lParam);
      if (!(position->flags & SWP_NOSIZE)) {
        winrt::Microsoft::ReactNative::ForwardWindowMessage(
            self->notifications_, window, message, wParam, lParam);
      }
    }
    const auto result = DefSubclassProc(window, message, wParam, lParam);
    if (message == WM_WINDOWPOSCHANGED || message == WM_DPICHANGED || message == WM_DISPLAYCHANGE ||
        message == WM_SETTINGCHANGE || message == self->textScaleMessage_) self->UpdateMetrics();
    return result;
  }

  HWND window_;
  winrt::Microsoft::ReactNative::ReactNotificationService notifications_;
  winrt::Microsoft::ReactNative::ReactPropertyBag properties_;
  winrt::Windows::UI::ViewManagement::UISettings uiSettings_;
  winrt::Windows::UI::ViewManagement::UISettings::TextScaleFactorChanged_revoker textScaleChanged_;
  UINT textScaleMessage_{};
  std::shared_ptr<detail::DisplayMetricsState> metrics_;
};

} // namespace symbiote::windows
