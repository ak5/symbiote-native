param([Parameter(Mandatory = $true)][int]$ApplicationProcessId)

$ErrorActionPreference = 'Stop'
(Get-Process -Id $PID).PriorityClass = 'BelowNormal'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class InputWindow {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, int data, UIntPtr extraInfo);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(
    IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
}
'@

$app = Get-Process -Id $ApplicationProcessId
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

function Read-ViewportWidth {
  if ($metricsElement.Current.Name -cmatch '^Viewport: ([0-9]+\.[0-9]{2})x([0-9]+\.[0-9]{2})$') {
    $width = [double]::Parse($Matches[1], [Globalization.CultureInfo]::InvariantCulture)
    $height = [double]::Parse($Matches[2], [Globalization.CultureInfo]::InvariantCulture)
    if ($width -gt 0 -and $height -gt 0) { return $width }
  }
  return $null
}
$deadline = (Get-Date).AddSeconds(15)
do {
  $initialWidth = Read-ViewportWidth
  if ($null -ne $initialWidth) { break }
  Start-Sleep -Milliseconds 100
} while ((Get-Date) -lt $deadline)
if ($null -eq $initialWidth) { throw "Invalid initial viewport: $($metricsElement.Current.Name)" }
$bounds = $root.Current.BoundingRectangle
# Keep position, z-order and activation unchanged while changing the real OS window size.
if (-not [InputWindow]::SetWindowPos($app.MainWindowHandle, [IntPtr]::Zero, 0, 0,
    ([int][Math]::Ceiling($bounds.Width) + 160), [int][Math]::Ceiling($bounds.Height), 0x16)) {
  throw 'The native window could not be resized'
}
$deadline = (Get-Date).AddSeconds(15)
do {
  $resizedWidth = Read-ViewportWidth
  if ($null -ne $resizedWidth -and $resizedWidth -gt $initialWidth + 1) { break }
  Start-Sleep -Milliseconds 100
} while ((Get-Date) -lt $deadline)
if ($null -eq $resizedWidth -or $resizedWidth -le $initialWidth + 1) {
  throw "The framework window-dimensions hook did not react to OS resizing: $initialWidth -> $resizedWidth"
}
Write-Host "PASS: native OS resize updated framework viewport $initialWidth -> $resizedWidth"

$scrollCondition = [System.Windows.Automation.PropertyCondition]::new(
  [System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'windows-scroll')
$scrollElement = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $scrollCondition)
if ($null -eq $scrollElement) { throw 'The native scroll viewport is missing' }
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
