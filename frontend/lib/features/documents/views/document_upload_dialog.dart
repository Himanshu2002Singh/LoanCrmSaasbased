import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:file_picker/file_picker.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/custom_button.dart';
import 'package:capital_care/core/widgets/custom_text_field.dart';
import 'package:capital_care/features/documents/services/document_service.dart';
import 'package:capital_care/features/leads/providers/leads_provider.dart';

class DocumentUploadDialog extends ConsumerStatefulWidget {
  final int leadId;

  const DocumentUploadDialog({super.key, required this.leadId});

  @override
  ConsumerState<DocumentUploadDialog> createState() => _DocumentUploadDialogState();
}

class _DocumentUploadDialogState extends ConsumerState<DocumentUploadDialog> {
  final _remarksController = TextEditingController();
  String? _selectedDocType;
  String? _pickedFilePath;
  String? _pickedFileName;
  bool _isUploading = false;

  static const List<Map<String, String>> _fallbackDocTypes = [
    {'value': 'PAN', 'label': 'PAN Card'},
    {'value': 'AADHAAR', 'label': 'Aadhaar Card'},
    {'value': 'SALARY_SLIP', 'label': 'Salary Slip (Last 3 Months)'},
    {'value': 'BANK_STATEMENT', 'label': 'Bank Statement (Last 6 Months)'},
    {'value': 'ITR', 'label': 'ITR / Form 16'},
    {'value': 'PROPERTY_CHAIN', 'label': 'Property Title Deeds'},
    {'value': 'GST_RETURNS', 'label': 'GST Certificate & Returns'},
    {'value': 'OTHER', 'label': 'Other Document'},
  ];

  @override
  void dispose() {
    _remarksController.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'],
    );

    if (result != null && result.files.single.path != null) {
      setState(() {
        _pickedFilePath = result.files.single.path;
        _pickedFileName = result.files.single.name;
      });
    }
  }

  Future<void> _upload() async {
    if (_pickedFilePath == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a file to upload')),
      );
      return;
    }

    setState(() => _isUploading = true);

    try {
      final service = DocumentService();
      await service.uploadDocument(
        leadId: widget.leadId,
        docType: _selectedDocType ?? 'OTHER',
        filePath: _pickedFilePath!,
        remarks: _remarksController.text.trim().isNotEmpty ? _remarksController.text.trim() : null,
      );

      if (mounted) {
        Navigator.pop(context, true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Document uploaded successfully!'), backgroundColor: AppColors.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final dynamicDocTypesAsync = ref.watch(documentTypesProvider);

    final List<Map<String, String>> docTypes = dynamicDocTypesAsync.when(
      data: (configs) {
        if (configs.isNotEmpty) {
          final mapped = configs
              .where((c) => c.isActive)
              .map((c) => {'value': c.value, 'label': c.label})
              .toList();
          
          // Deduplicate by value
          final seen = <String>{};
          final unique = <Map<String, String>>[];
          for (final dt in mapped) {
            if (seen.add(dt['value']!)) {
              unique.push(dt);
            }
          }
          return unique.isNotEmpty ? unique : _fallbackDocTypes;
        }
        return _fallbackDocTypes;
      },
      loading: () => _fallbackDocTypes,
      error: (_, __) => _fallbackDocTypes,
    );

    final validValues = docTypes.map((dt) => dt['value']!).toList();
    if (_selectedDocType == null || !validValues.contains(_selectedDocType)) {
      _selectedDocType = validValues.isNotEmpty ? validValues.first : null;
    }

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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Upload Lead Document',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
                ],
              ),
              const Divider(height: 20),

              // Document Type Dropdown
              const Text('Document Type', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                isExpanded: true,
                value: _selectedDocType,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: AppColors.background,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
                items: docTypes.map((dt) {
                  return DropdownMenuItem(
                    value: dt['value'],
                    child: Text(
                      dt['label']!,
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    ),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedDocType = val);
                },
              ),
              const SizedBox(height: 14),

              // File Selector Box
              InkWell(
                onTap: _pickFile,
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _pickedFilePath != null ? AppColors.primary : AppColors.inputBorder,
                      style: BorderStyle.solid,
                    ),
                  ),
                  child: Column(
                    children: [
                      Icon(
                        _pickedFilePath != null ? Icons.file_present : Icons.cloud_upload_outlined,
                        size: 36,
                        color: _pickedFilePath != null ? AppColors.primary : AppColors.textSecondary,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _pickedFileName ?? 'Tap to browse PDF or Image',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: _pickedFileName != null ? FontWeight.bold : FontWeight.normal,
                          color: _pickedFileName != null ? AppColors.textPrimary : AppColors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 14),

              // Remarks field
              CustomTextField(
                label: 'Remarks (Optional)',
                controller: _remarksController,
                hint: 'e.g. Verified original copy',
                prefixIcon: Icons.notes_outlined,
              ),
              const SizedBox(height: 20),

              // Upload Button
              CustomButton(
                text: 'Upload Document',
                isLoading: _isUploading,
                icon: Icons.upload,
                onPressed: _upload,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
extension on List<Map<String, String>> {
  void push(Map<String, String> item) => add(item);
}
