@echo off
REM home-build.cmd — Windows entry point for the home build (build-from-source).
REM Delegates to home-build-windows.ps1, which bootstraps fnm + Node + dependencies,
REM then compiles and packages a portable VibeIDE folder + .zip. Forwards all args
REM (e.g. --arch arm64, --yes).
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0home-build-windows.ps1" %*
exit /b %ERRORLEVEL%
