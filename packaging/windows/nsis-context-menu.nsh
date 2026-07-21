!define ZM_EXE_NAME "zmanager-desktop.exe"
!define ZM_SHELL_EXTENSION_NAME "zmanager-shell-extension.dll"
!define ZM_SHELL_EXTENSION_SOURCE "${__FILEDIR__}\..\..\target\windows-shell-extension\zmanager-shell-extension.dll"
!define ZM_VERB_PREFIX "ZManager"
!define ZM_MENU_KEY "ZManager"
!define ZM_ARCHIVE_SUBCOMMANDS_KEY "ZManager.Desktop.ContextMenu.Archive"
!define ZM_CREATE_FILE_SUBCOMMANDS_KEY "ZManager.Desktop.ContextMenu.CreateFile"
!define ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY "ZManager.Desktop.ContextMenu.CreateBackground"
!define ZM_NON_ARCHIVE_FILE_APPLIES_TO "NOT System.FileExtension:=.001 AND NOT System.FileExtension:=.7z AND NOT System.FileExtension:=.apk AND NOT System.FileExtension:=.appx AND NOT System.FileExtension:=.br AND NOT System.FileExtension:=.bz2 AND NOT System.FileExtension:=.cab AND NOT System.FileExtension:=.cbr AND NOT System.FileExtension:=.cpio AND NOT System.FileExtension:=.deb AND NOT System.FileExtension:=.gz AND NOT System.FileExtension:=.ipa AND NOT System.FileExtension:=.iso AND NOT System.FileExtension:=.jar AND NOT System.FileExtension:=.lrz AND NOT System.FileExtension:=.lz AND NOT System.FileExtension:=.lz4 AND NOT System.FileExtension:=.lzma AND NOT System.FileExtension:=.lzo AND NOT System.FileExtension:=.rar AND NOT System.FileExtension:=.rpm AND NOT System.FileExtension:=.tar AND NOT System.FileExtension:=.tbz2 AND NOT System.FileExtension:=.tgz AND NOT System.FileExtension:=.txz AND NOT System.FileExtension:=.tzap AND NOT System.FileExtension:=.tzst AND NOT System.FileExtension:=.war AND NOT System.FileExtension:=.xar AND NOT System.FileExtension:=.xpi AND NOT System.FileExtension:=.xz AND NOT System.FileExtension:=.z AND NOT System.FileExtension:=.zip AND NOT System.FileExtension:=.zipx AND NOT System.FileExtension:=.zst"
!define ZM_OPEN_CLSID "{8AC91DD4-B918-4118-9635-9407A4731972}"
!define ZM_EXTRACT_HERE_CLSID "{5E7C0ABE-AC4C-4D4B-BEDD-A9133D7F80D4}"
!define ZM_EXTRACT_TO_FOLDER_CLSID "{AE04555B-2C6B-42C1-870A-9B15E1E0B82B}"
!define ZM_COMPRESS_CLSID "{8BD7F398-A6C3-40A2-A4F8-725E0D671366}"
!define ZM_COMPRESS_TZAP_CLSID "{BEEB01F9-5243-4F96-9BB1-54FA4C250CDE}"
!define ZM_COMPRESS_ZIP_CLSID "{AA751926-E80F-47A5-9E03-DFA87926F23A}"
!define ZM_COMPRESS_SEVEN_Z_CLSID "{C910BF28-3121-48F7-A8A1-2F4D8F587CE8}"
!define ZM_COMPRESS_TAR_ZST_CLSID "{9838E6CB-F43E-4FC9-96F1-7F0F4BDBB728}"
!define ZM_COMPRESS_TAR_GZ_CLSID "{7F3E8A1B-2C4D-45F6-9A7B-8C9D0E1F2A3B}"

!macro ZM_WRITE_CASCADE_MENU SHELL_KEY SUBCOMMANDS_KEY
  DeleteRegValue HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "SubCommands"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "MUIVerb" "ZManager"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "Icon" "$INSTDIR\${ZM_EXE_NAME}"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "ExtendedSubCommandsKey" "${SUBCOMMANDS_KEY}"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_MENU_KEY}" "MultiSelectModel" "Player"
!macroend

!macro ZM_WRITE_COM_SUBCOMMAND_VERB SUBCOMMANDS_KEY VERB_NAME LABEL CLSID
  WriteRegStr HKCU "Software\Classes\${SUBCOMMANDS_KEY}\shell\${VERB_NAME}" "MUIVerb" "${LABEL}"
  WriteRegStr HKCU "Software\Classes\${SUBCOMMANDS_KEY}\shell\${VERB_NAME}" "Icon" "$INSTDIR\${ZM_EXE_NAME}"
  WriteRegStr HKCU "Software\Classes\${SUBCOMMANDS_KEY}\shell\${VERB_NAME}" "MultiSelectModel" "Player"
  WriteRegStr HKCU "Software\Classes\${SUBCOMMANDS_KEY}\shell\${VERB_NAME}" "ExplorerCommandHandler" "${CLSID}"
!macroend

!macro ZM_WRITE_COMMAND_SUBCOMMAND_VERB SUBCOMMANDS_KEY VERB_NAME LABEL QUICK_ACTION TARGET_TOKEN
  WriteRegStr HKCU "Software\Classes\${SUBCOMMANDS_KEY}\shell\${VERB_NAME}" "MUIVerb" "${LABEL}"
  WriteRegStr HKCU "Software\Classes\${SUBCOMMANDS_KEY}\shell\${VERB_NAME}" "Icon" "$INSTDIR\${ZM_EXE_NAME}"
  WriteRegStr HKCU "Software\Classes\${SUBCOMMANDS_KEY}\shell\${VERB_NAME}" "MultiSelectModel" "Player"
  WriteRegStr HKCU "Software\Classes\${SUBCOMMANDS_KEY}\shell\${VERB_NAME}\command" "" "$\"$INSTDIR\${ZM_EXE_NAME}$\" --quick-action ${QUICK_ACTION} --path $\"${TARGET_TOKEN}$\""
!macroend

!macro ZM_REGISTER_COM_CLASS CLSID
  WriteRegStr HKCU "Software\Classes\CLSID\${CLSID}\InprocServer32" "" "$INSTDIR\${ZM_SHELL_EXTENSION_NAME}"
  WriteRegStr HKCU "Software\Classes\CLSID\${CLSID}\InprocServer32" "ThreadingModel" "Apartment"
!macroend

!macro ZM_UNREGISTER_COM_CLASS CLSID
  DeleteRegKey HKCU "Software\Classes\CLSID\${CLSID}"
!macroend

!macro ZM_REGISTER_SHELL_EXTENSION_CLASSES
  !insertmacro ZM_REGISTER_COM_CLASS "${ZM_OPEN_CLSID}"
  !insertmacro ZM_REGISTER_COM_CLASS "${ZM_EXTRACT_HERE_CLSID}"
  !insertmacro ZM_REGISTER_COM_CLASS "${ZM_EXTRACT_TO_FOLDER_CLSID}"
  !insertmacro ZM_REGISTER_COM_CLASS "${ZM_COMPRESS_CLSID}"
  !insertmacro ZM_REGISTER_COM_CLASS "${ZM_COMPRESS_TZAP_CLSID}"
  !insertmacro ZM_REGISTER_COM_CLASS "${ZM_COMPRESS_ZIP_CLSID}"
  !insertmacro ZM_REGISTER_COM_CLASS "${ZM_COMPRESS_SEVEN_Z_CLSID}"
  !insertmacro ZM_REGISTER_COM_CLASS "${ZM_COMPRESS_TAR_ZST_CLSID}"
  !insertmacro ZM_REGISTER_COM_CLASS "${ZM_COMPRESS_TAR_GZ_CLSID}"
!macroend

!macro ZM_UNREGISTER_SHELL_EXTENSION_CLASSES
  !insertmacro ZM_UNREGISTER_COM_CLASS "${ZM_OPEN_CLSID}"
  !insertmacro ZM_UNREGISTER_COM_CLASS "${ZM_EXTRACT_HERE_CLSID}"
  !insertmacro ZM_UNREGISTER_COM_CLASS "${ZM_EXTRACT_TO_FOLDER_CLSID}"
  !insertmacro ZM_UNREGISTER_COM_CLASS "${ZM_COMPRESS_CLSID}"
  !insertmacro ZM_UNREGISTER_COM_CLASS "${ZM_COMPRESS_TZAP_CLSID}"
  !insertmacro ZM_UNREGISTER_COM_CLASS "${ZM_COMPRESS_ZIP_CLSID}"
  !insertmacro ZM_UNREGISTER_COM_CLASS "${ZM_COMPRESS_SEVEN_Z_CLSID}"
  !insertmacro ZM_UNREGISTER_COM_CLASS "${ZM_COMPRESS_TAR_ZST_CLSID}"
  !insertmacro ZM_UNREGISTER_COM_CLASS "${ZM_COMPRESS_TAR_GZ_CLSID}"
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
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.AddToTgzFile"
  !insertmacro ZM_DELETE_RETIRED_COMMANDSTORE_VERB "ZManager.AddToTgzBackground"
!macroend

!macro ZM_REGISTER_ORDERED_SUBCOMMANDS
  !insertmacro ZM_DELETE_SUBCOMMANDS "${ZM_ARCHIVE_SUBCOMMANDS_KEY}"
  !insertmacro ZM_DELETE_SUBCOMMANDS "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}"
  !insertmacro ZM_DELETE_SUBCOMMANDS "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "01ExtractHere" "Extract Here" "${ZM_EXTRACT_HERE_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "02ExtractToFolder" "Extract to Archive Folder" "${ZM_EXTRACT_TO_FOLDER_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "03OpenArchive" "Open archive" "${ZM_OPEN_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "04AddToArchive" "Add to archive..." "${ZM_COMPRESS_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "05AddToTzap" "Add to .tzap" "${ZM_COMPRESS_TZAP_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "06AddToZip" "Add to .zip" "${ZM_COMPRESS_ZIP_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "07AddToSevenZ" "Add to .7z" "${ZM_COMPRESS_SEVEN_Z_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "08AddToTzst" "Add to .tzst" "${ZM_COMPRESS_TAR_ZST_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_ARCHIVE_SUBCOMMANDS_KEY}" "09AddToTgz" "Add to .tgz" "${ZM_COMPRESS_TAR_GZ_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}" "01AddToArchive" "Add to archive..." "${ZM_COMPRESS_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}" "02AddToTzap" "Add to .tzap" "${ZM_COMPRESS_TZAP_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}" "03AddToZip" "Add to .zip" "${ZM_COMPRESS_ZIP_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}" "04AddToSevenZ" "Add to .7z" "${ZM_COMPRESS_SEVEN_Z_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}" "05AddToTzst" "Add to .tzst" "${ZM_COMPRESS_TAR_ZST_CLSID}"
  !insertmacro ZM_WRITE_COM_SUBCOMMAND_VERB "${ZM_CREATE_FILE_SUBCOMMANDS_KEY}" "06AddToTgz" "Add to .tgz" "${ZM_COMPRESS_TAR_GZ_CLSID}"
  !insertmacro ZM_WRITE_COMMAND_SUBCOMMAND_VERB "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}" "01AddToArchive" "Add to archive..." "compress" "%V"
  !insertmacro ZM_WRITE_COMMAND_SUBCOMMAND_VERB "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}" "02AddToTzap" "Add to .tzap" "compress-tzap" "%V"
  !insertmacro ZM_WRITE_COMMAND_SUBCOMMAND_VERB "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}" "03AddToZip" "Add to .zip" "compress-zip" "%V"
  !insertmacro ZM_WRITE_COMMAND_SUBCOMMAND_VERB "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}" "04AddToSevenZ" "Add to .7z" "compress-7z" "%V"
  !insertmacro ZM_WRITE_COMMAND_SUBCOMMAND_VERB "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}" "05AddToTzst" "Add to .tzst" "compress-tzst" "%V"
  !insertmacro ZM_WRITE_COMMAND_SUBCOMMAND_VERB "${ZM_CREATE_BACKGROUND_SUBCOMMANDS_KEY}" "06AddToTgz" "Add to .tgz" "compress-tgz" "%V"
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
  SetOutPath "$INSTDIR"
  File /oname=${ZM_SHELL_EXTENSION_NAME} "${ZM_SHELL_EXTENSION_SOURCE}"
  !insertmacro ZM_REGISTER_SHELL_EXTENSION_CLASSES
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
  !insertmacro ZM_WRITE_CREATE_CASCADE_MENU "Software\Classes\*\shell"
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
  !insertmacro ZM_UNREGISTER_SHELL_EXTENSION_CLASSES
  !insertmacro ZM_REFRESH_SHELL_ASSOCIATIONS
  Delete /REBOOTOK "$INSTDIR\${ZM_SHELL_EXTENSION_NAME}"
!macroend
