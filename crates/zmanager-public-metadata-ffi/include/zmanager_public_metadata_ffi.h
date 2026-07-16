#ifndef ZMANAGER_PUBLIC_METADATA_FFI_H
#define ZMANAGER_PUBLIC_METADATA_FFI_H

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

uint32_t zmanager_public_metadata_ffi_version(void);
char *zmanager_public_metadata_summary_json(const char *archive_path);
void zmanager_public_metadata_string_free(char *value);

#ifdef __cplusplus
}
#endif
#endif
