import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/custom_button.dart';
import 'package:capital_care/core/widgets/custom_text_field.dart';
import 'package:capital_care/features/leads/models/template_model.dart';
import 'package:capital_care/features/leads/providers/leads_provider.dart';

class TemplateDialog extends ConsumerStatefulWidget {
  final String phone;
  final String name;

  const TemplateDialog({super.key, required this.phone, required this.name});

  static Future<void> show(
    BuildContext context, {
    required String phone,
    required String name,
  }) async {
    return showDialog<void>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => TemplateDialog(phone: phone, name: name),
    );
  }

  @override
  ConsumerState<TemplateDialog> createState() => _TemplateDialogState();
}

class _TemplateDialogState extends ConsumerState<TemplateDialog> {
  final TextEditingController _messageController = TextEditingController();
  TemplateModel? _selectedTemplate;
  bool _isSending = false;
  static const _channel = MethodChannel(
    'com.trustingbrains.callingcrm/whatsapp_share',
  );

  @override
  void initState() {
    super.initState();
    _messageController.text =
        'Hello ${widget.name}, regarding your loan inquiry with us.';
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
  }

  String get _cleanPhone {
    var p = widget.phone.replaceAll(RegExp(r'\D'), '');
    if (p.length == 10) {
      p = '91$p';
    }
    return p;
  }

  Future<void> _sendWhatsApp() async {
    if (_isSending) return;
    setState(() => _isSending = true);

    final message = _messageController.text.trim();
    final fileUrl = _selectedTemplate?.fullFileUrl ?? '';
    final phone = _cleanPhone;
    final hasFile = _selectedTemplate != null && _selectedTemplate!.hasFile;

    // Copy template body to clipboard as convenience for user
    if (message.isNotEmpty) {
      try {
        await Clipboard.setData(ClipboardData(text: message));
      } catch (_) {}
    }

    bool sentViaChannel = false;

    if (Platform.isAndroid && hasFile && fileUrl.isNotEmpty) {
      try {
        await _channel.invokeMethod('shareImageToWhatsApp', {
          'imageUrl': fileUrl,
          'message': message,
          'phone': phone,
        });
        sentViaChannel = true;
      } on PlatformException catch (e) {
        debugPrint('MethodChannel WhatsApp share error: ${e.message}');
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(e.message ?? 'Failed to attach template file'),
              backgroundColor: AppColors.error,
              duration: const Duration(seconds: 2),
            ),
          );
        }
      } catch (e) {
        debugPrint('MethodChannel unexpected error: $e');
      }
    }

    // Direct WhatsApp URI fallback (for text-only templates or if channel failed)
    if (!sentViaChannel) {
      try {
        final directWaUri = Uri.parse(
          phone.isNotEmpty
              ? 'whatsapp://send?phone=$phone&text=${Uri.encodeComponent(message)}'
              : 'whatsapp://send?text=${Uri.encodeComponent(message)}',
        );
        final launched = await launchUrl(
          directWaUri,
          mode: LaunchMode.externalApplication,
        );
        if (!launched) {
          final webUri = Uri.parse(
            phone.isNotEmpty
                ? 'https://api.whatsapp.com/send?phone=$phone&text=${Uri.encodeComponent(message)}'
                : 'https://api.whatsapp.com/send?text=${Uri.encodeComponent(message)}',
          );
          await launchUrl(webUri, mode: LaunchMode.externalApplication);
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Could not launch WhatsApp: $e'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    }

    if (mounted) {
      setState(() => _isSending = false);
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final templatesAsync = ref.watch(templatesProvider);

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: AppColors.surface,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(
                            0xFF25D366,
                          ).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const FaIcon(
                          FontAwesomeIcons.whatsapp,
                          color: Color(0xFF25D366),
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 10),
                      const Text(
                        'Send WhatsApp Template',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: AppColors.textMuted),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
              const Divider(height: 20),

              // Recipient Card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.cardBorder),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: AppColors.primary.withValues(
                        alpha: 0.15,
                      ),
                      child: Text(
                        widget.name.isNotEmpty
                            ? widget.name[0].toUpperCase()
                            : 'C',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.name,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          Text(
                            widget.phone,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Template Dropdown
              const Text(
                'Select Template',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),

              templatesAsync.when(
                data: (templates) {
                  if (templates.isEmpty) {
                    return Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.background,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.cardBorder),
                      ),
                      child: const Row(
                        children: [
                          Icon(
                            Icons.info_outline,
                            size: 16,
                            color: AppColors.textMuted,
                          ),
                          SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'No predefined templates configured. You can type a custom message below.',
                              style: TextStyle(
                                fontSize: 12,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    );
                  }

                  return DropdownButtonFormField<TemplateModel>(
                    isExpanded: true,
                    value: _selectedTemplate,
                    hint: const Text(
                      'Choose a template...',
                      style: TextStyle(
                        fontSize: 13,
                        color: AppColors.textMuted,
                      ),
                    ),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: AppColors.background,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(
                          color: AppColors.inputBorder,
                        ),
                      ),
                    ),
                    items:
                        templates.map((t) {
                          return DropdownMenuItem<TemplateModel>(
                            value: t,
                            child: Row(
                              children: [
                                Icon(
                                  t.isPdf
                                      ? Icons.picture_as_pdf
                                      : t.isImage
                                      ? Icons.image
                                      : Icons.chat_bubble_outline,
                                  size: 16,
                                  color:
                                      t.isPdf
                                          ? Colors.redAccent
                                          : t.isImage
                                          ? AppColors.primary
                                          : const Color(0xFF25D366),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          t.name,
                                          overflow: TextOverflow.ellipsis,
                                          maxLines: 1,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w500,
                                          ),
                                        ),
                                      ),
                                      if (t.isTextOnly)
                                        Container(
                                          margin: const EdgeInsets.only(
                                            left: 6,
                                          ),
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 6,
                                            vertical: 2,
                                          ),
                                          decoration: BoxDecoration(
                                            color: const Color(
                                              0xFF25D366,
                                            ).withValues(alpha: 0.12),
                                            borderRadius: BorderRadius.circular(
                                              4,
                                            ),
                                          ),
                                          child: const Text(
                                            'Text',
                                            style: TextStyle(
                                              fontSize: 10,
                                              color: Color(0xFF25D366),
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                    onChanged: (val) {
                      setState(() {
                        _selectedTemplate = val;
                        if (val != null && val.description.isNotEmpty) {
                          _messageController.text = val.description;
                        }
                      });
                    },
                  );
                },
                loading:
                    () => const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Center(
                        child: SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.primary,
                          ),
                        ),
                      ),
                    ),
                error:
                    (e, _) => Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.error.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        'Failed to load templates: $e',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.error,
                        ),
                      ),
                    ),
              ),

              // Template Preview (Image / PDF / Text)
              if (_selectedTemplate != null && _selectedTemplate!.hasFile) ...[
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.cardBorder),
                  ),
                  child:
                      _selectedTemplate!.isPdf
                          ? Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: Colors.red.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: const Icon(
                                      Icons.picture_as_pdf,
                                      color: Colors.red,
                                      size: 28,
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          _selectedTemplate!.name,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.bold,
                                            fontSize: 13,
                                            color: AppColors.textPrimary,
                                          ),
                                        ),
                                        const Text(
                                          'PDF Document attachment',
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: AppColors.textSecondary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(
                                    0xFF25D366,
                                  ).withValues(alpha: 0.08),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(
                                    color: const Color(
                                      0xFF25D366,
                                    ).withValues(alpha: 0.2),
                                  ),
                                ),
                                child: const Row(
                                  children: [
                                    Icon(
                                      Icons.info_outline,
                                      size: 14,
                                      color: Color(0xFF25D366),
                                    ),
                                    SizedBox(width: 6),
                                    Expanded(
                                      child: Text(
                                        'PDF attaches to WhatsApp chat & template message is copied to clipboard.',
                                        style: TextStyle(
                                          fontSize: 11,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          )
                          : ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(
                              _selectedTemplate!.fullFileUrl,
                              height: 140,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              errorBuilder:
                                  (context, error, stackTrace) => Container(
                                    height: 80,
                                    color: AppColors.surface,
                                    child: const Center(
                                      child: Text(
                                        'Image preview not available',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: AppColors.textMuted,
                                        ),
                                      ),
                                    ),
                                  ),
                            ),
                          ),
                ),
              ],

              const SizedBox(height: 16),

              // Message field
              CustomTextField(
                label: 'Message / Caption',
                controller: _messageController,
                hint: 'Type message to send...',
                maxLines: 3,
                prefixIcon: Icons.message_outlined,
              ),

              const SizedBox(height: 20),

              // Action Buttons
              CustomButton(
                text: 'Send on WhatsApp',
                isLoading: _isSending,
                icon: Icons.send_rounded,
                height: 48,
                backgroundColor: const Color(0xFF25D366),
                textColor: Colors.white,
                onPressed: _sendWhatsApp,
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: TextButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
