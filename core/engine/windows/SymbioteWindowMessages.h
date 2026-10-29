#pragma once

#include <windows.h>
#include <commctrl.h>
#include <memory>
#include <unordered_map>
#include <DesktopWindowBridge.h>

#pragma comment(lib, "comctl32.lib")

namespace symbiote::windows {

// DeviceInfo listens on this SDK bridge; the Win32 app builder does not forward resize messages.
class WindowMessages final {
 public:
  WindowMessages(HWND window, winrt::Microsoft::ReactNative::IReactNotificationService const &notifications)
      : window_(window), notifications_(notifications) {
    if (!SetWindowSubclass(window_, HandleMessage, reinterpret_cast<UINT_PTR>(this),
                           reinterpret_cast<DWORD_PTR>(this))) {
      throw winrt::hresult_error(E_FAIL, L"Cannot attach the host resize message bridge");
    }
  }

  WindowMessages(WindowMessages const &) = delete;
  WindowMessages &operator=(WindowMessages const &) = delete;

  ~WindowMessages() {
    if (window_) RemoveWindowSubclass(window_, HandleMessage, reinterpret_cast<UINT_PTR>(this));
  }

 private:
  static LRESULT CALLBACK HandleMessage(HWND window, UINT message, WPARAM wParam, LPARAM lParam,
                                       UINT_PTR id, DWORD_PTR data) noexcept {
    auto self = reinterpret_cast<WindowMessages *>(data);
    if (message == WM_WINDOWPOSCHANGED) {
      auto position = reinterpret_cast<WINDOWPOS const *>(lParam);
      if (!(position->flags & SWP_NOSIZE)) {
        winrt::Microsoft::ReactNative::ForwardWindowMessage(
            self->notifications_, window, message, wParam, lParam);
      }
    } else if (message == WM_NCDESTROY) {
      RemoveWindowSubclass(window, HandleMessage, id);
      self->window_ = nullptr;
    }
    return DefSubclassProc(window, message, wParam, lParam);
  }

  HWND window_;
  winrt::Microsoft::ReactNative::ReactNotificationService notifications_;
};

} // namespace symbiote::windows
