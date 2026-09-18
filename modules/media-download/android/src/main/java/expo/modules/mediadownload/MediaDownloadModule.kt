package expo.modules.mediadownload

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MediaDownloadModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("MediaDownload")

    // Exposed to JS as MediaDownload.isSupported. MediaStore Downloads is API 29+.
    Constants(
      "isSupported" to (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q)
    )

    // Writes base64 data to the public Downloads folder with no storage permission.
    // Runs off the JS thread automatically (AsyncFunction default queue).
    AsyncFunction("saveToDownloads") { base64: String, fileName: String, mimeType: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        throw IllegalStateException("MediaStore Downloads requires Android 10 (API 29) or newer")
      }

      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val resolver = context.contentResolver
      val bytes = Base64.decode(base64, Base64.DEFAULT)

      val values = ContentValues().apply {
        put(MediaStore.Downloads.DISPLAY_NAME, fileName)
        put(MediaStore.Downloads.MIME_TYPE, mimeType)
        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        put(MediaStore.Downloads.IS_PENDING, 1)
      }

      val collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
      val itemUri = resolver.insert(collection, values)
        ?: throw IllegalStateException("Could not create an entry in Downloads")

      try {
        resolver.openOutputStream(itemUri).use { stream ->
          (stream ?: throw IllegalStateException("Could not open Downloads output stream"))
            .write(bytes)
        }
      } catch (e: Exception) {
        // Roll back the pending, empty MediaStore row so we don't leave a stub file.
        resolver.delete(itemUri, null, null)
        throw e
      }

      values.clear()
      values.put(MediaStore.Downloads.IS_PENDING, 0)
      resolver.update(itemUri, values, null, null)

      return@AsyncFunction fileName
    }
  }
}
