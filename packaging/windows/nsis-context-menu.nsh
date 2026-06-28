!define ZM_EXE_NAME "zmanager-desktop.exe"
!define ZM_VERB_PREFIX "ZManager"
!define ZM_MENU_KEY "ZManager"
!define ZM_COMMANDSTORE_ROOT "Software\Microsoft\Windows\CurrentVersion\Explorer\CommandStore\shell"
!define ZM_ARCHIVE_SUBCOMMANDS "ZManager.OpenArchive;ZManager.ExtractHere;ZManager.AddToArchiveFile;ZManager.AddToTzapFile;ZManager.AddToZipFile;ZManager.AddToSevenZFile;ZManager.AddToTzstFile"
!define ZM_CREATE_FILE_SUBCOMMANDS "ZManager.AddToArchiveFile;ZManager.AddToTzapFile;ZManager.AddToZipFile;ZManager.AddToSevenZFile;ZManager.AddToTzstFile"
!define ZM_CREATE_BACKGROUND_SUBCOMMANDS "ZManager.AddToArchiveBackground;ZManager.AddToTzapBackground;ZManager.AddToZipBackground;ZManager.AddToSevenZBackground;ZManager.AddToTzstBackground"
!define ZM_NON_ARCHIVE_FILE_APPLIES_TO "NOT System.FileExtension:=.zip AND NOT System.FileExtension:=.zipx AND NOT System.FileExtension:=.7z AND NOT System.FileExtension:=.rar AND NOT System.FileExtension:=.tar AND NOT System.FileExtension:=.gz AND NOT System.FileExtension:=.tgz AND NOT System.FileExtension:=.xz AND NOT System.FileExtension:=.txz AND NOT System.FileExtension:=.zst AND NOT System.FileExtension:=.tzst AND NOT System.FileExtension:=.tzap"

!macro ZM_WRITE_CONTEXT_VERB SHELL_KEY VERB_NAME LABEL QUICK_ACTION TARGET_TOKEN
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_VERB_PREFIX}${VERB_NAME}" "" "${LABEL}"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_VERB_PREFIX}${VERB_NAME}" "Icon" "$INSTDIR\${ZM_EXE_NAME}"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_VERB_PREFIX}${VERB_NAME}" "MultiSelectModel" "Player"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_VERB_PREFIX}${VERB_NAME}\command" "" "$\"$INSTDIR\${ZM_EXE_NAME}$\" --quick-action ${QUICK_ACTION} --path $\"${TARGET_TOKEN}$\""
!macroend

!macro ZM_WRITE_CASCADE_MENU SHELL_KEY SUBCOMMANDS
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "MUIVerb" "ZManager"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "Icon" "$INSTDIR\${ZM_EXE_NAME}"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "SubCommands" "${SUBCOMMANDS}"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "MultiSelectModel" "Player"
!macroend

!macro ZM_WRITE_FILTERED_CASCADE_MENU SHELL_KEY APPLIES_TO SUBCOMMANDS
  !insertmacro ZM_WRITE_CASCADE_MENU "${SHELL_KEY}" "${SUBCOMMANDS}"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "AppliesTo" "${APPLIES_TO}"
!macroend

!macro ZM_WRITE_COMMANDSTORE_VERB COMMAND_NAME LABEL QUICK_ACTION TARGET_TOKEN
  WriteRegStr HKCU "${ZM_COMMANDSTORE_ROOT}\${COMMAND_NAME}" "MUIVerb" "${LABEL}"
  WriteRegStr HKCU "${ZM_COMMANDSTORE_ROOT}\${COMMAND_NAME}" "Icon" "$INSTDIR\${ZM_EXE_NAME}"
  WriteRegStr HKCU "${ZM_COMMANDSTORE_ROOT}\${COMMAND_NAME}" "MultiSelectModel" "Player"
  WriteRegStr HKCU "${ZM_COMMANDSTORE_ROOT}\${COMMAND_NAME}\command" "" "$\"$INSTDIR\${ZM_EXE_NAME}$\" --quick-action ${QUICK_ACTION} --path $\"${TARGET_TOKEN}$\""
!macroend

!macro ZM_DELETE_COMMANDSTORE_VERB COMMAND_NAME
  DeleteRegKey HKCU "${ZM_COMMANDSTORE_ROOT}\${COMMAND_NAME}"
!macroend

!macro ZM_REGISTER_ORDERED_COMMANDSTORE_VERBS
  !insertmacro ZM_WRITE_COMMANDSTORE_VERB "ZManager.OpenArchive" "Open archive" "open" "%1"
  !insertmacro ZM_WRITE_COMMANDSTORE_VERB "ZManager.ExtractHere" "Extract Here" "extract-here" "%1"
  !insertmacro ZM_WRITE_COMMANDSTORE_VERB "ZManager.AddToArchiveFile" "Add to archive" "compress" "%1"
  !insertmacro ZM_WRITE_COMMANDSTORE_VERB "ZManager.AddToTzapFile" "Add to .tzap" "compress-tzap" "%1"
  !insertmacro ZM_WRITE_COMMANDSTORE_VERB "ZManager.AddToZipFile" "Add to .zip" "compress-zip" "%1"
  !insertmacro ZM_WRITE_COMMANDSTORE_VERB "ZManager.AddToSevenZFile" "Add to .7z" "compress-7z" "%1"
  !insertmacro ZM_WRITE_COMMANDSTORE_VERB "ZManager.AddToTzstFile" "Add to .tzst" "compress-tzst" "%1"
  !insertmacro ZM_WRITE_COMMANDSTORE_VERB "ZManager.AddToArchiveBackground" "Add to archive" "compress" "%V"
  !insertmacro ZM_WRITE_COMMANDSTORE_VERB "ZManager.AddToTzapBackground" "Add to .tzap" "compress-tzap" "%V"
  !insertmacro ZM_WRITE_COMMANDSTORE_VERB "ZManager.AddToZipBackground" "Add to .zip" "compress-zip" "%V"
  !insertmacro ZM_WRITE_COMMANDSTORE_VERB "ZManager.AddToSevenZBackground" "Add to .7z" "compress-7z" "%V"
  !insertmacro ZM_WRITE_COMMANDSTORE_VERB "ZManager.AddToTzstBackground" "Add to .tzst" "compress-tzst" "%V"
!macroend

!macro ZM_UNREGISTER_ORDERED_COMMANDSTORE_VERBS
  !insertmacro ZM_DELETE_COMMANDSTORE_VERB "ZManager.OpenArchive"
  !insertmacro ZM_DELETE_COMMANDSTORE_VERB "ZManager.ExtractHere"
  !insertmacro ZM_DELETE_COMMANDSTORE_VERB "ZManager.AddToArchiveFile"
  !insertmacro ZM_DELETE_COMMANDSTORE_VERB "ZManager.AddToTzapFile"
  !insertmacro ZM_DELETE_COMMANDSTORE_VERB "ZManager.AddToZipFile"
  !insertmacro ZM_DELETE_COMMANDSTORE_VERB "ZManager.AddToSevenZFile"
  !insertmacro ZM_DELETE_COMMANDSTORE_VERB "ZManager.AddToTzstFile"
  !insertmacro ZM_DELETE_COMMANDSTORE_VERB "ZManager.AddToArchiveBackground"
  !insertmacro ZM_DELETE_COMMANDSTORE_VERB "ZManager.AddToTzapBackground"
  !insertmacro ZM_DELETE_COMMANDSTORE_VERB "ZManager.AddToZipBackground"
  !insertmacro ZM_DELETE_COMMANDSTORE_VERB "ZManager.AddToSevenZBackground"
  !insertmacro ZM_DELETE_COMMANDSTORE_VERB "ZManager.AddToTzstBackground"
!macroend

!macro ZM_WRITE_ARCHIVE_CASCADE_MENU SHELL_KEY
  !insertmacro ZM_WRITE_CASCADE_MENU "${SHELL_KEY}" "${ZM_ARCHIVE_SUBCOMMANDS}"
!macroend

!macro ZM_WRITE_CREATE_CASCADE_MENU SHELL_KEY
  !insertmacro ZM_WRITE_CASCADE_MENU "${SHELL_KEY}" "${ZM_CREATE_FILE_SUBCOMMANDS}"
!macroend

!macro ZM_WRITE_FILTERED_CREATE_CASCADE_MENU SHELL_KEY
  !insertmacro ZM_WRITE_FILTERED_CASCADE_MENU "${SHELL_KEY}" "${ZM_NON_ARCHIVE_FILE_APPLIES_TO}" "${ZM_CREATE_FILE_SUBCOMMANDS}"
!macroend

!macro ZM_WRITE_BACKGROUND_CREATE_CASCADE_MENU SHELL_KEY
  !insertmacro ZM_WRITE_CASCADE_MENU "${SHELL_KEY}" "${ZM_CREATE_BACKGROUND_SUBCOMMANDS}"
!macroend

!macro ZM_DELETE_CONTEXT_VERB SHELL_KEY VERB_NAME
  DeleteRegKey HKCU "${SHELL_KEY}\${ZM_VERB_PREFIX}${VERB_NAME}"
!macroend

!macro ZM_DELETE_CASCADE_MENU SHELL_KEY
  DeleteRegKey HKCU "${SHELL_KEY}\${ZM_MENU_KEY}"
!macroend

!macro ZM_REGISTER_ARCHIVE_EXTENSION EXTENSION
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\SystemFileAssociations\${EXTENSION}\shell" "Extract"
  !insertmacro ZM_DELETE_CASCADE_MENU "Software\Classes\SystemFileAssociations\${EXTENSION}\shell"
  !insertmacro ZM_WRITE_ARCHIVE_CASCADE_MENU "Software\Classes\SystemFileAssociations\${EXTENSION}\shell"
!macroend

!macro ZM_UNREGISTER_ARCHIVE_EXTENSION EXTENSION
  !insertmacro ZM_DELETE_CASCADE_MENU "Software\Classes\SystemFileAssociations\${EXTENSION}\shell"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\SystemFileAssociations\${EXTENSION}\shell" "Extract"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\SystemFileAssociations\${EXTENSION}\shell" "ExtractHere"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\SystemFileAssociations\${EXTENSION}\shell" "ExtractToFolder"
!macroend

!macro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS_FOR EXTENSION
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\SystemFileAssociations\${EXTENSION}\shell" "ExtractHere"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\SystemFileAssociations\${EXTENSION}\shell" "ExtractToFolder"
!macroend

!macro ZM_REGISTER_ARCHIVE_EXTENSIONS
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".zip"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".zipx"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".7z"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".rar"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".tar"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".gz"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".tgz"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".xz"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".txz"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".zst"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".tzst"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".tzap"
!macroend

!macro ZM_UNREGISTER_ARCHIVE_EXTENSIONS
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".zip"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".zipx"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".7z"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".rar"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".tar"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".gz"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".tgz"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".xz"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".txz"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".zst"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".tzst"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".tzap"
!macroend

!macro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS
  !insertmacro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS_FOR ".zip"
  !insertmacro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS_FOR ".zipx"
  !insertmacro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS_FOR ".7z"
  !insertmacro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS_FOR ".rar"
  !insertmacro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS_FOR ".tar"
  !insertmacro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS_FOR ".gz"
  !insertmacro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS_FOR ".tgz"
  !insertmacro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS_FOR ".xz"
  !insertmacro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS_FOR ".txz"
  !insertmacro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS_FOR ".zst"
  !insertmacro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS_FOR ".tzst"
  !insertmacro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS_FOR ".tzap"
!macroend

!macro ZM_REFRESH_SHELL_ASSOCIATIONS
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\*\shell" "CompressZip"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\*\shell" "CompressCleanSource"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\shell" "CompressZip"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\shell" "CompressCleanSource"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\Background\shell" "CompressZip"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\Background\shell" "CompressCleanSource"
  !insertmacro ZM_UNREGISTER_RETIRED_ARCHIVE_EXTENSION_VERBS
  !insertmacro ZM_UNREGISTER_ORDERED_COMMANDSTORE_VERBS
  !insertmacro ZM_REGISTER_ORDERED_COMMANDSTORE_VERBS
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\*\shell" "Compress"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\shell" "Compress"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\Background\shell" "Compress"
  !insertmacro ZM_DELETE_CASCADE_MENU "Software\Classes\*\shell"
  !insertmacro ZM_DELETE_CASCADE_MENU "Software\Classes\Directory\shell"
  !insertmacro ZM_DELETE_CASCADE_MENU "Software\Classes\Directory\Background\shell"
  !insertmacro ZM_WRITE_FILTERED_CREATE_CASCADE_MENU "Software\Classes\*\shell"
  !insertmacro ZM_WRITE_CREATE_CASCADE_MENU "Software\Classes\Directory\shell"
  !insertmacro ZM_WRITE_BACKGROUND_CREATE_CASCADE_MENU "Software\Classes\Directory\Background\shell"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSIONS
  !insertmacro ZM_REFRESH_SHELL_ASSOCIATIONS
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro ZM_DELETE_CASCADE_MENU "Software\Classes\*\shell"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\*\shell" "Compress"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\*\shell" "CompressZip"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\*\shell" "CompressCleanSource"
  !insertmacro ZM_DELETE_CASCADE_MENU "Software\Classes\Directory\shell"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\shell" "Compress"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\shell" "CompressZip"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\shell" "CompressCleanSource"
  !insertmacro ZM_DELETE_CASCADE_MENU "Software\Classes\Directory\Background\shell"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\Background\shell" "Compress"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\Background\shell" "CompressZip"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\Background\shell" "CompressCleanSource"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSIONS
  !insertmacro ZM_UNREGISTER_ORDERED_COMMANDSTORE_VERBS
  !insertmacro ZM_REFRESH_SHELL_ASSOCIATIONS
!macroend
