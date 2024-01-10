#if __has_include(<VisionCamera/FrameProcessorPlugin.h>)
#import <VisionCamera/FrameProcessorPlugin.h>
#import <VisionCamera/FrameProcessorPluginRegistry.h>

#import "VisionCameraFaceTflite-Swift.h"

// VISION_EXPORT_SWIFT_FRAME_PROCESSOR(VisionCameraFaceTflite, scanFace)

@interface VisionCameraFaceTflite (FrameProcessorPluginLoader)
@end

@implementation VisionCameraFaceTflite (FrameProcessorPluginLoader)

+ (void)load
{
  [FrameProcessorPluginRegistry addFrameProcessorPlugin:@"scanFace"
                                        withInitializer:^FrameProcessorPlugin*(NSDictionary* options) {
    return [[VisionCameraFaceTflite alloc] initWithOptions:options];
  }];
}

@end

#endif
