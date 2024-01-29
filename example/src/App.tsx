import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Camera,
  useFrameProcessor,
  type Frame,
  CameraRuntimeError,
  useCameraFormat,
  useCameraDevice,
  type PhotoFile,
} from 'react-native-vision-camera';
import {
  scanFaces,
  // type FaceType,
  // initTensor,
  tensorBase64,
  type FaceBoundType,
  type FaceType,
} from 'vision-camera-face-tflite';
import Animated, {
  useSharedValue as useSharedValueR,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Worklets, useSharedValue } from 'react-native-worklets-core';
import { launchImageLibrary } from 'react-native-image-picker';
import { useResizePlugin } from 'vision-camera-resize-plugin';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { getPermissionReadStorage } from './permission';
import { Button, Text } from 'react-native-paper';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const screenAspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;
const enableHdr = false;
const enableNightMode = false;
const targetFps = 30;

export default function App() {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [arrayTensor, setArrayTensor] = useState<number[]>([]);
  const [dataCamera, setDataCamera] = useState<string | null>(null);

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
  const { resize } = useResizePlugin();
  // const faceString = useSharedValue<string>('');
  const rectWidth = useSharedValue(100); // rect width
  const rectHeight = useSharedValue(100); // rect height
  const rectX = useSharedValue(100); // rect x position
  const rectY = useSharedValue(100); // rect y position
  const rectWidthR = useSharedValueR(100); // rect width
  const rectHeightR = useSharedValueR(100); // rect height
  const rectXR = useSharedValueR(0); // rect x position
  const rectYR = useSharedValueR(0); // rect y position
  // const {model} =
  // require('./assets/object_detector.tflite')
  const objectDetection = useTensorflowModel(
    require('./assets/object_detector.tflite')
  );
  const model =
    objectDetection.state === 'loaded' ? objectDetection.model : undefined;

  const updateRect = Worklets.createRunInJsFn((frame: any) => {
    rectWidthR.value = frame.width;
    rectHeightR.value = frame.height;
    rectXR.value = frame.x;
    rectYR.value = frame.y;
  });
  // const updateFace = Worklets.createRunInJsFn((array: Uint8Array) => {
  //   faceString.value = image;
  // });

  const frameProcessor = useFrameProcessor(
    (frame: Frame) => {
      'worklet';
      const start = performance.now();
      const dataFace: FaceType = scanFaces(frame);
      // console.log('dataFace => ', dataFace);
      // NOTE: handle face detection
      if (dataFace) {
        if (dataFace.bounds && model) {
          const { width: frameWidth, height: frameHeight } = frame;
          const xFactor = SCREEN_WIDTH / frameWidth;
          const yFactor = SCREEN_HEIGHT / frameHeight;
          const bounds: FaceBoundType = dataFace.bounds;
          rectWidth.value = bounds.width * xFactor;
          rectHeight.value = bounds.height * yFactor;
          rectX.value = bounds.x * xFactor;
          rectY.value = bounds.y * yFactor;
          updateRect({
            width: rectWidth.value,
            height: rectHeight.value,
            x: rectX.value,
            y: rectY.value,
          });
          // NOTE: handle resize frame
          const data = resize(frame, {
            size: {
              x: rectX.value,
              y: rectY.value,
              width: 112,
              height: 112,
            },
            pixelFormat: 'rgb',
            dataType: 'uint8',
          });
          const array: Uint8Array = new Uint8Array(data);
          const output = model.runSync([array] as any[]);
          console.log('Result: ', output.length);
          const end = performance.now();
          console.log(`Performance: ${end - start}ms`);
        }
      }
    },
    [model]
  );

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
    // initTensor('mobile_face_net', 1)
    //   .then((response) => console.log(response))
    //   .catch((error) => console.log(error));
    _getPermission();
  }, []);

  const onError = useCallback((error: CameraRuntimeError) => {
    console.error(error);
  }, []);

  const onInitialized = useCallback(() => {
    console.log('Camera initialized!');
  }, []);

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

  const _onPressTake = async () => {
    if (camera.current && !dataCamera) {
      const data: PhotoFile = await camera.current.takePhoto({
        flash: 'off',
        qualityPrioritization: 'speed',
      });
      setDataCamera(`file:///${data.path}`);
    }
  };

  if (dataCamera) {
    return (
      <SafeAreaView style={styles.container}>
        <Image
          style={styles.imgPreview}
          source={{ uri: dataCamera }}
          resizeMode={'contain'}
        />
        <Button style={styles.btnClose} onPress={() => setDataCamera(null)}>
          Remove
        </Button>
      </SafeAreaView>
    );
  } else if (device != null && format != null && hasPermission) {
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
          photo={true}
          video={false}
          audio={false}
          frameProcessor={frameProcessor}
        />
        <Animated.View style={faceAnimStyle} />
        <View style={styles.wrapBottom}>
          <Button onPress={_onOpenImage}>Open Image</Button>
          <Button onPress={_onPressTake}>Take Photo</Button>
          <Button onPress={() => setArrayTensor([])}>Clear Data</Button>
        </View>
        <ScrollView>
          <Text style={styles.textResult}>{`Result: ${JSON.stringify(
            arrayTensor
          )}`}</Text>
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
  textResult: {
    color: 'black',
    marginHorizontal: 8,
  },
  wrapBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
  },
  imgPreview: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: 'absolute',
  },
  btnClose: {},
});

// Uint8Array --> Base64
// btoa(String.fromCharCode.apply(null,new Uint8Array([1,2,3,255])))

// Base64 --> Uint8Array
// new Uint8Array([...atob('AQID/w==')].map(c=>c.charCodeAt()))
