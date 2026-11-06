@echo off
set "DEST=%APPDATA%\Adobe\CEP\extensions\Typertool"
if exist "%DEST%" rmdir /s /q "%DEST%"
if exist "%APPDATA%\Adobe\CEP\extensions\TypeRLite" rmdir /s /q "%APPDATA%\Adobe\CEP\extensions\TypeRLite"
rem shortcut scripts (may need administrator rights)
for /d %%D in ("%ProgramFiles%\Adobe\Adobe Photoshop*") do (
  del /q "%%D\Presets\Scripts\Typertool - *.jsx" >nul 2>&1
)
echo Da go Typertool / Typertool removed.
pause
