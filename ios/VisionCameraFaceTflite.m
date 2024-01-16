#if __has_include(<VisionCamera/FrameProcessorPlugin.h>)
#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

#import "VisionCameraFaceTflite-Swift.h"

@interface VisionCameraFaceTflitePlugin (FrameProcessorPluginLoader)
@end

@implementation VisionCameraFaceTflitePlugin (FrameProcessorPluginLoader)

+ (void)load
{
  [FrameProcessorPluginRegistry addFrameProcessorPlugin:@"scanFace"
                                        withInitializer:^FrameProcessorPlugin* _Nonnull(VisionCameraProxyHolder* _Nonnull proxy,         
                                                                                        NSDictionary* _Nullable options) {               
                                          return [[VisionCameraFaceTflitePlugin alloc] initWithProxy:proxy withOptions:options];
                                        }];
}                                                                                                                                        
                                                                                                                                         
@end

#endif