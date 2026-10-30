#pragma once

#include <windows.h>
#include <filesystem>
#include <string>
#include <winrt/Windows.ApplicationModel.Core.h>

namespace symbiote::windows::probe {

inline void configurePersistence() {
  constexpr auto name = L"SYMBIOTE_PERSISTENCE_DATABASE";
  const auto size = GetEnvironmentVariableW(name, nullptr, 0);
  if (!size) {
    if (GetLastError() == ERROR_ENVVAR_NOT_FOUND) return;
    throw winrt::hresult_invalid_argument(L"Empty persistence database path");
  }
  std::wstring path(size, L'\0');
  const auto count = GetEnvironmentVariableW(name, path.data(), size);
  if (!count || count >= size)
    throw winrt::hresult_invalid_argument(L"Persistence database path changed");
  path.resize(count);
  if (!std::filesystem::path(path).is_absolute())
    throw winrt::hresult_invalid_argument(L"Persistence database path must be absolute");
  winrt::Windows::ApplicationModel::Core::CoreApplication::Properties().Insert(
      L"React-Native-Community-Async-Storage-Database-Path", winrt::box_value(winrt::hstring(path)));
}

} // namespace symbiote::windows::probe
