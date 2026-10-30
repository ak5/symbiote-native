param(
  [Parameter(Mandatory = $true)][string]$OutputDirectory,
  [scriptblock]$Verify
)

$ErrorActionPreference = 'Stop'
(Get-Process -Id $PID).PriorityClass = 'BelowNormal'
New-Item -ItemType Directory $OutputDirectory | Out-Null
Start-Transcript (Join-Path $OutputDirectory 'display.log')
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class DisplayProbe {
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] public static extern IntPtr GetWindowDpiAwarenessContext(IntPtr window);
  [DllImport("user32.dll")] public static extern int GetAwarenessFromDpiAwarenessContext(IntPtr context);
}
'@
function Save-DisplayScreenshot([string]$Name) {
  $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
  $bitmap = [System.Drawing.Bitmap]::new($bounds.Width, $bounds.Height)
  try {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try { $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size) }
    finally { $graphics.Dispose() }
    $bitmap.Save((Join-Path $OutputDirectory "$Name.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $bitmap.Dispose() }
}
function Get-ScaleCombo {
  $condition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::AutomationIdProperty,
    'SystemSettings_Display_Scaling_ItemSizeOverride_ComboBox')
  $combo = $settingsRoot.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
  if ($null -eq $combo -or -not $combo.Current.IsEnabled) { throw 'The inspected Windows scale selector is unavailable' }
  return $combo
}
function Select-Scale([int]$Percent) {
  $combo = Get-ScaleCombo
  $selection = $combo.GetCurrentPattern([System.Windows.Automation.SelectionPattern]::Pattern)
  $current = @($selection.Current.GetSelection())
  $expand = $combo.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
  if ($current.Count -eq 1 -and $current[0].Current.Name -cmatch "^$Percent%($|\s)") {
    $expand.Collapse()
    return
  }
  $expand.Expand()
  $condition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::ListItem)
  $deadline = (Get-Date).AddSeconds(10)
  do {
    $options = $settingsRoot.FindAll([System.Windows.Automation.TreeScope]::Descendants, $condition)
    $item = $options | Where-Object { $_.Current.Name -cmatch "^$Percent%($|\s)" } | Select-Object -First 1
    if ($null -ne $item) { break }
    Start-Sleep -Milliseconds 100
  } while ((Get-Date) -lt $deadline)
  if ($null -eq $item) {
    $options | ForEach-Object { Write-Host "Scale list item: $($_.Current.Name)" }
    Save-DisplayScreenshot "options-$Percent"
    throw "Windows did not expose the requested $Percent percent scale option"
  }
  $item.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select()
}
function Wait-WindowDpi([int]$Expected) {
  $deadline = (Get-Date).AddSeconds(20)
  do {
    $value = [DisplayProbe]::GetDpiForWindow([IntPtr]::new($settingsRoot.Current.NativeWindowHandle))
    if ($value -eq $Expected) { return }
    Start-Sleep -Milliseconds 100
  } while ((Get-Date) -lt $deadline)
  throw "Native Settings window DPI remained $value, expected $Expected"
}
$settingsRoot = $null
$originalPercent = $null
$originalDpi = $null
$scaleMayHaveChanged = $false
$previousDpiContext = [DisplayProbe]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
if ($previousDpiContext -eq [IntPtr]::Zero) { throw 'Cannot enable per-monitor awareness for display calibration' }
try {
  Start-Process 'ms-settings:display'
  $deadline = (Get-Date).AddSeconds(30)
  $comboCondition = [System.Windows.Automation.PropertyCondition]::new(
    [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
    [System.Windows.Automation.ControlType]::ComboBox)
  do {
    $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
      [System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($window in $windows) {
      if ($window.Current.Name -like '*Settings*') { $settingsRoot = $window; break }
    }
    if ($null -ne $settingsRoot) {
      $combos = $settingsRoot.FindAll([System.Windows.Automation.TreeScope]::Descendants, $comboCondition)
      if ($combos.Count -gt 0) { break }
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  if ($null -eq $settingsRoot) {
    $windows | ForEach-Object { Write-Host "Window: $($_.Current.Name)" }
    throw 'The native Display Settings window was not exposed through UI Automation'
  }
  $nodes = $settingsRoot.FindAll([System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition)
  $inventory = @($nodes | Select-Object -First 300 | ForEach-Object {
    [pscustomobject]@{
      name = $_.Current.Name
      id = $_.Current.AutomationId
      type = $_.Current.ControlType.ProgrammaticName
      enabled = $_.Current.IsEnabled
      offscreen = $_.Current.IsOffscreen
    }
  })
  $inventory | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $OutputDirectory 'controls.json')
  $handle = [IntPtr]::new($settingsRoot.Current.NativeWindowHandle)
  $dpi = [DisplayProbe]::GetDpiForWindow($handle)
  $awareness = [DisplayProbe]::GetAwarenessFromDpiAwarenessContext(
    [DisplayProbe]::GetWindowDpiAwarenessContext($handle))
  Write-Host "Display Settings native DPI=$dpi awareness=$awareness comboBoxes=$($combos.Count)"
  if ($dpi -eq 0 -or $combos.Count -eq 0) { throw 'The Settings window lacks readable DPI or combo-box metadata' }
  if ($awareness -ne 2) { throw 'Settings is not per-monitor DPI aware' }
  $windowPattern = $null
  if ($settingsRoot.TryGetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern, [ref]$windowPattern)) {
    $windowPattern.SetWindowVisualState([System.Windows.Automation.WindowVisualState]::Maximized)
  }
  $combo = Get-ScaleCombo
  $selected = @($combo.GetCurrentPattern([System.Windows.Automation.SelectionPattern]::Pattern).Current.GetSelection())
  if ($selected.Count -ne 1) { throw 'Windows did not expose one selected display scale' }
  if ($selected[0].Current.Name -match '^(\d+)%') { $originalPercent = [int]$Matches[1] }
  else { throw 'Cannot read the original Windows scale selection' }
  $originalDpi = [DisplayProbe]::GetDpiForWindow([IntPtr]::new($settingsRoot.Current.NativeWindowHandle))
  if ($originalPercent -eq 125) { throw 'Runner already uses the target scale; a real scale change is required' }
  if ($null -ne $Verify) { & $Verify $originalDpi }
  $scaleMayHaveChanged = $true
  Select-Scale 125
  Wait-WindowDpi 120
  if ($null -ne $Verify) { & $Verify 120 }
  Save-DisplayScreenshot 'scaled'
  Write-Host "PASS: real OS scale changed from $originalPercent percent / $originalDpi DPI to 125 percent / 120 DPI"
} finally {
  try {
    if ($scaleMayHaveChanged) {
      Select-Scale $originalPercent
      Wait-WindowDpi $originalDpi
      if ($null -ne $Verify) { & $Verify $originalDpi }
      Write-Host "PASS: original OS scale restored to $originalPercent percent / $originalDpi DPI"
    }
  } finally {
    try { Save-DisplayScreenshot 'display' }
    catch { Write-Warning "Display screenshot unavailable: $_" }
    try {
      if ($null -ne $settingsRoot) {
        $process = Get-Process -Id $settingsRoot.Current.ProcessId -ErrorAction SilentlyContinue
        if ($null -ne $process) { [void]$process.CloseMainWindow() }
      }
    } catch { Write-Warning "Settings window already closed: $_" }
    [void][DisplayProbe]::SetThreadDpiAwarenessContext($previousDpiContext)
    Stop-Transcript
  }
}
