@echo off
setlocal
chcp 65001 >nul
set "SRC=%~dp0Typertool"
set "DEST=%APPDATA%\Adobe\CEP\extensions\Typertool"

tasklist /FI "IMAGENAME eq Photoshop.exe" 2>nul | find /I "Photoshop.exe" >nul
if not errorlevel 1 (
  echo Photoshop dang mo: hay tat Photoshop truoc roi chay lai file nay.
  echo Photoshop is open: close it first, then run this file again.
  pause
  exit /b 1
)

if not exist "%SRC%\CSXS\manifest.xml" (
  echo Khong thay thu muc Typertool canh file nay. Hay giai nen toan bo file zip truoc.
  echo The Typertool folder is not next to this file. Extract the whole zip first.
  pause
  exit /b 1
)

rem Unsigned panels are loaded when PlayerDebugMode is on (every CSXS version Photoshop may use)
for %%V in (6 7 8 9 10 11 12) do reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul

rem the panel used to be called TypeRLite: remove it so only one panel is left
if exist "%APPDATA%\Adobe\CEP\extensions\TypeRLite" rmdir /s /q "%APPDATA%\Adobe\CEP\extensions\TypeRLite"
if exist "%DEST%" rmdir /s /q "%DEST%"
xcopy "%SRC%" "%DEST%\" /E /I /Y /Q >nul
if errorlevel 1 (
  echo Cai dat that bai / Installation failed.
  pause
  exit /b 1
)

rem The shortcut scripts go into every Photoshop Presets\Scripts folder (File ^> Scripts).
rem Writing there may need administrator rights: if it fails, copy the Scripts folder by hand.
set "SCRIPTS_OK=0"
if exist "%~dp0Scripts" (
  for /d %%D in ("%ProgramFiles%\Adobe\Adobe Photoshop*") do (
    if exist "%%D\Presets\Scripts" (
      xcopy "%~dp0Scripts\*.jsx" "%%D\Presets\Scripts\" /Y /Q >nul 2>&1 && set "SCRIPTS_OK=1"
    )
  )
)
echo.
if "%SCRIPTS_OK%"=="1" (
  echo Da chep script phim tat vao Photoshop: File ^> Scripts ^> "Typertool - ..."
  echo Shortcut scripts copied into Photoshop: File ^> Scripts ^> "Typertool - ..."
) else (
  echo Chua chep duoc script phim tat. Chay lai file nay bang Run as administrator,
  echo hoac chep thu cong thu muc Scripts vao: Photoshop\Presets\Scripts
  echo Shortcut scripts NOT copied. Run this file as administrator, or copy the .jsx files of the
  echo Scripts folder into Photoshop\Presets\Scripts by hand.
)
echo.
echo Da cai xong / Installed.
echo Mo Photoshop, vao: Window ^> Extensions ^> Typertool
echo Open Photoshop, then: Window ^> Extensions ^> Typertool
echo.
pause
