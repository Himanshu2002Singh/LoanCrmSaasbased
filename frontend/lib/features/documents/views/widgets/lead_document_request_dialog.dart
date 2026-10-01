import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/features/documents/models/document_request_model.dart';
import 'package:capital_care/features/documents/providers/document_request_provider.dart';
import 'package:capital_care/features/leads/models/lead_model.dart';

class LeadDocumentRequestDialog extends ConsumerStatefulWidget {
  final LeadModel lead;
  final VoidCallback? onSuccess;

  const LeadDocumentRequestDialog({
    super.key,
    required this.lead,
    this.onSuccess,
  });

  static Future<bool?> show(
    BuildContext context, {
    required LeadModel lead,
    VoidCallback? onSuccess,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (ctx) => LeadDocumentRequestDialog(
        lead: lead,
        onSuccess: onSuccess,
      ),
    );
  }

  @override
  ConsumerState<LeadDocumentRequestDialog> createState() => _LeadDocumentRequestDialogState();
}

class _LeadDocumentRequestDialogState extends ConsumerState<LeadDocumentRequestDialog> {
  final _customDocTitleController = TextEditingController();
  final _customMessageController = TextEditingController();

  List<DocRequirementItem> _selectedDocs = [];
  String _customDocCategory = 'KYC';
  int _expiryDays = 7;
  bool _isSubmitting = false;
  bool _copiedLink = false;
  bool _copiedMsg = false;
  bool _initialized = false;

  LeadDocumentRequestModel? _generatedResult;

  static const Map<String, List<DocRequirementItem>> _defaultPresets = {
    'SALARIED': [
      DocRequirementItem(id: 'pan', title: 'PAN Card', docType: 'PAN_CARD', category: 'KYC', isRequired: true),
      DocRequirementItem(id: 'aadhaar', title: 'Aadhaar Card (Front & Back)', docType: 'AADHAAR_CARD', category: 'KYC', isRequired: true),
      DocRequirementItem(id: 'salary', title: 'Latest 3 Months Salary Slips', docType: 'SALARY_SLIPS', category: 'INCOME', isRequired: true),
      DocRequirementItem(id: 'bank', title: 'Latest 6 Months Bank Statement', docType: 'BANK_STATEMENT', category: 'BANKING', isRequired: true),
      DocRequirementItem(id: 'form16', title: 'Form 16 / Latest 2 Years ITR', docType: 'FORM_16', category: 'INCOME', isRequired: false),
      DocRequirementItem(id: 'address', title: 'Current Address Proof (Utility Bill)', docType: 'ADDRESS_PROOF', category: 'KYC', isRequired: false),
      DocRequirementItem(id: 'photo', title: 'Passport Size Photograph', docType: 'PHOTO', category: 'KYC', isRequired: false),
    ],
    'BUSINESS': [
      DocRequirementItem(id: 'pan', title: 'PAN Card (Applicant & Entity)', docType: 'PAN_CARD', category: 'KYC', isRequired: true),
      DocRequirementItem(id: 'aadhaar', title: 'Aadhaar Card of Applicant', docType: 'AADHAAR_CARD', category: 'KYC', isRequired: true),
      DocRequirementItem(id: 'itr', title: 'Last 2-3 Years ITR with Computation', docType: 'ITR_RETURNS', category: 'INCOME', isRequired: true),
      DocRequirementItem(id: 'bank_biz', title: 'Last 12 Months Current Bank Statement', docType: 'BANK_STATEMENT', category: 'BANKING', isRequired: true),
      DocRequirementItem(id: 'gst', title: 'GST Certificate & Latest 1 Year Returns', docType: 'GST_CERTIFICATE', category: 'BUSINESS', isRequired: true),
      DocRequirementItem(id: 'biz_proof', title: 'Business Proof / MSME / Udyam', docType: 'BUSINESS_PROOF', category: 'BUSINESS', isRequired: true),
      DocRequirementItem(id: 'office_bill', title: 'Office / Business Electricity Bill', docType: 'ADDRESS_PROOF', category: 'KYC', isRequired: false),
    ],
    'PROPERTY': [
      DocRequirementItem(id: 'kyc_combo', title: 'Applicant PAN & Aadhaar KYC', docType: 'KYC_COMBO', category: 'KYC', isRequired: true),
      DocRequirementItem(id: 'chain', title: 'Property Chain / Title Deed / Registry', docType: 'PROPERTY_CHAIN', category: 'PROPERTY', isRequired: true),
      DocRequirementItem(id: 'map', title: 'Sanctioned Map / Building Plan', docType: 'SANCTION_MAP', category: 'PROPERTY', isRequired: true),
      DocRequirementItem(id: 'tax', title: 'Latest Property Tax Receipt', docType: 'PROPERTY_TAX', category: 'PROPERTY', isRequired: false),
      DocRequirementItem(id: 'allotment', title: 'Allotment Letter / Agreement to Sell', docType: 'AGREEMENT_SALE', category: 'PROPERTY', isRequired: false),
    ],
    'BASIC_KYC': [
      DocRequirementItem(id: 'pan', title: 'PAN Card', docType: 'PAN_CARD', category: 'KYC', isRequired: true),
      DocRequirementItem(id: 'aadhaar', title: 'Aadhaar Card', docType: 'AADHAAR_CARD', category: 'KYC', isRequired: true),
      DocRequirementItem(id: 'photo', title: 'Passport Photograph', docType: 'PHOTO', category: 'KYC', isRequired: true),
      DocRequirementItem(id: 'utility', title: 'Electricity / Utility Bill', docType: 'ADDRESS_PROOF', category: 'KYC', isRequired: false),
    ],
  };

  @override
  void initState() {
    super.initState();
    _customMessageController.text =
        'Hi ${widget.lead.name}, please upload the requested documents to process your ${widget.lead.loanType ?? "loan"} application.';

    _initializeDefaultSelection();
  }

  void _initializeDefaultSelection() {
    if (_initialized) return;
    _initialized = true;

    final loanType = (widget.lead.loanType ?? '').toUpperCase();
    if (loanType.contains('BUSINESS') || loanType.contains('MSME')) {
      _applyPresetList(_defaultPresets['BUSINESS']!);
    } else if (loanType.contains('HOME') || loanType.contains('PROPERTY') || loanType.contains('LAP')) {
      _applyPresetList(_defaultPresets['PROPERTY']!);
    } else if (loanType.contains('SALARIED') || loanType.contains('PERSONAL')) {
      _applyPresetList(_defaultPresets['SALARIED']!);
    } else {
      _applyPresetList(_defaultPresets['BASIC_KYC']!);
    }
  }

  @override
  void dispose() {
    _customDocTitleController.dispose();
    _customMessageController.dispose();
    super.dispose();
  }

  void _applyPresetList(List<DocRequirementItem> presetDocs) {
    _selectedDocs = presetDocs
        .map((d) => d.copyWith(id: 'slot_${DateTime.now().millisecondsSinceEpoch}_${d.docType}'))
        .toList();
  }

  void _applyPreset(List<DocRequirementItem>? presetDocs) {
    if (presetDocs == null || presetDocs.isEmpty) return;
    setState(() {
      _applyPresetList(presetDocs);
    });
  }

  void _toggleRequired(int index) {
    if (index >= _selectedDocs.length) return;
    setState(() {
      final doc = _selectedDocs[index];
      _selectedDocs[index] = doc.copyWith(isRequired: !doc.isRequired);
    });
  }

  void _removeDoc(int index) {
    if (index >= _selectedDocs.length) return;
    setState(() {
      _selectedDocs.removeAt(index);
    });
  }

  void _addCustomDoc() {
    final title = _customDocTitleController.text.trim();
    if (title.isEmpty) return;

    final newDoc = DocRequirementItem(
      id: 'custom_${DateTime.now().millisecondsSinceEpoch}',
      title: title,
      docType: title.toUpperCase().replaceAll(RegExp(r'\s+'), '_'),
      category: _customDocCategory,
      isRequired: true,
      description: 'Custom requested document',
    );

    setState(() {
      _selectedDocs.add(newDoc);
      _customDocTitleController.clear();
    });
  }

  Future<void> _generateUploadLink() async {
    if (_selectedDocs.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select at least one document to request'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final service = ref.read(documentRequestServiceProvider);
      final result = await service.createDocumentRequest(
        leadId: widget.lead.id,
        title: '${widget.lead.loanType ?? "Loan"} Document Verification',
        requiredDocs: _selectedDocs,
        expiryDays: _expiryDays,
        customMessage: _customMessageController.text.trim(),
      );

      ref.invalidate(leadDocumentRequestsProvider(widget.lead.id));

      if (mounted) {
        setState(() {
          _generatedResult = result;
          _isSubmitting = false;
        });

        widget.onSuccess?.call();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Unique secure upload link generated!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to generate link: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  void _copyToClipboard(String text, {bool isLink = false}) {
    Clipboard.setData(ClipboardData(text: text));
    setState(() {
      if (isLink) {
        _copiedLink = true;
      } else {
        _copiedMsg = true;
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(isLink ? 'Upload link copied to clipboard!' : 'WhatsApp text copied!'),
        backgroundColor: AppColors.primary,
        duration: const Duration(seconds: 2),
      ),
    );

    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          if (isLink) _copiedLink = false;
          if (!isLink) _copiedMsg = false;
        });
      }
    });
  }

  Future<void> _shareOnWhatsApp(String text, String? mobile) async {
    String phone = (mobile ?? '').replaceAll(RegExp(r'\D'), '');
    if (phone.length == 10) phone = '91$phone';

    final encoded = Uri.encodeComponent(text);
    final waUri = Uri.parse('whatsapp://send?phone=$phone&text=$encoded');
    final webUri = Uri.parse('https://wa.me/$phone?text=$encoded');

    try {
      if (await canLaunchUrl(waUri)) {
        await launchUrl(waUri, mode: LaunchMode.externalApplication);
      } else if (await canLaunchUrl(webUri)) {
        await launchUrl(webUri, mode: LaunchMode.externalApplication);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open WhatsApp app')),
        );
      }
    } catch (e) {
      if (await canLaunchUrl(webUri)) {
        await launchUrl(webUri, mode: LaunchMode.externalApplication);
      }
    }
  }

  Future<void> _openBrowser(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    final configAsync = ref.watch(documentConfigDocsProvider);

    final presets = configAsync.maybeWhen(
      data: (cfg) => cfg.presets.isNotEmpty ? cfg.presets : _defaultPresets,
      orElse: () => _defaultPresets,
    );

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: Colors.white,
      surfaceTintColor: Colors.white,
      elevation: 24,
      clipBehavior: Clip.antiAlias,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: SizedBox(
        width: 540,
        height: screenHeight * 0.82,
        child: Column(
          mainAxisSize: MainAxisSize.max,
          children: [
            // Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                border: Border(bottom: BorderSide(color: AppColors.border)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppColors.primarySurface,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.link_rounded, color: AppColors.primary, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _generatedResult != null
                              ? 'Share Document Upload Link'
                              : 'Request Documents from Lead',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Lead #${widget.lead.id} • ${widget.lead.name} (${widget.lead.loanType ?? "Loan"})',
                          style: const TextStyle(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: AppColors.textMuted, size: 20),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),

            // Scrollable Content
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                physics: const BouncingScrollPhysics(),
                child: _generatedResult != null
                    ? _buildShareResultStep()
                    : _buildConfigureStep(presets),
              ),
            ),

            // Footer Actions
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: const BoxDecoration(
                color: Color(0xFFF8FAFC),
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: _generatedResult != null
                  ? Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        TextButton(
                          onPressed: () => setState(() => _generatedResult = null),
                          child: const Text('← Create another link', style: TextStyle(fontSize: 12)),
                        ),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            minimumSize: const Size(0, 40),
                            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          onPressed: () => Navigator.of(context).pop(true),
                          child: const Text('Done', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                        ),
                      ],
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.shield_outlined, size: 14, color: Color(0xFF16A34A)),
                            SizedBox(width: 4),
                            Text(
                              'Encrypted Link',
                              style: TextStyle(fontSize: 11, color: Color(0xFF16A34A), fontWeight: FontWeight.w600),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            TextButton(
                              onPressed: () => Navigator.of(context).pop(),
                              child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                            ),
                            const SizedBox(width: 6),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                minimumSize: const Size(0, 40),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                              icon: _isSubmitting
                                  ? const SizedBox(
                                      width: 14,
                                      height: 14,
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                                    )
                                  : const Icon(Icons.link_rounded, color: Colors.white, size: 16),
                              label: Text(
                                _isSubmitting ? 'Generating...' : 'Generate Link',
                                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                              ),
                              onPressed: _isSubmitting || _selectedDocs.isEmpty ? null : _generateUploadLink,
                            ),
                          ],
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
  }

  // STEP 1: CONFIGURE STEP
  Widget _buildConfigureStep(Map<String, List<DocRequirementItem>> presets) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Presets Chips
        const Row(
          children: [
            Icon(Icons.auto_awesome_rounded, size: 14, color: Color(0xFFD97706)),
            SizedBox(width: 6),
            Text(
              'QUICK TEMPLATES (TAP TO AUTO-FILL)',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
            ),
          ],
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              _buildPresetButton(
                label: '💼 Salaried',
                onTap: () => _applyPreset(presets['SALARIED'] ?? _defaultPresets['SALARIED']),
                color: const Color(0xFF2563EB),
                bgColor: const Color(0xFFEFF6FF),
              ),
              const SizedBox(width: 8),
              _buildPresetButton(
                label: '🏢 Business',
                onTap: () => _applyPreset(presets['BUSINESS'] ?? _defaultPresets['BUSINESS']),
                color: const Color(0xFF7C3AED),
                bgColor: const Color(0xFFF5F3FF),
              ),
              const SizedBox(width: 8),
              _buildPresetButton(
                label: '🏠 Property / LAP',
                onTap: () => _applyPreset(presets['PROPERTY'] ?? _defaultPresets['PROPERTY']),
                color: const Color(0xFF059669),
                bgColor: const Color(0xFFECFDF5),
              ),
              const SizedBox(width: 8),
              _buildPresetButton(
                label: '🪪 Basic KYC',
                onTap: () => _applyPreset(presets['BASIC_KYC'] ?? _defaultPresets['BASIC_KYC']),
                color: const Color(0xFFD97706),
                bgColor: const Color(0xFFFEF3C7),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: () => setState(() => _selectedDocs.clear()),
                child: const Text('Clear All', style: TextStyle(fontSize: 11, color: AppColors.error)),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Selected Documents List Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'SELECTED DOCUMENTS (${_selectedDocs.length})',
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
            ),
            const Text(
              'Tap badge to toggle Mandatory',
              style: TextStyle(fontSize: 10, color: AppColors.textMuted),
            ),
          ],
        ),
        const SizedBox(height: 6),

        if (_selectedDocs.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: AppColors.border),
            ),
            child: const Center(
              child: Text(
                'No documents selected yet. Tap a template above or add custom documents.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
              ),
            ),
          )
        else
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.border),
              borderRadius: BorderRadius.circular(10),
            ),
            child: ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _selectedDocs.length,
              separatorBuilder: (_, __) => const Divider(height: 1, color: AppColors.border),
              itemBuilder: (ctx, index) {
                final doc = _selectedDocs[index];
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  child: Row(
                    children: [
                      const Icon(Icons.description_outlined, color: AppColors.primary, size: 16),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              doc.title,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            Text(
                              doc.category,
                              style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      // Mandatory / Optional Toggle Button
                      InkWell(
                        onTap: () => _toggleRequired(index),
                        borderRadius: BorderRadius.circular(6),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2.5),
                          decoration: BoxDecoration(
                            color: doc.isRequired ? const Color(0xFFFEE2E2) : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: doc.isRequired ? const Color(0xFFFECACA) : const Color(0xFFE2E8F0),
                            ),
                          ),
                          child: Text(
                            doc.isRequired ? 'Mandatory *' : 'Optional',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: doc.isRequired ? const Color(0xFFDC2626) : const Color(0xFF64748B),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      IconButton(
                        icon: const Icon(Icons.delete_outline_rounded, size: 16, color: AppColors.textMuted),
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(),
                        onPressed: () => _removeDoc(index),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),

        const SizedBox(height: 14),

        // Add Custom Document Row
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _customDocTitleController,
                  decoration: const InputDecoration(
                    hintText: '+ Add custom document title...',
                    hintStyle: TextStyle(fontSize: 12, color: AppColors.textMuted),
                    border: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  ),
                  onSubmitted: (_) => _addCustomDoc(),
                ),
              ),
              DropdownButton<String>(
                value: _customDocCategory,
                underline: const SizedBox.shrink(),
                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                items: ['KYC', 'INCOME', 'BANKING', 'PROPERTY', 'BUSINESS', 'OTHER']
                    .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _customDocCategory = val);
                },
              ),
              const SizedBox(width: 4),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.primary,
                  minimumSize: const Size(0, 36),
                  elevation: 0,
                  side: const BorderSide(color: AppColors.border),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                onPressed: _addCustomDoc,
                child: const Text('Add', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),
        const Divider(color: AppColors.border),
        const SizedBox(height: 10),

        // Expiry Settings
        const Text(
          'LINK VALIDITY / EXPIRY',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 5),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.border),
          ),
          child: DropdownButton<int>(
            isExpanded: true,
            underline: const SizedBox.shrink(),
            value: _expiryDays,
            items: const [
              DropdownMenuItem(value: 1, child: Text('24 Hours (1 Day)', style: TextStyle(fontSize: 12))),
              DropdownMenuItem(value: 3, child: Text('3 Days', style: TextStyle(fontSize: 12))),
              DropdownMenuItem(value: 7, child: Text('7 Days (Recommended)', style: TextStyle(fontSize: 12))),
              DropdownMenuItem(value: 15, child: Text('15 Days', style: TextStyle(fontSize: 12))),
              DropdownMenuItem(value: 30, child: Text('30 Days', style: TextStyle(fontSize: 12))),
              DropdownMenuItem(value: 0, child: Text('No Expiry', style: TextStyle(fontSize: 12))),
            ],
            onChanged: (val) {
              if (val != null) setState(() => _expiryDays = val);
            },
          ),
        ),

        const SizedBox(height: 12),

        // Custom Note
        const Text(
          'MESSAGE FOR CUSTOMER',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 5),
        TextField(
          controller: _customMessageController,
          maxLines: 2,
          decoration: InputDecoration(
            hintText: 'Add an optional note or instruction for customer...',
            hintStyle: const TextStyle(fontSize: 12, color: AppColors.textMuted),
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: AppColors.border),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
          ),
        ),
      ],
    );
  }

  // STEP 2: SHARE RESULT STEP
  Widget _buildShareResultStep() {
    final result = _generatedResult!;
    final uploadUrl = result.uploadUrl ?? 'https://loan-crm-saasbased.vercel.app/upload-docs/${result.token}';
    final whatsappText = (result.whatsappMessageTemplate ?? '').replaceAll('{{UPLOAD_URL}}', uploadUrl);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Success Banner
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFECFDF5),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFA7F3D0)),
          ),
          child: const Row(
            children: [
              Icon(Icons.check_circle_rounded, color: Color(0xFF059669), size: 22),
              SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Link Generated Successfully!',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF065F46),
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Customer can open this link to upload required documents without needing any login or password.',
                      style: TextStyle(fontSize: 11, color: Color(0xFF047857)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Upload Link Box
        const Text(
          'SECURE CUSTOMER UPLOAD LINK',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 5),
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppColors.border),
          ),
          child: Row(
            children: [
              Expanded(
                child: SelectableText(
                  uploadUrl,
                  style: const TextStyle(
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: AppColors.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _copiedLink ? const Color(0xFF16A34A) : AppColors.primary,
                  minimumSize: const Size(0, 36),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                icon: Icon(_copiedLink ? Icons.check_rounded : Icons.copy_rounded, color: Colors.white, size: 12),
                label: Text(
                  _copiedLink ? 'Copied' : 'Copy',
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
                ),
                onPressed: () => _copyToClipboard(uploadUrl, isLink: true),
              ),
              const SizedBox(width: 4),
              IconButton(
                icon: const Icon(Icons.open_in_new_rounded, size: 16, color: AppColors.textSecondary),
                tooltip: 'Preview Link in Browser',
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
                onPressed: () => _openBrowser(uploadUrl),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // WhatsApp Share Card
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDF4),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFBBF7D0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Row(
                    children: [
                      FaIcon(FontAwesomeIcons.whatsapp, color: Color(0xFF25D366), size: 16),
                      SizedBox(width: 6),
                      Text(
                        'One-Click WhatsApp Sharing',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF166534),
                        ),
                      ),
                    ],
                  ),
                  if (widget.lead.number.isNotEmpty)
                    Text(
                      widget.lead.number,
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                    ),
                ],
              ),
              const SizedBox(height: 8),

              // Message Preview
              Container(
                padding: const EdgeInsets.all(10),
                constraints: const BoxConstraints(maxHeight: 120),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: SingleChildScrollView(
                  child: Text(
                    whatsappText,
                    style: const TextStyle(
                      fontSize: 11,
                      fontFamily: 'monospace',
                      color: AppColors.textPrimary,
                      height: 1.4,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Action Buttons
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF25D366),
                        minimumSize: const Size(0, 40),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      icon: const FaIcon(FontAwesomeIcons.whatsapp, color: Colors.white, size: 15),
                      label: const Text(
                        'Send on WhatsApp',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12),
                      ),
                      onPressed: () => _shareOnWhatsApp(whatsappText, widget.lead.number),
                    ),
                  ),
                  const SizedBox(width: 8),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppColors.textPrimary,
                      minimumSize: const Size(0, 40),
                      elevation: 0,
                      side: const BorderSide(color: AppColors.border),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    icon: Icon(_copiedMsg ? Icons.check_rounded : Icons.copy_rounded, size: 13),
                    label: Text(
                      _copiedMsg ? 'Copied' : 'Copy Text',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600),
                    ),
                    onPressed: () => _copyToClipboard(whatsappText, isLink: false),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // Requested Documents Summary Card
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Requested Documents (${_selectedDocs.length}):',
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.textPrimary),
                  ),
                  if (_expiryDays > 0)
                    Text(
                      'Valid for $_expiryDays days',
                      style: const TextStyle(fontSize: 10, color: Color(0xFFD97706), fontWeight: FontWeight.w600),
                    ),
                ],
              ),
              const SizedBox(height: 6),
              Wrap(
                spacing: 5,
                runSpacing: 5,
                children: _selectedDocs.map((d) {
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(5),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.check_circle_outline, size: 11, color: AppColors.primary),
                        const SizedBox(width: 3),
                        Text(d.title, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w500)),
                        if (d.isRequired)
                          const Text(' *', style: TextStyle(color: Color(0xFFDC2626), fontWeight: FontWeight.w700)),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPresetButton({
    required String label,
    required VoidCallback onTap,
    required Color color,
    required Color bgColor,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w700,
            color: color,
          ),
        ),
      ),
    );
  }
}
