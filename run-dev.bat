@echo off
setlocal enabledelayedexpansion
REM VibeIDE dev launch from repo root (see scripts\vibe-dev.bat).
REM   run-dev.bat              — обычный запуск (профиль не чистим).
REM   run-dev.bat --compile    — сначала `npm run compile`, затем запуск (full compile; если
REM                              компиляция упала — запуск НЕ происходит). Флаг в Electron не уходит.
REM   run-dev.bat --clear      — снести профиль dev: %%APPDATA%%\vibeide-dev-dev ^(+ legacy vibeide-dev^),
REM                              %%LOCALAPPDATA%%\vibeide-dev-dev, %%USERPROFILE%%\.vibeide-shared, %%USERPROFILE%%\.vibeide, затем запуск.
REM   Флаги комбинируются: `run-dev.bat --compile --clear`.
REM   Остальные аргументы пробрасываются в Electron как раньше.
REM   Загрузка Electron: по умолчанию npmmirror, если не заданы VIBE_ELECTRON_MIRROR/ELECTRON_MIRROR
REM   ^(отключить fallback: set VIBE_NO_ELECTRON_MIRROR_FALLBACK=1 перед вызовом^).

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

if defined DO_COMPILE (
	echo [run-dev] --compile: running `npm run compile`...
	call npm run compile
	if errorlevel 1 (
		echo [run-dev] Compile failed ^(exit %ERRORLEVEL%^) — aborting launch.
		exit /b 1
	)
)

call "%~dp0scripts\vibe-dev.bat" !FWD_ARGS!
exit /b %ERRORLEVEL%
