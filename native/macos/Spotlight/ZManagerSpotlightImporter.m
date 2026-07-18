#import <CoreFoundation/CoreFoundation.h>
#import <CoreFoundation/CFPlugInCOM.h>
#import <CoreServices/CoreServices.h>
#import <Foundation/Foundation.h>
#import <Metadata/MDImporter.h>

#import "zmanager_public_metadata_ffi.h"

static NSString *const ZMTzapUTI = @"com.frankmanzhu.zmanager.tzap";
static NSString *const ZMSignatureStatus = @"com_frankmanzhu_zmanager_tzapSignatureStatus";
static NSString *const ZMSigner = @"com_frankmanzhu_zmanager_tzapSigner";
static NSString *const ZMIssuer = @"com_frankmanzhu_zmanager_tzapIssuer";
static NSString *const ZMEncryption = @"com_frankmanzhu_zmanager_tzapEncryption";
static NSString *const ZMVolumeCount = @"com_frankmanzhu_zmanager_tzapVolumeCount";

typedef struct {
    MDImporterInterfaceStruct *interface;
    CFUUIDRef factoryID;
    UInt32 refCount;
} ZMMetadataImporterPlugin;

static CFUUIDRef ZMFactoryID(void) {
    return CFUUIDGetConstantUUIDWithBytes(
        kCFAllocatorDefault,
        0xC4, 0x83, 0xC0, 0x10, 0x8E, 0x7F, 0x45, 0x8A,
        0xA7, 0x92, 0x48, 0xC5, 0xC6, 0xC1, 0x94, 0xDA
    );
}

static NSDictionary *ZMDictionary(NSDictionary *dictionary, NSString *key) {
    id value = dictionary[key];
    return [value isKindOfClass:NSDictionary.class] ? value : @{};
}

static NSString *ZMString(NSDictionary *dictionary, NSString *key) {
    id value = dictionary[key];
    if (![value isKindOfClass:NSString.class] || [value length] == 0 || [value length] > 4096) {
        return nil;
    }
    return value;
}

static void ZMSet(CFMutableDictionaryRef attributes, NSString *key, NSString *value) {
    if (value.length > 0) {
        CFDictionarySetValue(attributes, (__bridge CFStringRef)key, (__bridge CFStringRef)value);
    }
}

static Boolean GetMetadataForFile(
    void *thisInterface,
    CFMutableDictionaryRef attributes,
    CFStringRef contentTypeUTI,
    CFStringRef pathToFile
) {
    (void)thisInterface;
    @autoreleasepool {
        if (![(__bridge NSString *)contentTypeUTI isEqualToString:ZMTzapUTI]) {
            return false;
        }
        NSString *path = (__bridge NSString *)pathToFile;
        char *raw = zmanager_public_metadata_summary_json(path.fileSystemRepresentation);
        if (raw == NULL) {
            return false;
        }
        NSData *data = [[[NSString alloc] initWithUTF8String:raw] dataUsingEncoding:NSUTF8StringEncoding];
        zmanager_public_metadata_string_free(raw);
        if (data.length == 0 || data.length > 1048576) {
            return false;
        }
        NSDictionary *root = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
        if (![root isKindOfClass:NSDictionary.class] || ![root[@"ok"] boolValue]) {
            return false;
        }
        NSDictionary *metadata = ZMDictionary(root, @"metadata");
        NSDictionary *format = ZMDictionary(metadata, @"format");
        NSDictionary *signature = ZMDictionary(root, @"signature");
        NSDictionary *rootAuth = ZMDictionary(signature, @"root_auth");
        NSString *signatureCode = ZMString(signature, @"status");
        NSString *status = [signatureCode isEqualToString:@"verified"]
            ? @"Signature verified"
            : ([signatureCode isEqualToString:@"unverified"] ? @"Signature inspected" : @"No public signature");
        NSString *signer = ZMString(rootAuth, @"subject");
        NSString *issuer = ZMString(rootAuth, @"issuer");
        NSString *encryption = ZMString(format, @"encryption_algorithm");
        NSNumber *volumeCount = [metadata[@"expected_volume_count"] isKindOfClass:NSNumber.class]
            ? metadata[@"expected_volume_count"] : nil;

        ZMSet(attributes, ZMSignatureStatus, status);
        ZMSet(attributes, ZMSigner, signer);
        ZMSet(attributes, ZMIssuer, issuer);
        ZMSet(attributes, ZMEncryption, encryption);
        if (volumeCount != nil) {
            CFDictionarySetValue(attributes, (__bridge CFStringRef)ZMVolumeCount, (__bridge CFNumberRef)volumeCount);
        }
        ZMSet(attributes, (__bridge NSString *)kMDItemSecurityMethod, status);
        ZMSet(attributes, (__bridge NSString *)kMDItemKind, @"TZAP archive");
        ZMSet(attributes, (__bridge NSString *)kMDItemDescription,
              signer.length > 0 ? [NSString stringWithFormat:@"TZAP archive signed by %@", signer] : @"TZAP archive");
        if (signer.length > 0) {
            CFDictionarySetValue(attributes, kMDItemAuthors, (__bridge CFArrayRef)@[signer]);
        }
        return true;
    }
}

static HRESULT ZMQueryInterface(void *instance, REFIID iid, LPVOID *output) {
    if (output == NULL) return E_POINTER;
    CFUUIDRef interfaceID = CFUUIDCreateFromUUIDBytes(kCFAllocatorDefault, iid);
    if (CFEqual(interfaceID, kMDImporterInterfaceID) || CFEqual(interfaceID, IUnknownUUID)) {
        ((ZMMetadataImporterPlugin *)instance)->interface->AddRef(instance);
        *output = instance;
        CFRelease(interfaceID);
        return S_OK;
    }
    *output = NULL;
    CFRelease(interfaceID);
    return E_NOINTERFACE;
}

static ULONG ZMAddRef(void *instance) {
    return ++((ZMMetadataImporterPlugin *)instance)->refCount;
}

static ULONG ZMRelease(void *instance) {
    ZMMetadataImporterPlugin *plugin = instance;
    UInt32 count = --plugin->refCount;
    if (count == 0) {
        CFPlugInRemoveInstanceForFactory(plugin->factoryID);
        CFRelease(plugin->factoryID);
        free(plugin);
    }
    return count;
}

static MDImporterInterfaceStruct ZMImporterInterface = {
    NULL, ZMQueryInterface, ZMAddRef, ZMRelease, GetMetadataForFile,
};

void *MetadataImporterPluginFactory(CFAllocatorRef allocator, CFUUIDRef typeID) {
    (void)allocator;
    if (!CFEqual(typeID, kMDImporterTypeID)) return NULL;
    ZMMetadataImporterPlugin *plugin = calloc(1, sizeof(ZMMetadataImporterPlugin));
    if (plugin == NULL) return NULL;
    plugin->interface = &ZMImporterInterface;
    plugin->factoryID = CFRetain(ZMFactoryID());
    plugin->refCount = 1;
    CFPlugInAddInstanceForFactory(plugin->factoryID);
    return plugin;
}
