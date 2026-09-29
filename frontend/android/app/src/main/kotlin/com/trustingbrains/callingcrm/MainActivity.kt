package com.trustingbrains.callingcrm

import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.trustingbrains.callingcrm/whatsapp_share"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "shareImageToWhatsApp") {
                val imageUrl = call.argument<String>("imageUrl") ?: ""
                val message = call.argument<String>("message") ?: ""
                val phone = call.argument<String>("phone") ?: ""

                if (imageUrl.isNotEmpty()) {
                    val path = Uri.parse(imageUrl).path.orEmpty()
                    val isPdf = path.endsWith(".pdf", ignoreCase = true)
                    val mimeType = if (isPdf) "application/pdf" else if (path.endsWith(".png", ignoreCase = true)) "image/png" else "image/jpeg"
                    shareFileToWhatsApp(imageUrl, message, phone, mimeType, result)
                } else if (message.isNotEmpty()) {
                    shareTextToWhatsApp(message, phone)
                    result.success("Message shared to WhatsApp")
                } else {
                    result.error("NO_DATA", "No image or message provided", null)
                }
            } else {
                result.notImplemented()
            }
        }
    }

    private fun isPackageInstalled(pkgName: String): Boolean {
        return try {
            packageManager.getPackageInfo(pkgName, 0)
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun getPrimaryWhatsAppPackage(): String? {
        return when {
            isPackageInstalled("com.whatsapp") -> "com.whatsapp"
            isPackageInstalled("com.whatsapp.w4b") -> "com.whatsapp.w4b"
            else -> null
        }
    }

    private fun shareTextToWhatsApp(message: String, phone: String) {
        var formattedPhone = phone.replace("+", "").replace(" ", "").replace("-", "")
        if (formattedPhone.length == 10) {
            formattedPhone = "91$formattedPhone"
        }

        val whatsappUri = if (formattedPhone.isNotEmpty()) {
            Uri.parse("whatsapp://send?phone=$formattedPhone&text=${Uri.encode(message)}")
        } else {
            Uri.parse("whatsapp://send?text=${Uri.encode(message)}")
        }

        val intent = Intent(Intent.ACTION_VIEW, whatsappUri).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

        val targetPackage = getPrimaryWhatsAppPackage()
        if (targetPackage != null) {
            intent.setPackage(targetPackage)
        }

        try {
            startActivity(intent)
        } catch (e: Exception) {
            try {
                intent.setPackage(null)
                startActivity(intent)
            } catch (e2: Exception) {
                try {
                    val webUrl = if (formattedPhone.isNotEmpty()) {
                        "https://api.whatsapp.com/send?phone=$formattedPhone&text=${Uri.encode(message)}"
                    } else {
                        "https://api.whatsapp.com/send?text=${Uri.encode(message)}"
                    }
                    val fallbackIntent = Intent(Intent.ACTION_VIEW, Uri.parse(webUrl)).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(fallbackIntent)
                } catch (ex: Exception) {
                    ex.printStackTrace()
                }
            }
        }
    }

    private fun shareFileToWhatsApp(fileUrl: String, message: String, phone: String, mimeType: String, result: MethodChannel.Result) {
        Thread {
            try {
                // Clipboard copy for fallback/convenience (WhatsApp lacks PDF caption support)
                if (message.isNotEmpty()) {
                    try {
                        val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as? android.content.ClipboardManager
                        if (clipboard != null) {
                            val clip = ClipData.newPlainText("Template Message", message)
                            clipboard.setPrimaryClip(clip)
                        }
                    } catch (_: Exception) {}
                }

                val url = URL(fileUrl)
                val connection = url.openConnection() as HttpURLConnection
                connection.connectTimeout = 15000
                connection.readTimeout = 20000
                connection.instanceFollowRedirects = true
                connection.connect()

                val responseCode = connection.responseCode
                if (responseCode !in 200..299) {
                    throw IOException("Server returned HTTP $responseCode for $fileUrl")
                }

                val ext = when {
                    mimeType == "application/pdf" || fileUrl.contains(".pdf", ignoreCase = true) -> ".pdf"
                    fileUrl.contains(".png", ignoreCase = true) -> ".png"
                    fileUrl.contains(".webp", ignoreCase = true) -> ".webp"
                    else -> ".jpg"
                }

                try {
                    cacheDir.listFiles()?.forEach { oldFile ->
                        if (oldFile.name.startsWith("template_")) {
                            oldFile.delete()
                        }
                    }
                } catch (_: Exception) {}

                val fileName = "template_${System.currentTimeMillis()}$ext"
                val file = File(cacheDir, fileName)

                connection.inputStream.use { input ->
                    FileOutputStream(file).use { output ->
                        input.copyTo(output)
                        output.flush()
                    }
                }

                val uri: Uri = FileProvider.getUriForFile(
                    applicationContext,
                    "${applicationContext.packageName}.fileprovider",
                    file
                )

                var formattedPhone = phone.replace("+", "").replace(" ", "").replace("-", "")
                if (formattedPhone.length == 10) {
                    formattedPhone = "91$formattedPhone"
                }

                val intent = Intent(Intent.ACTION_SEND).apply {
                    type = mimeType
                    putExtra(Intent.EXTRA_STREAM, uri)
                    if (message.isNotEmpty()) {
                        putExtra(Intent.EXTRA_TEXT, message)
                    }
                    if (formattedPhone.isNotEmpty()) {
                        putExtra("jid", "$formattedPhone@s.whatsapp.net")
                    }
                    clipData = ClipData.newRawUri("template_attachment", uri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }

                val packagesToGrant = listOf("com.whatsapp", "com.whatsapp.w4b")
                for (pkg in packagesToGrant) {
                    try {
                        applicationContext.grantUriPermission(
                            pkg,
                            uri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                        )
                    } catch (_: Exception) {}
                }

                val primaryPackage = getPrimaryWhatsAppPackage()
                if (primaryPackage != null) {
                    intent.setPackage(primaryPackage)
                }

                runOnUiThread {
                    try {
                        startActivity(intent)
                        result.success("File shared to WhatsApp")
                    } catch (e: Exception) {
                        try {
                            val altPackage = if (primaryPackage == "com.whatsapp") "com.whatsapp.w4b" else "com.whatsapp"
                            intent.setPackage(altPackage)
                            startActivity(intent)
                            result.success("File shared to WhatsApp")
                        } catch (e2: Exception) {
                            try {
                                intent.setPackage(null)
                                startActivity(intent)
                                result.success("File shared to WhatsApp")
                            } catch (e3: Exception) {
                                try {
                                    val chooser = Intent.createChooser(intent, "Share via")
                                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                    startActivity(chooser)
                                    result.success("File shared via chooser")
                                } catch (ex: Exception) {
                                    result.error("SHARE_FAILED", "Failed to launch share: ${ex.message}", null)
                                }
                            }
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                runOnUiThread {
                    result.error("DOWNLOAD_FAILED", "Failed to download file: ${e.message}", null)
                }
            }
        }.start()
    }
}