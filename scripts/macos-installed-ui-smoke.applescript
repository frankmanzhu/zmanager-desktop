on run argv
  set targetPID to (item 1 of argv) as integer
  tell application "System Events"
    set targetProcess to first application process whose unix id is targetPID
    tell targetProcess
      set menuNames to name of every menu bar item of menu bar 1
      set windowCount to count of windows
    end tell
  end tell
  return "menus=" & (menuNames as string) & ";windows=" & windowCount
end run
