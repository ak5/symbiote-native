param([Parameter(Mandatory = $true)][int]$ApplicationProcessId)

$ErrorActionPreference = 'Stop'
(Get-Process -Id $PID).PriorityClass = 'BelowNormal'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
[StructLayout(LayoutKind.Sequential)]
public struct InputRect { public int Left, Top, Right, Bottom; }
public static class InputWindow {
  [DllImport("user32.dll", SetLastError=true)] public static extern bool GetClientRect(IntPtr window, out InputRect rect);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool GetWindowRect(IntPtr window, out InputRect rect);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern IntPtr GetWindowDpiAwarenessContext(IntPtr window);
  [DllImport("user32.dll")] public static extern int GetAwarenessFromDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, int data, UIntPtr extraInfo);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(
    IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
}
'@

$previousDpiContext = [InputWindow]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
if ($previousDpiContext -eq [IntPtr]::Zero) { throw 'Cannot enable per-monitor DPI awareness for native input verification' }
try {
  $app = Get-Process -Id $ApplicationProcessId
  if ($app.MainWindowHandle -eq [IntPtr]::Zero) { throw 'The native application window is missing' }
  $windowAwareness = [InputWindow]::GetAwarenessFromDpiAwarenessContext(
    [InputWindow]::GetWindowDpiAwarenessContext($app.MainWindowHandle))
  if ($windowAwareness -ne 2) { throw 'The native SDK window is not per-monitor DPI aware' }
  Write-Host 'PASS: native window uses per-monitor DPI awareness'
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($app.MainWindowHandle)
  if ($null -eq $root) { throw 'Native application window is missing' }
  $condition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'windows-input')
  $deadline = (Get-Date).AddSeconds(30)
  do {
    $inputElement = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
    if ($null -ne $inputElement) { break }
    Start-Sleep -Milliseconds 100
  } while ((Get-Date) -lt $deadline)
  if ($null -eq $inputElement) { throw 'WindowsTextInput was not exposed through UI Automation' }
  $pattern = $inputElement.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
  if ($pattern.Current.Value -cne 'seed') { throw "Unexpected initial native value: $($pattern.Current.Value)" }
  if (-not [InputWindow]::SetForegroundWindow($app.MainWindowHandle)) { throw 'Could not activate the native application' }
  $inputElement.SetFocus()
  if (-not $inputElement.Current.HasKeyboardFocus) { throw 'The native input did not receive keyboard focus' }
  [System.Windows.Forms.SendKeys]::SendWait('^ahello')
  function Wait-InputValue([string]$Expected) {
    $deadline = (Get-Date).AddSeconds(15)
    do {
      $value = $pattern.Current.Value
      if ($value -ceq $Expected) { return }
      Start-Sleep -Milliseconds 100
    } while ((Get-Date) -lt $deadline)
    throw "Native input did not become '$Expected': '$value'"
  }
  Wait-InputValue 'HELLO'
  Write-Host 'PASS: native input seed -> typed hello -> controlled HELLO'

  # A fresh sentinel prevents a previous framework's clipboard contents satisfying this check.
  [System.Windows.Forms.Clipboard]::SetText([guid]::NewGuid().ToString())
  [System.Windows.Forms.SendKeys]::SendWait('^a^c')
  $deadline = (Get-Date).AddSeconds(10)
  do {
    $copied = [System.Windows.Forms.Clipboard]::GetText()
    if ($copied -ceq 'HELLO') { break }
    Start-Sleep -Milliseconds 100
  } while ((Get-Date) -lt $deadline)
  if ($copied -cne 'HELLO') { throw "Native copy did not reach the system clipboard: '$copied'" }
  $externalText = 'from outside ' + [char]0x96EA
  [System.Windows.Forms.Clipboard]::SetText($externalText)
  [System.Windows.Forms.SendKeys]::SendWait('^a^v')
  Wait-InputValue ($externalText.ToUpperInvariant())
  Write-Host 'PASS: system clipboard native copy and external Unicode paste'

  $metricsCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'windows-metrics')
  $deadline = (Get-Date).AddSeconds(30)
  do {
    $metricsElement = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $metricsCondition)
    if ($null -ne $metricsElement) { break }
    Start-Sleep -Milliseconds 100
  } while ((Get-Date) -lt $deadline)
  if ($null -eq $metricsElement) { throw 'The native viewport label is missing' }

  function Read-Viewport {
    if ($metricsElement.Current.Name -cmatch '^Viewport: ([0-9]+\.[0-9]{2})x([0-9]+\.[0-9]{2}) @([0-9]+\.[0-9]{2})$') {
      return [pscustomobject]@{
        Width = [double]::Parse($Matches[1], [Globalization.CultureInfo]::InvariantCulture)
        Height = [double]::Parse($Matches[2], [Globalization.CultureInfo]::InvariantCulture)
        Scale = [double]::Parse($Matches[3], [Globalization.CultureInfo]::InvariantCulture)
      }
    }
    return $null
  }
  function Wait-CalibratedViewport {
    $deadline = (Get-Date).AddSeconds(15)
    do {
      $client = [InputRect]::new()
      if (-not [InputWindow]::GetClientRect($app.MainWindowHandle, [ref]$client)) { throw 'Cannot read native client bounds' }
      $dpi = [InputWindow]::GetDpiForWindow($app.MainWindowHandle)
      if ($dpi -eq 0) { throw 'Cannot read native window DPI' }
      $scale = $dpi / 96.0
      $width = ($client.Right - $client.Left) / $scale
      $height = ($client.Bottom - $client.Top) / $scale
      $observed = Read-Viewport
      if ($null -ne $observed -and $observed.Width -gt 0 -and $observed.Height -gt 0 -and
          [Math]::Abs($observed.Width - $width) -le 0.02 -and
          [Math]::Abs($observed.Height - $height) -le 0.02 -and
          [Math]::Abs($observed.Scale - $scale) -le 0.01) { return $observed }
      Start-Sleep -Milliseconds 100
    } while ((Get-Date) -lt $deadline)
    throw "Framework viewport '$($metricsElement.Current.Name)' disagrees with native client $width x $height at scale $scale"
  }
  $initial = Wait-CalibratedViewport
  $initialWidth = $initial.Width
  Write-Host "PASS: native client viewport $($initial.Width)x$($initial.Height) scale $($initial.Scale)"
  $bounds = [InputRect]::new()
  if (-not [InputWindow]::GetWindowRect($app.MainWindowHandle, [ref]$bounds)) { throw 'Cannot read native window bounds' }
  # Keep position, z-order and activation unchanged while changing the real OS window size.
  if (-not [InputWindow]::SetWindowPos($app.MainWindowHandle, [IntPtr]::Zero, 0, 0,
      ($bounds.Right - $bounds.Left + 160), ($bounds.Bottom - $bounds.Top), 0x16)) {
    throw 'The native window could not be resized'
  }
  $resizedBounds = [InputRect]::new()
  if (-not [InputWindow]::GetWindowRect($app.MainWindowHandle, [ref]$resizedBounds)) { throw 'Cannot read resized native window bounds' }
  if (($resizedBounds.Right - $resizedBounds.Left) -le ($bounds.Right - $bounds.Left + 1)) {
    throw 'The OS window size did not increase'
  }
  $resized = Wait-CalibratedViewport
  $resizedWidth = $resized.Width
  if ($resizedWidth -le $initialWidth + 1) {
    throw "The framework window-dimensions hook did not react to OS resizing: $initialWidth -> $resizedWidth"
  }
  Write-Host "PASS: native OS resize updated framework viewport $initialWidth -> $resizedWidth"

  & "$PSScriptRoot/check-windows-display-scaling.ps1" -OutputDirectory "windows-display-$ApplicationProcessId" -Verify {
    param([int]$ExpectedDpi)
    $deadline = (Get-Date).AddSeconds(20)
    do {
      $actualDpi = [InputWindow]::GetDpiForWindow($app.MainWindowHandle)
      if ($actualDpi -eq $ExpectedDpi) { break }
      Start-Sleep -Milliseconds 100
    } while ((Get-Date) -lt $deadline)
    if ($actualDpi -ne $ExpectedDpi) { throw "Application window DPI remained $actualDpi, expected $ExpectedDpi" }
    $viewport = Wait-CalibratedViewport
    Write-Host "PASS: live framework viewport $($viewport.Width)x$($viewport.Height) scale $($viewport.Scale) at native DPI $actualDpi"
  }
  if (-not [InputWindow]::SetForegroundWindow($app.MainWindowHandle)) { throw 'Could not reactivate the native application after display scaling' }

  $scrollCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'windows-scroll')
  $deadline = (Get-Date).AddSeconds(15)
  do {
    $scrollElement = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $scrollCondition)
    if ($null -ne $scrollElement) { break }
    Start-Sleep -Milliseconds 100
  } while ((Get-Date) -lt $deadline)
  if ($null -eq $scrollElement) {
    $root.FindAll([System.Windows.Automation.TreeScope]::Descendants,
      [System.Windows.Automation.Condition]::TrueCondition) | Select-Object -First 100 | ForEach-Object {
        Write-Host "UIA: id=$($_.Current.AutomationId) name=$($_.Current.Name) bounds=$($_.Current.BoundingRectangle)"
      }
    throw 'The native scroll viewport is missing'
  }
  $scrollBounds = $scrollElement.Current.BoundingRectangle
  if ($scrollBounds.IsEmpty -or $scrollBounds.Width -le 0 -or $scrollBounds.Height -le 0) {
    throw 'The native scroll viewport has no visible bounds'
  }
  $previousCursor = [System.Windows.Forms.Cursor]::Position
  try {
    [System.Windows.Forms.Cursor]::Position = [System.Drawing.Point]::new(
      [int]($scrollBounds.Left + $scrollBounds.Width / 2),
      [int]($scrollBounds.Top + $scrollBounds.Height / 2))
    [InputWindow]::mouse_event(0x0800, 0, 0, -3600, [UIntPtr]::Zero)
    Start-Sleep -Milliseconds 500
  } finally {
    [System.Windows.Forms.Cursor]::Position = $previousCursor
  }
} finally {
  if ([InputWindow]::SetThreadDpiAwarenessContext($previousDpiContext) -eq [IntPtr]::Zero) {
    throw 'Cannot restore the native input thread DPI context'
  }
}
