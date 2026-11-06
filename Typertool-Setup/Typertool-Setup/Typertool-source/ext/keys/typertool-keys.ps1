# Typertool key watcher (started by the Typertool panel; nothing to run by hand).
# It only reads the shortcut keys you set in the panel and tells the panel when one is pressed while
# Photoshop is the active window. With -Block 1 (default) those keys are also kept away from
# Photoshop, so a shortcut like Shift+F2 does not also trigger what Photoshop has on F2.
# Source: KeyWatcher.cs next to this file.
param([int]$ParentPid = 0, [string]$Bindings = "", [int]$Block = 1)
$ErrorActionPreference = 'Stop'
Add-Type -Path (Join-Path $PSScriptRoot 'KeyWatcher.cs')
[Typertool.KeyWatcher]::Run($ParentPid, $Bindings, ($Block -ne 0))
