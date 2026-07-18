on run argv
  if (count of argv) is not 2 then error "usage: osascript macos-quicklook-installed-ui-smoke.applescript FILE SCREENSHOT"
  set targetPath to item 1 of argv
  set screenshotPath to item 2 of argv
  set targetFile to POSIX file targetPath as alias
  tell application "Finder"
    activate
    reveal targetFile
  end tell
  delay 2
  tell application "System Events" to key code 49
  delay 4
  do shell script "/usr/sbin/screencapture -x " & quoted form of screenshotPath
  tell application "System Events" to key code 49
  return "ZMANAGER_QUICKLOOK_UI_SMOKE_OK:" & screenshotPath
end run
