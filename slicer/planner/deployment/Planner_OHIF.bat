@echo off
rem Wrapper for slicer.exe to run as planner.exe

rem Set the path to the directory where slicer.exe is located
set SLICER_DIR=C:\F\SR\Slicer-build

rem Run slicer.exe but rename it to planner.exe in the process
"%SLICER_DIR%\Slicer.exe" --launcher-no-splash --python-script C:\Users\hp\tableTop\mvisioner\Viewers\slicer\planner\deployment\simple_gui.py restoreOldScrews --project_dir=None
rem "%SLICER_DIR%\Slicer.exe"