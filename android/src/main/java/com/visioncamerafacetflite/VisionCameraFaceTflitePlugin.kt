package com.visioncamerafacetflite

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.RectF
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.common.internal.ImageConvertUtils
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceContour
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import com.mrousavy.camera.frameprocessor.Frame
import com.mrousavy.camera.frameprocessor.FrameProcessorPlugin
import kotlin.math.ceil

class VisionCameraFaceTflitePlugin(options: Map<String, Any>?) : FrameProcessorPlugin(
  options
) {
  private var faceDetectorOptions = FaceDetectorOptions.Builder()
    .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
    .setContourMode(FaceDetectorOptions.CONTOUR_MODE_NONE)
    .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
    .setMinFaceSize(0.15f)
    .build()

  private var faceDetector = FaceDetection.getClient(faceDetectorOptions)

  private fun processBoundingBox(boundingBox: Rect): MutableMap<String, Any> {
    val bounds: MutableMap<String, Any> = HashMap()
    // Calculate offset (we need to center the overlay on the target)
    val offsetX = (boundingBox.exactCenterX() - ceil(boundingBox.width().toDouble())) / 2.0f
    val offsetY = (boundingBox.exactCenterY() - ceil(boundingBox.height().toDouble())) / 2.0f
    val x = boundingBox.right + offsetX
    val y = boundingBox.top + offsetY
    bounds["x"] = boundingBox.centerX() + (boundingBox.centerX() - x)
    bounds["y"] = boundingBox.centerY() + (y - boundingBox.centerY())
    bounds["width"] = boundingBox.width().toDouble()
    bounds["height"] = boundingBox.height().toDouble()
    bounds["boundingCenterX"] = boundingBox.centerX().toDouble()
    bounds["boundingCenterY"] = boundingBox.centerY().toDouble()
    bounds["boundingExactCenterX"] = boundingBox.exactCenterX().toDouble()
    bounds["boundingExactCenterY"] = boundingBox.exactCenterY().toDouble()
    return bounds
  }

  private fun processFaceContours(face: Face): MutableMap<String, Any> {
    // All faceContours
    val faceContoursTypes = intArrayOf(
      FaceContour.FACE,
      FaceContour.LEFT_EYEBROW_TOP,
      FaceContour.LEFT_EYEBROW_BOTTOM,
      FaceContour.RIGHT_EYEBROW_TOP,
      FaceContour.RIGHT_EYEBROW_BOTTOM,
      FaceContour.LEFT_EYE,
      FaceContour.RIGHT_EYE,
      FaceContour.UPPER_LIP_TOP,
      FaceContour.UPPER_LIP_BOTTOM,
      FaceContour.LOWER_LIP_TOP,
      FaceContour.LOWER_LIP_BOTTOM,
      FaceContour.NOSE_BRIDGE,
      FaceContour.NOSE_BOTTOM,
      FaceContour.LEFT_CHEEK,
      FaceContour.RIGHT_CHEEK
    )
    val faceContoursTypesStrings = arrayOf(
      "FACE",
      "LEFT_EYEBROW_TOP",
      "LEFT_EYEBROW_BOTTOM",
      "RIGHT_EYEBROW_TOP",
      "RIGHT_EYEBROW_BOTTOM",
      "LEFT_EYE",
      "RIGHT_EYE",
      "UPPER_LIP_TOP",
      "UPPER_LIP_BOTTOM",
      "LOWER_LIP_TOP",
      "LOWER_LIP_BOTTOM",
      "NOSE_BRIDGE",
      "NOSE_BOTTOM",
      "LEFT_CHEEK",
      "RIGHT_CHEEK"
    )
    val faceContoursTypesMap: MutableMap<String, Any> = HashMap()
    for (i in faceContoursTypesStrings.indices) {
      val contour = face.getContour(faceContoursTypes[i])
      val points = contour!!.points
      val pointsArray: MutableCollection<Any> = ArrayList()
      for (j in points.indices) {
        val currentPointsMap: MutableMap<String, Any> = HashMap()
        currentPointsMap["x"] = points[j].x.toDouble()
        currentPointsMap["y"] = points[j].y.toDouble()
        pointsArray.add(currentPointsMap)
      }
      faceContoursTypesMap[faceContoursTypesStrings[contour.faceContourType - 1]] = pointsArray
    }
    return faceContoursTypesMap
  }

  override fun callback(frame: Frame, params: Map<String, Any>?): Any? {
    try {
      val image = InputImage.fromMediaImage(frame.image, Convert().getRotation(frame))
      val task = faceDetector.process(image)
      val faces = Tasks.await(task)
//      val array = ArrayList<Any>()
//      for (face in faces) {
//        val map: WritableMap = WritableNativeMap()
//        val bmpFrameResult = ImageConvertUtils.getInstance().getUpRightBitmap(image)
//        val bmpFaceResult = Bitmap.createBitmap(
//          Constant.TF_OD_API_INPUT_SIZE,
//          Constant.TF_OD_API_INPUT_SIZE,
//          Bitmap.Config.ARGB_8888
//        )
//        val faceBB = RectF(face.boundingBox)
//        val cvFace = Canvas(bmpFaceResult)
//        val sx = Constant.TF_OD_API_INPUT_SIZE.toFloat() / faceBB.width()
//        val sy = Constant.TF_OD_API_INPUT_SIZE.toFloat() / faceBB.height()
//        val matrix = Matrix()
//        matrix.postTranslate(-faceBB.left, -faceBB.top)
//        matrix.postScale(sx, sy)
//        cvFace.drawBitmap(bmpFrameResult, matrix, null)
//        val imageResult: String = Convert().getBase64Image(bmpFaceResult).toString()
//        map.putDouble("rollAngle", face.headEulerAngleZ.toDouble())
//        map.putDouble("pitchAngle", face.headEulerAngleX.toDouble())
//        map.putDouble("yawAngle", face.headEulerAngleY.toDouble())
//        map.putDouble("leftEyeOpenProbability", face.leftEyeOpenProbability!!.toDouble())
//        map.putDouble("rightEyeOpenProbability", face.rightEyeOpenProbability!!.toDouble())
//        map.putDouble("smilingProbability", face.smilingProbability!!.toDouble())
////        val contours: MutableMap<String, Any> = processFaceContours(face);
//        val bounds = processBoundingBox(face.boundingBox)
//        map.putMap("bounds", bounds)
////        map.putMap("contours", contours)
//        map.putString("imageResult", imageResult)
//        array.add(map);
//      }
//      return array

      val array: MutableCollection<Any> = ArrayList()
//      val array = ArrayList<Any>()
      for (face in faces) {
        val map: MutableMap<String, Any> = HashMap()
        val bmpFrameResult = ImageConvertUtils.getInstance().getUpRightBitmap(image)
        val bmpFaceResult = Bitmap.createBitmap(
          Constant.TF_OD_API_INPUT_SIZE,
          Constant.TF_OD_API_INPUT_SIZE,
          Bitmap.Config.ARGB_8888
        )
        val faceBB = RectF(face.boundingBox)
        val cvFace = Canvas(bmpFaceResult)
        val sx = Constant.TF_OD_API_INPUT_SIZE.toFloat() / faceBB.width()
        val sy = Constant.TF_OD_API_INPUT_SIZE.toFloat() / faceBB.height()
        val matrix = Matrix()
        matrix.postTranslate(-faceBB.left, -faceBB.top)
        matrix.postScale(sx, sy)
        cvFace.drawBitmap(bmpFrameResult, matrix, null)
        val imageResult: String = Convert().getBase64Image(bmpFaceResult).toString()

        map["name"] = "Yudi"
        map["rollAngle"] =
          face.headEulerAngleZ.toDouble()  // Head is rotated to the left rotZ degrees
        map["pitchAngle"] =
          face.headEulerAngleX.toDouble() // Head is rotated to the right rotX degrees
        map["yawAngle"] = face.headEulerAngleY.toDouble()   // Head is tilted sideways rotY degrees
        map["leftEyeOpenProbability"] = face.leftEyeOpenProbability!!.toDouble()
        map["rightEyeOpenProbability"] = face.rightEyeOpenProbability!!.toDouble()
        map["smilingProbability"] = face.smilingProbability!!.toDouble()

//        val contours: MutableMap<String, Any> = processFaceContours(face);
        val bounds = processBoundingBox(face.boundingBox)
        map["bounds"] = bounds
//        map["contours"] = contours
        map["imageResult"] = imageResult
        array.add(map)
      }
//      val result = hashMapOf<String, Any>()
//      result["data"] = array
//      return hashMapOf("result" to array)
//      val cars = ArrayList<String>()
//      cars.toString()

      return array
    } catch (e: Exception) {
      e.printStackTrace().toString()
      return null
    }
  }
}
