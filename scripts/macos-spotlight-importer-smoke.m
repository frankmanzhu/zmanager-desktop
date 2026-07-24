#import <CoreFoundation/CFPlugInCOM.h>
#import <CoreServices/CoreServices.h>
#import <Foundation/Foundation.h>
#import <Metadata/MDImporter.h>

static void Fail(NSString *message) {
    fprintf(stderr, "%s\n", message.UTF8String);
    exit(1);
}

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 3) {
            Fail(@"usage: macos-spotlight-importer-smoke IMPORTER_BUNDLE TZAP_FIXTURE");
        }
        NSURL *bundleURL = [NSURL fileURLWithPath:@(argv[1]) isDirectory:YES];
        CFPlugInRef plugIn = CFPlugInCreate(kCFAllocatorDefault, (__bridge CFURLRef)bundleURL);
        if (plugIn == NULL) {
            Fail(@"Could not load the packaged Spotlight importer");
        }
        CFArrayRef factories = CFPlugInFindFactoriesForPlugInTypeInPlugIn(kMDImporterTypeID, plugIn);
        if (factories == NULL || CFArrayGetCount(factories) != 1) {
            CFRelease(plugIn);
            Fail(@"Packaged Spotlight importer must expose exactly one metadata factory");
        }
        CFUUIDRef factoryID = (CFUUIDRef)CFArrayGetValueAtIndex(factories, 0);
        void *instance = CFPlugInInstanceCreate(kCFAllocatorDefault, factoryID, kMDImporterTypeID);
        if (instance == NULL) {
            CFRelease(factories);
            CFRelease(plugIn);
            Fail(@"Could not instantiate the packaged Spotlight importer");
        }
        MDImporterInterfaceStruct **interface = instance;
        NSMutableDictionary *attributes = [NSMutableDictionary dictionary];
        Boolean imported = (*interface)->ImporterImportData(
            instance,
            (__bridge CFMutableDictionaryRef)attributes,
            CFSTR("org.tzap-org.zmanager.tzap"),
            (__bridge CFStringRef)@(argv[2])
        );
        (*interface)->Release(instance);
        CFRelease(factories);
        CFRelease(plugIn);
        if (!imported) {
            Fail(@"Packaged Spotlight importer rejected the valid TZAP fixture");
        }
        if (![attributes[(__bridge NSString *)kMDItemKind] isEqualToString:@"TZAP archive"] ||
            attributes[@"com_frankmanzhu_zmanager_tzapSignatureStatus"] == nil ||
            attributes[@"com_frankmanzhu_zmanager_tzapVolumeCount"] == nil) {
            Fail(@"Packaged Spotlight importer omitted required public metadata");
        }
        NSError *error = nil;
        NSData *json = [NSJSONSerialization dataWithJSONObject:attributes
                                                       options:NSJSONWritingSortedKeys
                                                         error:&error];
        if (json == nil) {
            Fail([NSString stringWithFormat:@"Could not serialize imported attributes: %@", error]);
        }
        fwrite(json.bytes, 1, json.length, stdout);
        fputc('\n', stdout);
    }
    return 0;
}
