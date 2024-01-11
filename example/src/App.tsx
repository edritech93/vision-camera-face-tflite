import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  Button,
  Dimensions,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
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
  type FaceType,
  initTensor,
  tensorBase64,
} from 'vision-camera-face-tflite';
import { launchImageLibrary } from 'react-native-image-picker';
import { getPermissionReadStorage } from './permission';
import { Worklets } from 'react-native-worklets-core';
import { View } from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Platform.select<number>({
  android: Dimensions.get('screen').height - 60,
  ios: Dimensions.get('window').height,
}) as number;
const screenAspectRatio = SCREEN_HEIGHT / SCREEN_WIDTH;
const enableHdr = false;
const enableNightMode = false;
const targetFps = 30;

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);
  const [faces, setFaces] = useState<FaceType[]>([]);
  const [arrayTensor, setArrayTensor] = useState<number[]>([]);

  const camera = useRef<Camera>(null);
  const setFacesJS = Worklets.createRunInJsFn(setFaces);
  const device = useCameraDevice('front', {
    physicalDevices: [
      'ultra-wide-angle-camera',
      'wide-angle-camera',
      'telephoto-camera',
    ],
  });
  const format = useCameraFormat(device, [
    { fps: targetFps },
    { videoAspectRatio: screenAspectRatio },
    { videoResolution: 'max' },
    { photoAspectRatio: screenAspectRatio },
    { photoResolution: 'max' },
  ]);
  const fps = Math.min(format?.maxFps ?? 1, targetFps);

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
    initTensor('mobile_face_net', 1)
      .then((response) => console.log(response))
      .catch((error) => console.log(error));
  }, []);

  const frameProcessor = useFrameProcessor((frame: Frame) => {
    'worklet';
    const scannedFaces = scanFaces(frame);
    if (scannedFaces) {
      setFacesJS(scannedFaces);
    }
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
          {faces && faces.length > 0 && (
            <Animated.Image
              source={{ uri: `data:image/png;base64,${faces[0]?.imageResult}` }}
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
