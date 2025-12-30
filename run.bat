@echo off
echo Starting MovieMind Project...
echo.

echo Step 1: Starting Backend Server...
cd backend
start cmd /k "venv\Scripts\activate && python app.py"
timeout /t 3

echo.
echo Step 2: Opening Frontend...
cd ..\frontend
start index.html

echo.
echo ✅ Project started!
echo Backend: http://127.0.0.1:5000
echo Frontend: Open index.html in browser
pause