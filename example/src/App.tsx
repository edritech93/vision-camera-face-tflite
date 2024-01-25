import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Button,
  Dimensions,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Camera,
  useFrameProcessor,
  type Frame,
  CameraRuntimeError,
  useCameraFormat,
  useCameraDevice,
} from 'react-native-vision-camera';
import {
  scanFaces,
  // type FaceType,
  // initTensor,
  tensorBase64,
  type FaceBoundType,
  type FaceType,
} from 'vision-camera-face-tflite';
import { launchImageLibrary } from 'react-native-image-picker';
// import { useResizePlugin } from 'vision-camera-resize-plugin';
import { getPermissionReadStorage } from './permission';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import Animated, {
  useSharedValue as useSharedValueR,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const screenAspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;
const enableHdr = false;
const enableNightMode = false;
const targetFps = 30;

export default function App() {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [arrayTensor, setArrayTensor] = useState<number[]>([]);

  const camera = useRef<Camera>(null);
  const device = useCameraDevice('front', {
    physicalDevices: [
      'ultra-wide-angle-camera',
      'wide-angle-camera',
      'telephoto-camera',
    ],
  });
  const format = useCameraFormat(device, [
    { fps: targetFps },
    { photoAspectRatio: screenAspectRatio },
    { photoResolution: 'max' },
  ]);
  const fps = Math.min(format?.maxFps ?? 1, targetFps);
  // const { resize } = useResizePlugin();
  const faceString = useSharedValue<string>('');
  const rectWidth = useSharedValue(100); // rect width
  const rectHeight = useSharedValue(100); // rect height
  const rectX = useSharedValue(100); // rect x position
  const rectY = useSharedValue(100); // rect y position

  const rectWidthR = useSharedValueR(100); // rect width
  const rectHeightR = useSharedValueR(100); // rect height
  const rectXR = useSharedValueR(100); // rect x position
  const rectYR = useSharedValueR(100); // rect y position

  const updateRect = Worklets.createRunInJsFn((frame: any) => {
    rectWidthR.value = frame.width;
    rectHeightR.value = frame.height;
    rectXR.value = frame.x;
    rectYR.value = frame.y;
  });
  // const updateFace = Worklets.createRunInJsFn((image: string) => {
  //   faceString.value = image;
  // });

  const frameProcessor = useFrameProcessor((frame: Frame) => {
    'worklet';
    const dataFace: FaceType = scanFaces(frame);
    if (dataFace) {
      if (dataFace.bounds) {
        const { width: frameWidth, height: frameHeight } = frame;
        const xFactor = SCREEN_WIDTH / frameWidth;
        const yFactor = SCREEN_HEIGHT / frameHeight;
        const bounds: FaceBoundType = dataFace.bounds;
        rectWidth.value = bounds.width * xFactor;
        rectHeight.value = bounds.height * yFactor;
        rectX.value = bounds.boundingCenterX * xFactor;
        rectY.value = bounds.boundingCenterY * yFactor;
        updateRect({
          width: rectWidth.value,
          height: rectHeight.value,
          x: rectX.value,
          y: rectY.value,
        });
      }
      // updateFace(dataFace.imageResult);
    }
  }, []);

  const faceAnimStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      backgroundColor: 'red',
      width: withSpring(rectWidthR.value),
      height: withSpring(rectHeightR.value),
      transform: [
        { translateX: withSpring(rectXR.value) },
        { translateY: withSpring(rectYR.value) },
      ],
    };
  });

  useEffect(() => {
    async function _getPermission() {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    }
    _getPermission();
  }, []);

  const onError = useCallback((error: CameraRuntimeError) => {
    console.error(error);
  }, []);

  const onInitialized = useCallback(() => {
    console.log('Camera initialized!');
    // initTensor('mobile_face_net', 1)
    //   .then((response) => console.log(response))
    //   .catch((error) => console.log(error));
  }, []);

  // const frameProcessor = useFrameProcessor((frame: Frame) => {
  //   'worklet';
  //   const start = performance.now();
  //   const dataFace = scanFaces(frame);
  //   // console.log('dataFace => ', dataFace);
  //   if (dataFace.length > 0) {
  //     const firstFace = dataFace[0];
  //     if (firstFace && firstFace.bounds) {
  //       const { x, y, height, width } = firstFace.bounds;
  //       point.value = {
  //         // x: 0,
  //         // y: 0,
  //         height: height,
  //         width: width,
  //       };
  //     }
  //   }
  //   const data = resize(frame, {
  //     size: {
  //       width: 192,
  //       height: 192,
  //     },
  //     pixelFormat: 'rgb-uint8',
  //   });
  //   const array = new Uint8Array(data);
  //   const end = performance.now();
  //   console.log(`Performance: ${end - start}ms`);
  // }, []);

  const _onOpenImage = async () => {
    await getPermissionReadStorage().catch((error: Error) => {
      console.log(error);
      return;
    });
    const result = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
    });
    if (
      result &&
      result.assets &&
      result.assets.length > 0 &&
      result.assets[0]?.uri
    ) {
      tensorBase64(result.assets[0].base64 || '')
        .then((response) => {
          const objRes: number[] =
            Platform.OS === 'android' ? JSON.parse(response) : response;
          const arrayRes: number[] = objRes.map((e: number) => {
            const stringFixed: string = e.toFixed(5);
            return parseFloat(stringFixed);
          });
          setArrayTensor(arrayRes);
        })
        .catch((error) => console.log('error tensorImage =>', error));
    }
  };

  console.log(faceString.value);

  if (device != null && format != null && hasPermission) {
    // console.log(
    //   `Device: "${device.name}" (${format.photoWidth}x${format.photoHeight} photo / ${format.videoWidth}x${format.videoHeight} video @ ${fps}fps)`
    // );
    const pixelFormat = format.pixelFormats.includes('yuv') ? 'yuv' : 'native';
    return (
      <SafeAreaView style={styles.container}>
        <Camera
          ref={camera}
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          fps={fps}
          photoHdr={enableHdr}
          lowLightBoost={device.supportsLowLightBoost && enableNightMode}
          isActive={true}
          onInitialized={onInitialized}
          onError={onError}
          enableZoomGesture={false}
          enableFpsGraph={false}
          orientation={'portrait'}
          pixelFormat={pixelFormat}
          photo={false}
          video={false}
          audio={false}
          frameProcessor={frameProcessor}
        />
        <Animated.View style={faceAnimStyle} />
        <View style={styles.wrapBottom}>
          <Button title={'Open Image'} onPress={_onOpenImage} />
          <Button
            title={'Clear Data'}
            color={'red'}
            onPress={() => setArrayTensor([])}
          />
        </View>
        <ScrollView>
          <Text style={styles.textResult}>{`Result: ${JSON.stringify(
            arrayTensor
          )}`}</Text>
          {faceString?.value && (
            <Animated.Image
              source={{ uri: `data:image/png;base64,${faceString.value}` }}
              style={styles.imageFace}
            />
          )}
        </ScrollView>
      </SafeAreaView>
    );
  } else {
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  imageFace: {
    height: 150,
    width: 150,
    margin: 16,
  },
  textResult: {
    color: 'black',
    marginHorizontal: 8,
  },
  wrapBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
});
