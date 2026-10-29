param(
  [Parameter(Mandatory=$true)][string]$ProjectPath,
  [Parameter(Mandatory=$true)][string]$ReactNativePath
)
$ErrorActionPreference = 'Stop'
$projectPath = (Resolve-Path $ProjectPath).Path
$projectDir = Split-Path -Parent $projectPath
$engineDir = (Resolve-Path core/engine/cpp).Path
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
$vcpkgProps = $project.CreateElement('Import', $ns)
$vcpkgProps.SetAttribute('Project', "$vcpkgRoot/scripts/buildsystems/msbuild/vcpkg.props")
[void]$project.DocumentElement.AppendChild($vcpkgProps)
# Expose only the missing conversion header; the SDK remains the sole JSI header owner.
$conversionDir = Join-Path $projectDir 'engine-includes/jsi'
New-Item -ItemType Directory -Force $conversionDir | Out-Null
Copy-Item "$rnDir/ReactCommon/jsi/jsi/JSIDynamic.h" $conversionDir
$group = $project.CreateElement('ItemGroup', $ns)
# Exporting this function forces the linker to retain the engine and resolve its Fabric calls.
@'
#include "SymbioteEngineBindings.h"
#include "SymbioteEngineModule.h"
extern "C" __declspec(dllexport) void InstallSymbioteEngine(facebook::jsi::Runtime &runtime) {
  symbiote::installBindings(runtime);
}
'@ | Set-Content (Join-Path $projectDir 'EngineLinkProbe.cpp')
$sources = @(Get-ChildItem $engineDir -Filter '*.cpp')
if ($sources.Count -eq 0) { throw 'No engine sources found' }
$paths = @($sources | ForEach-Object FullName) + @((Join-Path $projectDir 'EngineLinkProbe.cpp'), (Join-Path $rnDir 'ReactCommon/jsi/jsi/JSIDynamic.cpp'))
foreach ($source in $paths) {
  $item = $project.CreateElement('ClCompile', $ns)
  $item.SetAttribute('Include', $source)
  $pch = $project.CreateElement('PrecompiledHeader', $ns)
  $pch.InnerText = 'NotUsing'
  [void]$item.AppendChild($pch)
  [void]$group.AppendChild($item)
}
[void]$project.DocumentElement.AppendChild($group)
$definitions = $project.CreateElement('ItemDefinitionGroup', $ns)
$compile = $project.CreateElement('ClCompile', $ns)
$includes = $project.CreateElement('AdditionalIncludeDirectories', $ns)
# RNW's SDK owns JSI; mixing its headers with npm React Native's JSI defines the types twice.
$includes.InnerText = "%(AdditionalIncludeDirectories);$engineDir;$moduleDir;$projectDir\engine-includes;$rnDir\ReactCommon"
[void]$compile.AppendChild($includes)
$defines = $project.CreateElement('PreprocessorDefinitions', $ns)
$defines.InnerText = 'SYMBIOTE_PUBLIC_FABRIC=1;_CRT_SECURE_NO_WARNINGS;NOMINMAX;%(PreprocessorDefinitions)'
[void]$compile.AppendChild($defines)
$standard = $project.CreateElement('LanguageStandard', $ns)
$standard.InnerText = 'stdcpp20'
[void]$compile.AppendChild($standard)
$parallel = $project.CreateElement('MultiProcessorCompilation', $ns)
$parallel.InnerText = 'false'
[void]$compile.AppendChild($parallel)
[void]$definitions.AppendChild($compile)
[void]$project.DocumentElement.AppendChild($definitions)
$vcpkgTargets = $project.CreateElement('Import', $ns)
$vcpkgTargets.SetAttribute('Project', "$vcpkgRoot/scripts/buildsystems/msbuild/vcpkg.targets")
[void]$project.DocumentElement.AppendChild($vcpkgTargets)
$project.Save($projectPath)
