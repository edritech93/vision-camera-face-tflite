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
import com.mrousavy.camera.frameprocessor.VisionCameraProxy
import com.mrousavy.camera.types.Orientation
import kotlin.math.ceil

class VisionCameraFaceTflitePlugin(proxy: VisionCameraProxy, options: Map<String, Any>?) :
  FrameProcessorPlugin() {
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
      val mediaImage = frame.image
      val image = InputImage.fromMediaImage(mediaImage, Orientation.PORTRAIT.toDegrees())
      val task = faceDetector.process(image)
      val faces = Tasks.await(task)
      if (faces.size > 0) {
        val map: MutableMap<String, Any> = HashMap()
        val face = faces[0]
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
        val imageResult: String = Convert().getBase64Image(bmpFrameResult).toString()

        map["rollAngle"] =
          face.headEulerAngleZ.toDouble()
        map["pitchAngle"] =
          face.headEulerAngleX.toDouble()
        map["yawAngle"] = face.headEulerAngleY.toDouble()
        map["leftEyeOpenProbability"] = face.leftEyeOpenProbability!!.toDouble()
        map["rightEyeOpenProbability"] = face.rightEyeOpenProbability!!.toDouble()
        map["smilingProbability"] = face.smilingProbability!!.toDouble()

//        val contours = processFaceContours(face);
        val bounds = processBoundingBox(face.boundingBox)
        map["bounds"] = bounds
//        map["contours"] = contours
        map["imageResult"] = imageResult
        return map
      }
      return null
    } catch (e: Exception) {
      e.printStackTrace()
      return null
    }
  }
}
