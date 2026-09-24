package com.trustingbrains.callingcrm

import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileOutputStream
import java.net.URL

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.trustingbrains.callingcrm/whatsapp_share" // ✅ Match with Flutter side

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler {
                call,
                result ->
            if (call.method == "shareImageToWhatsApp") {
                val imageUrl = call.argument<String>("imageUrl") ?: ""
                val message = call.argument<String>("message") ?: ""
                val phone = call.argument<String>("phone") ?: ""

                if (imageUrl.isNotEmpty()) {
                    // Image URL is provided
                    if (imageUrl.endsWith(".pdf")) {
                        shareFileToWhatsApp(imageUrl, message, phone, "application/pdf")
                    } else {
                        shareFileToWhatsApp(imageUrl, message, phone, "image/*")
                    }
                    result.success("File shared to WhatsApp")
                } else if (message.isNotEmpty()) {
                    // Only message to send
                    shareTextToWhatsApp(message, phone)
                    result.success("Message shared to WhatsApp")
                } else {
                    result.error("NO_DATA", "No image or message provided", null)
                }
            }
        }
    }

    private fun shareTextToWhatsApp(message: String, phone: String) {
        var formattedPhone = phone.replace("+", "").replace(" ", "").replace("-", "")
        if (formattedPhone.length == 10) {
            formattedPhone = "91$formattedPhone"
        }

        val url = "https://api.whatsapp.com/send?phone=$formattedPhone&text=${Uri.encode(message)}"
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        intent.setPackage("com.whatsapp.w4b")
        
        try {
            startActivity(intent)
        } catch (e: Exception) {
            intent.setPackage("com.whatsapp")
            try {
                startActivity(intent)
            } catch (ex: Exception) {
                ex.printStackTrace()
            }
        }
    }

    private fun shareFileToWhatsApp(fileUrl: String, message: String, phone: String, mimeType: String) {
        Thread {
                    try {
                        val input = URL(fileUrl).openStream()
                        val fileName =
                                if (mimeType == "application/pdf") "shared_file.pdf"
                                else "shared_image.jpg"
                        val file = File(cacheDir, fileName)
                        val output = FileOutputStream(file)
                        input.copyTo(output)
                        output.close()
                        input.close()

                        val uri: Uri =
                                FileProvider.getUriForFile(this, "$packageName.fileprovider", file)

                        val intent = Intent(Intent.ACTION_SEND)
                        intent.type = mimeType
                        intent.putExtra(Intent.EXTRA_STREAM, uri)
                        if (message.isNotEmpty()) {
                            intent.putExtra(Intent.EXTRA_TEXT, message)
                        }
        if (phone.isNotEmpty()) {
            var formattedPhone = phone.replace("+", "").replace(" ", "").replace("-", "")
            if (formattedPhone.length == 10) {
                formattedPhone = "91$formattedPhone"
            }
            intent.putExtra("jid", "$formattedPhone@s.whatsapp.net")
        }
                        intent.setPackage("com.whatsapp.w4b")
                        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

                        // Start activity on main thread
                        runOnUiThread { 
                            try {
                                startActivity(intent)
                            } catch (e: Exception) {
                                intent.setPackage("com.whatsapp")
                                try {
                                    startActivity(intent)
                                } catch (ex: Exception) {
                                    ex.printStackTrace()
                                }
                            }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
                .start()
    }
}
