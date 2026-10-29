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
$deadline = (Get-Date).AddSeconds(15)
do {
  $value = $pattern.Current.Value
  if ($value -ceq 'HELLO') { break }
  Start-Sleep -Milliseconds 100
} while ((Get-Date) -lt $deadline)
if ($value -cne 'HELLO') { throw "Native typing and framework controlled update failed: $value" }
Write-Host 'PASS: native input seed -> typed hello -> controlled HELLO'
