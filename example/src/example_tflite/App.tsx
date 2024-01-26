// import React, {useEffect, useState} from 'react';
// import {StyleSheet} from 'react-native';
// import {
//   Camera,
//   Frame,
//   useCameraDevice,
//   useCameraPermission,
//   useFrameProcessor,
// } from 'react-native-vision-camera';
// import {TensorflowModel, loadTensorflowModel} from 'react-native-fast-tflite';
// import {useResizePlugin} from 'vision-camera-resize-plugin';
// import {useSharedValue} from 'react-native-worklets-core';

// export default function App(): React.ReactNode {
//   const {hasPermission, requestPermission} = useCameraPermission();
//   const {resize} = useResizePlugin();
//   const device = useCameraDevice('front');
//   const [model, setModel] = useState<TensorflowModel | null>(null);

//   useEffect(() => {
//     requestPermission();
//   }, [requestPermission]);

//   useEffect(() => {
//     async function _loadModel() {
//       const objModel: TensorflowModel = await loadTensorflowModel(
//         require('./assets/object_detector.tflite'),
//       );
//       setModel(objModel);
//     }
//     _loadModel();
//   }, []);

//   const sharedValue = useSharedValue('');

//   // const workletSayHello = Worklets.createRunInContextFn(sayHello);

//   const updateSharedValue = Worklets.createRunInJsFn((v: string) => {
//     sharedValue.value = v;
//   });

//   const frameProcessor = useFrameProcessor(
//     (frame: Frame) => {
//       'worklet';
//       if (model == null) {
//         return;
//       }
//       const data = resize(frame, {
//         size: {
//           width: 192,
//           height: 192,
//         },
//         pixelFormat: 'rgb-uint8',
//       });
//       const array = new Uint8Array(data);
//       sharedValue.value = btoa(String.fromCharCode(...array));
//       // console.log('base64String => ', base64String);
//       // const output = model.runSync([array] as any[]);
//       // console.log('Result: ' + output.length);

//       // const detection_boxes = output[0];
//       // const detection_classes = output[1];
//       // const detection_scores = output[2];
//       // const num_detections = output[3];
//       // // console.log(`Detected ${num_detections} objects!`);

//       // for (let i = 0; i < detection_boxes.length; i += 4) {
//       //   // const confidence = detection_scores[i / 4];
//       //   // console.log('confidence => ', confidence);
//       //   // if (confidence > 0.7) {
//       //   //   // 4. Draw a red box around the detected object!
//       //   // const left = detection_boxes[i];
//       //   // const top = detection_boxes[i + 1];
//       //   // const right = detection_boxes[i + 2];
//       //   // const bottom = detection_boxes[i + 3];
//       //   // console.log('detection_boxes => ', detection_boxes[i]);
//       //   // }
//       //   // console.log(`${detection_boxes[i] >= 0.7 ? 'TRUE' : '-'}`);
//       // }
//     },
//     [model],
//   );

//   const sayHello = () => {
//     'worklet';
//     console.log('Hello from the Worklet Thread!');
//   };

//   if (hasPermission && device != null) {
//     return (
//       <Camera
//         device={device}
//         style={StyleSheet.absoluteFill}
//         isActive={true}
//         pixelFormat={'yuv'}
//         frameProcessor={frameProcessor}
//       />
//     );
//   } else {
//     return null;
//   }
// }
