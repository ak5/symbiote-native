param(
  [Parameter(Mandatory=$true)][string]$ProjectPath,
  [Parameter(Mandatory=$true)][string]$ReactNativePath
)
$ErrorActionPreference = 'Stop'
$projectPath = (Resolve-Path $ProjectPath).Path
$projectDir = Split-Path -Parent $projectPath
$moduleDir = (Resolve-Path core/engine/windows).Path
$rnDir = (Resolve-Path $ReactNativePath).Path
[xml]$project = Get-Content $projectPath
$ns = $project.DocumentElement.NamespaceURI
$dependencyRoot = (Resolve-Path .windows-vcpkg-installed).Path
$vcpkgRoot = (Resolve-Path .windows-vcpkg).Path
$properties = $project.CreateElement('PropertyGroup', $ns)
foreach ($entry in @{
  VcpkgRoot = "$vcpkgRoot\"
  VcpkgEnabled = 'true'
  VcpkgManifestInstall = 'false'
  VcpkgTriplet = 'x64-windows-static-md'
  VcpkgInstalledDir = "$dependencyRoot\"
}.GetEnumerator()) {
  $property = $project.CreateElement($entry.Key, $ns)
  $property.InnerText = $entry.Value
  [void]$properties.AppendChild($property)
}
[void]$project.DocumentElement.AppendChild($properties)
$nativeProperty = $project.CreateElement('SymbioteReactNativeDirectory', $ns)
$nativeProperty.InnerText = "$rnDir\"
[void]$properties.AppendChild($nativeProperty)
$engineProps = $project.CreateElement('Import', $ns)
$engineProps.SetAttribute('Project', (Join-Path $moduleDir 'SymbioteEngine.props'))
[void]$project.DocumentElement.AppendChild($engineProps)
# Keep the library link check live even when its generated provider does not reference the engine.
@'
#include "SymbioteEngineBindings.h"
extern "C" __declspec(dllexport) void InstallSymbioteEngine(facebook::jsi::Runtime &runtime) {
  symbiote::installBindings(runtime);
}
'@ | Set-Content (Join-Path $projectDir 'EngineLinkProbe.cpp')
$group = $project.CreateElement('ItemGroup', $ns)
$item = $project.CreateElement('ClCompile', $ns)
$item.SetAttribute('Include', (Join-Path $projectDir 'EngineLinkProbe.cpp'))
$pch = $project.CreateElement('PrecompiledHeader', $ns)
$pch.InnerText = 'NotUsing'
[void]$item.AppendChild($pch)
[void]$group.AppendChild($item)
[void]$project.DocumentElement.AppendChild($group)
$project.Save($projectPath)
