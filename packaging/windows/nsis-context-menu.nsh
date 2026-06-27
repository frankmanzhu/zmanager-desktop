!define ZM_EXE_NAME "zmanager-desktop.exe"
!define ZM_VERB_PREFIX "ZManager"

!macro ZM_WRITE_CONTEXT_VERB SHELL_KEY VERB_NAME LABEL QUICK_ACTION TARGET_TOKEN
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_VERB_PREFIX}${VERB_NAME}" "" "${LABEL}"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_VERB_PREFIX}${VERB_NAME}" "Icon" "$INSTDIR\${ZM_EXE_NAME}"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_VERB_PREFIX}${VERB_NAME}" "MultiSelectModel" "Player"
  WriteRegStr HKCU "${SHELL_KEY}\${ZM_VERB_PREFIX}${VERB_NAME}\command" "" "$\"$INSTDIR\${ZM_EXE_NAME}$\" --quick-action ${QUICK_ACTION} --path $\"${TARGET_TOKEN}$\""
!macroend

!macro ZM_DELETE_CONTEXT_VERB SHELL_KEY VERB_NAME
  DeleteRegKey HKCU "${SHELL_KEY}\${ZM_VERB_PREFIX}${VERB_NAME}"
!macroend

!macro ZM_REGISTER_ARCHIVE_EXTENSION EXTENSION
  !insertmacro ZM_WRITE_CONTEXT_VERB "Software\Classes\SystemFileAssociations\${EXTENSION}\shell" "Extract" "Extract using ZManager" "extract" "%1"
!macroend

!macro ZM_UNREGISTER_ARCHIVE_EXTENSION EXTENSION
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
  !insertmacro ZM_WRITE_CONTEXT_VERB "Software\Classes\*\shell" "Compress" "Compress using ZManager" "compress" "%1"
  !insertmacro ZM_WRITE_CONTEXT_VERB "Software\Classes\Directory\shell" "Compress" "Compress using ZManager" "compress" "%1"
  !insertmacro ZM_WRITE_CONTEXT_VERB "Software\Classes\Directory\Background\shell" "Compress" "Compress using ZManager" "compress" "%V"
  !insertmacro ZM_REGISTER_ARCHIVE_EXTENSIONS
  !insertmacro ZM_REFRESH_SHELL_ASSOCIATIONS
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\*\shell" "Compress"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\*\shell" "CompressZip"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\*\shell" "CompressCleanSource"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\shell" "Compress"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\shell" "CompressZip"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\shell" "CompressCleanSource"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\Background\shell" "Compress"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\Background\shell" "CompressZip"
  !insertmacro ZM_DELETE_CONTEXT_VERB "Software\Classes\Directory\Background\shell" "CompressCleanSource"
  !insertmacro ZM_UNREGISTER_ARCHIVE_EXTENSIONS
  !insertmacro ZM_REFRESH_SHELL_ASSOCIATIONS
!macroend
