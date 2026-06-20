@echo off
setlocal enabledelayedexpansion
REM VibeIDE dev launch from repo root (see scripts\vibe-dev.bat).
REM   run-dev.bat              - обычный запуск (профиль не чистим).
REM   run-dev.bat --compile    - сначала `npm run compile`, затем запуск (full compile; если
REM                              компиляция упала - запуск НЕ происходит). Флаг в Electron не уходит.
REM   run-dev.bat --clear      - снести профиль dev: %%APPDATA%%\vibeide-dev-dev (+ legacy vibeide-dev),
REM                              %%LOCALAPPDATA%%\vibeide-dev-dev, %%USERPROFILE%%\.vibeide-shared, %%USERPROFILE%%\.vibeide.
REM   Флаги комбинируются: `run-dev.bat --compile --clear`.
REM   Остальные аргументы пробрасываются в Electron как раньше.
REM   Загрузка Electron: по умолчанию npmmirror, если не заданы VIBE_ELECTRON_MIRROR/ELECTRON_MIRROR
REM   (отключить fallback: set VIBE_NO_ELECTRON_MIRROR_FALLBACK=1 перед вызовом).

REM Strip --compile out of the args (the rest are forwarded to vibe-dev.bat / Electron verbatim).
set "DO_COMPILE="
set "FWD_ARGS="
:parse_args
if "%~1"=="" goto after_args
if /i "%~1"=="--compile" (
	set "DO_COMPILE=1"
) else (
	set "FWD_ARGS=!FWD_ARGS! %1"
)
shift
goto parse_args
:after_args

if not defined DO_COMPILE goto launch
echo [run-dev] --compile: running `npm run compile`...
call :ensure_npm
call npm run compile
if !errorlevel! neq 0 (
	echo [run-dev] Compile failed ^(exit !errorlevel!^) -- aborting launch.
	exit /b 1
)

:launch
call "%~dp0scripts\vibe-dev.bat" !FWD_ARGS!
exit /b !errorlevel!

REM ---- ensure npm is callable ------------------------------------------------
REM npm is often NOT on PATH inside this cmd: fnm activates Node via per-shell shims
REM in the PARENT PowerShell, which the spawned cmd does not always inherit. If npm is
REM missing, resolve the project's Node bin dir via fnm (on PATH from WinGet) and prepend
REM it, so npm.cmd is found. `fnm exec ... npm` cannot be used directly (it can't spawn a
REM .cmd), so we ask `node` for its own dir.
:ensure_npm
where npm >nul 2>&1
if not errorlevel 1 goto :eof
set "NODE_VER=22.22.1"
if exist "%~dp0.nvmrc" for /f "usebackq tokens=* delims=" %%v in ("%~dp0.nvmrc") do set "NODE_VER=%%v"
REM Search KNOWN fnm roots for the installed version's bin dir. FNM_DIR may be unset OR point
REM somewhere the versions don't actually live (observed), so we check all candidates, not just it.
set "NODE_DIR="
call :try_root "%FNM_DIR%"
if not defined NODE_DIR call :try_root "%APPDATA%\fnm"
if not defined NODE_DIR call :try_root "%LOCALAPPDATA%\fnm"
if not defined NODE_DIR call :try_root "%USERPROFILE%\.fnm"
if defined NODE_DIR goto :ensure_npm_have
REM Last resort: ask fnm to run node and report its own dir (also honors a non-default FNM_DIR).
for /f "usebackq delims=" %%i in (`fnm exec --using "%NODE_VER%" node -e "process.stdout.write(require('path').dirname(process.execPath))" 2^>nul`) do set "NODE_DIR=%%i"
if not defined NODE_DIR goto :ensure_npm_fail
:ensure_npm_have
set "PATH=%NODE_DIR%;%PATH%"
echo [run-dev] npm not on PATH; using Node from "%NODE_DIR%".
goto :eof
:ensure_npm_fail
echo [run-dev] WARNING: npm not on PATH and Node %NODE_VER% not found. Checked FNM_DIR, %%APPDATA%%\fnm, %%LOCALAPPDATA%%\fnm, %%USERPROFILE%%\.fnm and `fnm exec`. Run `fnm install %NODE_VER%` or put npm on PATH.
goto :eof

REM try_root <fnm-root>: if <root>\node-versions\v<ver>\installation\npm.cmd exists, set NODE_DIR to it.
:try_root
if "%~1"=="" goto :eof
if exist "%~1\node-versions\v%NODE_VER%\installation\npm.cmd" set "NODE_DIR=%~1\node-versions\v%NODE_VER%\installation"
goto :eof
