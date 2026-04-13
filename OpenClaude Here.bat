@echo off
setlocal
cd /d "%~dp0"
set "CLAUDE_CODE_USE_OPENAI=1"
set "OPENAI_MODEL=codexplan"
set "OPENAI_BASE_URL=https://chatgpt.com/backend-api/codex"
set "CLAUDE_CODE_USE_POWERSHELL_TOOL=1"
node "C:\Users\Kamala\Desktop\openclaude\dist\cli.mjs" --append-system-prompt "On Windows, prefer PowerShellTool for Windows-native commands and PATH-sensitive tools like go, npm, python, or dotnet. Use Bash only when POSIX shell behavior is specifically needed." --dangerously-skip-permissions
