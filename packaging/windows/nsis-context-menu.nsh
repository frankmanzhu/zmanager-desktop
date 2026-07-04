!define ZM_EXE_NAME "zmanager-desktop.exe"
!define ZM_VERB_PREFIX "ZManager"
!define ZM_MENU_KEY "ZManager"
!define ZM_ARCHIVE_SUBCOMMANDS_KEY "ZManager.Desktop.ContextMenu.Archive"
!define ZM_CREATE_FILE_SUBCOMMANDS_KEY "ZManager.Desktop.ContextMenu.CreateFile"
!define ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY "ZManager.Desktop.ContextMenu.CreateBackground"
!define ZM_NON_ARCHIVE_FILE_APPLIES_TO "NOT System.FileExtension:=.001 AND NOT System.FileExtension:=.7z AND NOT System.FileExtension:=.apk AND NOT System.FileExtension:=.appx AND NOT System.FileExtension:=.br AND NOT System.FileExtension:=.bz2 AND NOT System.FileExtension:=.cab AND NOT System.FileExtension:=.cbr AND NOT System.FileExtension:=.cpio AND NOT System.FileExtension:=.deb AND NOT System.FileExtension:=.gz AND NOT System.FileExtension:=.ipa AND NOT System.FileExtension:=.iso AND NOT System.FileExtension:=.jar AND NOT System.FileExtension:=.lrz AND NOT System.FileExtension:=.lz AND NOT System.FileExtension:=.lz4 AND NOT System.FileExtension:=.lzma AND NOT System.FileExtension:=.lzo AND NOT System.FileExtension:=.rar AND NOT System.FileExtension:=.rpm AND NOT System.FileExtension:=.tar AND NOT System.FileExtension:=.tbz2 AND NOT System.FileExtension:=.tgz AND NOT System.FileExtension:=.txz AND NOT System.FileExtension:=.tzap AND NOT System.FileExtension:=.tzst AND NOT System.FileExtension:=.war AND NOT System.FileExtension:=.xar AND NOT System.FileExtension:=.xpi AND NOT System.FileExtension:=.xz AND NOT System.FileExtension:=.z AND NOT System.FileExtension:=.zip AND NOT System.FileExtension:=.zipx AND NOT System.FileExtension:=.zst"

!macro ZM_WRITE_CASCADE_MENU SHELL_KEY SUBCOMMANDS_KEY
  DeleteRegValue HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "SubCommands"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "MUIVerb" "ZManager"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "Icon" "$INSTDIR\${ZM_EXE_NAME}"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "ExtendedSubCommandsKey" "${SUBCOMMANDS_KEY}"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "MultiSelectModel" "Player"
!macroend

!macro ZM_WRITE_FILTERED_CASCADE_MENU SHELL_KEY APPLIES_TO SUBCOMMANDS_KEY
  !insertmacro ZM_WRITE_CASCADE_MENU "${SHELL_KEY}" "${SUBCOMMANDS_KEY}"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "AppliesTo" "${APPLIES_TO}"
!macroend

!macro ZM_WRITE_SUBCOMMAND_VERB SUBCOMMANDS_KEY VERB_NAME LABEL QUICK_ACTION TARGET_TOKEN
  WriteRegStr HKCU "Software\Classes\${SUBCOMMANDS_KEY}\shell\${VERB_NAME}" "MUIVerb" "${LABEL}"
  WriteRegStr HKCU "Software\Classes\${SUBCOMMANDS_KEY}\shell\${VERB_NAME}" "Icon" "$INSTDIR\${ZM_EXE_NAME}"
  WriteRegStr HKCU "Software\Classes\${SUBCOMMANDS_KEY}\shell\${VERB_NAME}" "MultiSelectModel" "Player"
  WriteRegStr HKCU "Software\Classes\${SUBCOMMANDS_KEY}\shell\${VERB_NAME}\command" "" "$\"$INSTDIR\${ZM_EXE_NAME}$\" --quick-action ${QUICK_ACTION} --path $\"${TARGET_TOKEN}$\""
!macroend

!macro ZM_DELETE_SUBCOMMANDS SUBCOMMANDS_KEY
  DeleteRegKey HKCU "Software\Classes\${SUBCOMMANDS_KEY}"
!macroend

!macro ZM_DELETE_RETIRED_COMMANDSTORE_VERB COMMAND_NAME
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\CommandStore\shell\${COMMAND_NAME}"
!macroend

!macro ZM_UNREGISTER_RETIRED_COMMANDSTORE_VERBS
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.OpenArchive"
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.ExtractHere"
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.AddToArchiveFile"
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.AddToTzapFile"
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.AddToZipFile"
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.AddToSevenZFile"
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.AddToTzstFile"
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.AddToArchiveBackground"
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.AddToTzapBackground"
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.AddToZipBackground"
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.AddToSevenZBackground"
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.AddToTzstBackground"
!macroend

!macro ZM_REGISTER_ORDERED_SUBCOMMANDS
  !insertmacro ZM_DELETE_SUBCOMMANDS "${ZM_ARCHIVE_SUBCOMMANDS_KEY}"
  !insertmacro ZM_DELETE_SUBCOMMANDS "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}"
  !insertmacro ZM_DELETE_SUBCOMMANDS "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "01ExtractHere" "Extract Here" "extract-here" "%1"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "02ExtractToFolder" "Extract to Archive Folder" "extract-to-folder" "%1"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "03OpenArchive" "Open archive" "open" "%1"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "04AddToArchive" "Add to archive..." "compress" "%1"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "05AddToTzap" "Add to .tzap" "compress-tzap" "%1"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "06AddToZip" "Add to .zip" "compress-zip" "%1"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "07AddToSevenZ" "Add to .7z" "compress-7z" "%1"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "08AddToTzst" "Add to .tzst" "compress-tzst" "%1"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}" "01AddToArchive" "Add to archive..." "compress" "%1"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}" "02AddToTzap" "Add to .tzap" "compress-tzap" "%1"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}" "03AddToZip" "Add to .zip" "compress-zip" "%1"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}" "04AddToSevenZ" "Add to .7z" "compress-7z" "%1"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}" "05AddToTzst" "Add to .tzst" "compress-tzst" "%1"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}" "01AddToArchive" "Add to archive..." "compress" "%V"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}" "02AddToTzap" "Add to .tzap" "compress-tzap" "%V"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}" "03AddToZip" "Add to .zip" "compress-zip" "%V"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}" "04AddToSevenZ" "Add to .7z" "compress-7z" "%V"
  !insertmacro ZM_WRITE_SUBCOMMAND_VERB "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}" "05AddToTzst" "Add to .tzst" "compress-tzst" "%V"
!macroend

!macro ZM_UNREGISTER_ORDERED_SUBCOMMANDS
  !insertmacro ZM_DELETE_SUBCOMMANDS "${ZM_ARCHIVE_SUBCOMMANDS_KEY}"
  !insertmacro ZM_DELETE_SUBCOMMANDS "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}"
  !insertmacro ZM_DELETE_SUBCOMMANDS "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}"
!macroend

!macro ZM_WRITE_ARCHIVE_CASCADE_MENU SHELL_KEY
  !insertmacro ZM_WRITE_CASCADE_MENU "${SHELL_KEY}" "${ZM_ARCHIVE_SUBCOMMANDS_KEY}"
!macroend

!macro ZM_WRITE_CREATE_CASCADE_MENU SHELL_KEY
  !insertmacro ZM_WRITE_CASCADE_MENU "${SHELL_KEY}" "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}"
!macroend

!macro ZM_WRITE_FILTERED_CREATE_CASCADE_MENU SHELL_KEY
  !insertmacro ZM_WRITE_FILTERED_CASCADE_MENU "${SHELL_KEY}" "${ZM_NON_ARCHIVE_FILE_APPLIES_TO}" "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}"
!macroend

!macro ZM_WRITE_BACKGROUND_CREATE_CASCADE_MENU SHELL_KEY
  !insertmacro ZM_WRITE_CASCADE_MENU "${SHELL_KEY}" "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}"
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
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".001"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".7z"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".apk"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".appx"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".br"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".bz2"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".cab"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".cbr"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".cpio"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".deb"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".gz"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".ipa"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".iso"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".jar"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".lrz"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".lz"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".lz4"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".lzma"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".lzo"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".rar"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".rpm"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".tar"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".tbz2"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".tgz"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".txz"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".tzap"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".tzst"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".war"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".xar"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".xpi"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".xz"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".z"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".zip"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".zipx"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSION ".zst"
!macroend

!macro ZM_UNREGISTER_ARCHIVE_EXTENSIONS
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".001"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".7z"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".apk"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".appx"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".br"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".bz2"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".cab"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".cbr"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".cpio"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".deb"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".gz"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".ipa"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".iso"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".jar"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".lrz"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".lz"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".lz4"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".lzma"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".lzo"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".rar"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".rpm"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".tar"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".tbz2"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".tgz"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".txz"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".tzap"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".tzst"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".war"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".xar"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".xpi"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".xz"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".z"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".zip"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".zipx"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSION ".zst"
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
  !insertmacro ZM_UNREGISTER_RETIRED_COMMANDSTORE_VERBS
  !insertmacro ZM_REGISTER_ORDERED_SUBCOMMANDS
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\*\shell" "Compress"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\shell" "Compress"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\Background\shell" "Compress"
  !insertmacro ZM_DELETE_CASCADE_MENU "Software\Classes\*\shell"
  !insertmacro ZM_DELETE_CASCADE_MENU "Software\Classes\Directory\shell"
  !insertmacro ZM_DELETE_CASCADE_MENU "Software\Classes\Directory\Background\shell"
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
  !insertmacro ZM_UNREGISTER_ORDERED_SUBCOMMANDS
  !insertmacro ZM_UNREGISTER_RETIRED_COMMANDSTORE_VERBS
  !insertmacro ZM_REFRESH_SHELL_ASSOCIATIONS
!macroend
