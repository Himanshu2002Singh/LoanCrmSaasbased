import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/empty_state_view.dart';
import 'package:capital_care/features/documents/models/document_request_model.dart';
import 'package:capital_care/features/documents/providers/document_request_provider.dart';
import 'package:capital_care/features/documents/views/widgets/lead_document_request_dialog.dart';
import 'package:capital_care/features/leads/models/lead_model.dart';

class LeadDocRequestsList extends ConsumerWidget {
  final LeadModel lead;

  const LeadDocRequestsList({
    super.key,
    required this.lead,
  });

  String _formatDate(DateTime? dt) {
    if (dt == null) return 'N/A';
    return DateFormat('dd MMM yyyy, hh:mm a').format(dt);
  }

  Color _getStatusColor(String status, bool isExpired) {
    if (isExpired) return const Color(0xFFDC2626);
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return const Color(0xFF059669);
      case 'PARTIALLY_UPLOADED':
        return const Color(0xFF2563EB);
      case 'CANCELLED':
        return const Color(0xFF64748B);
      case 'EXPIRED':
        return const Color(0xFFDC2626);
      case 'PENDING':
      default:
        return const Color(0xFFD97706);
    }
  }

  Color _getStatusBgColor(String status, bool isExpired) {
    if (isExpired) return const Color(0xFFFEE2E2);
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return const Color(0xFFECFDF5);
      case 'PARTIALLY_UPLOADED':
        return const Color(0xFFEFF6FF);
      case 'CANCELLED':
        return const Color(0xFFF1F5F9);
      case 'EXPIRED':
        return const Color(0xFFFEE2E2);
      case 'PENDING':
      default:
        return const Color(0xFFFEF3C7);
    }
  }

  Future<void> _shareOnWhatsApp(BuildContext context, String text, String? mobile) async {
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
      } else if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open WhatsApp')),
        );
      }
    } catch (_) {
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

  Future<void> _confirmCancelLink(BuildContext context, WidgetRef ref, int requestId) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Cancel Upload Link?', style: TextStyle(fontWeight: FontWeight.w700)),
        content: const Text(
          'Are you sure you want to deactivate this link? The customer will no longer be able to use it to upload documents.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Keep Active'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Deactivate Link', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final service = ref.read(documentRequestServiceProvider);
        await service.cancelDocumentRequest(requestId);
        ref.invalidate(leadDocumentRequestsProvider(lead.id));
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Upload link deactivated successfully')),
          );
        }
      } catch (e) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to cancel link: $e'), backgroundColor: AppColors.error),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requestsAsync = ref.watch(leadDocumentRequestsProvider(lead.id));

    return requestsAsync.when(
      loading: () => const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      ),
      error: (err, _) => Center(
        child: EmptyStateView(
          icon: Icons.error_outline_rounded,
          title: 'Failed to load document requests',
          message: err.toString(),
          actionLabel: 'Retry',
          onAction: () => ref.invalidate(leadDocumentRequestsProvider(lead.id)),
        ),
      ),
      data: (requests) {
        if (requests.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 70,
                    height: 70,
                    decoration: BoxDecoration(
                      color: AppColors.primarySurface,
                      shape: BoxShape.circle,
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                    ),
                    child: const Icon(Icons.link_rounded, color: AppColors.primary, size: 36),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'No Document Collection Links',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Generate a secure customer link to request KYC, Income, or Property documents. The customer can upload photos directly without any login password.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                  ),
                  const SizedBox(height: 18),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: const Icon(Icons.add_link_rounded, color: Colors.white, size: 18),
                    label: const Text(
                      'Request Documents Now',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                    ),
                    onPressed: () => LeadDocumentRequestDialog.show(context, lead: lead),
                  ),
                ],
              ),
            ),
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: requests.length,
          separatorBuilder: (_, __) => const SizedBox(height: 14),
          itemBuilder: (ctx, index) {
            final req = requests[index];
            return _buildRequestCard(context, ref, req);
          },
        );
      },
    );
  }

  Widget _buildRequestCard(BuildContext context, WidgetRef ref, LeadDocumentRequestModel req) {
    final statusColor = _getStatusColor(req.status, req.isExpired);
    final statusBgColor = _getStatusBgColor(req.status, req.isExpired);
    final uploadUrl = req.uploadUrl ?? 'https://loan-crm-saasbased.vercel.app/upload-docs/${req.token}';

    final effectiveStatus = req.isExpired && req.status != 'COMPLETED'
        ? 'EXPIRED'
        : req.status.replaceAll('_', ' ').toUpperCase();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Card Header
          Container(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 12),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: AppColors.border)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: statusBgColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(Icons.link_rounded, size: 18, color: statusColor),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        req.title,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Created: ${_formatDate(req.createdAt)}',
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusBgColor,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: statusColor.withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    effectiveStatus,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: statusColor,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Progress Section
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Upload Progress: ${req.uploadedDocs} of ${req.totalDocs} documents',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    ),
                    Text(
                      '${(req.progressRatio * 100).toStringAsFixed(0)}%',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: statusColor),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: req.progressRatio,
                    backgroundColor: const Color(0xFFE2E8F0),
                    valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                    minHeight: 6,
                  ),
                ),
                const SizedBox(height: 12),

                // Documents Checklist Preview
                Theme(
                  data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    childrenPadding: const EdgeInsets.only(top: 4, bottom: 8),
                    title: Text(
                      'View Required Documents (${req.requiredDocs.length})',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary),
                    ),
                    children: req.requiredDocs.map((doc) {
                      final isUploaded = doc.isUploaded;
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Icon(
                              isUploaded ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
                              size: 16,
                              color: isUploaded ? const Color(0xFF059669) : AppColors.textMuted,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                doc.title,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: isUploaded ? FontWeight.w600 : FontWeight.normal,
                                  color: isUploaded ? const Color(0xFF065F46) : AppColors.textPrimary,
                                  decoration: isUploaded ? TextDecoration.none : null,
                                ),
                              ),
                            ),
                            if (doc.isRequired)
                              const Text('Mandatory', style: TextStyle(fontSize: 10, color: Color(0xFFDC2626), fontWeight: FontWeight.w600))
                            else
                              const Text('Optional', style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ),

                // Metadata: Accesses & Expiry
                Row(
                  children: [
                    if (req.expiresAt != null) ...[
                      const Icon(Icons.timer_outlined, size: 13, color: AppColors.textSecondary),
                      const SizedBox(width: 4),
                      Text(
                        'Expires: ${DateFormat("dd MMM yyyy").format(req.expiresAt!)}',
                        style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                      const SizedBox(width: 14),
                    ],
                    const Icon(Icons.visibility_outlined, size: 13, color: AppColors.textSecondary),
                    const SizedBox(width: 4),
                    Text(
                      'Views: ${req.accessCount}',
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Footer Action Buttons
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: const BoxDecoration(
              color: Color(0xFFF8FAFC),
              border: Border(top: BorderSide(color: AppColors.border)),
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(16)),
            ),
            child: Row(
              children: [
                // WhatsApp Reshare
                IconButton(
                  icon: const FaIcon(FontAwesomeIcons.whatsapp, color: Color(0xFF25D366), size: 18),
                  tooltip: 'Share on WhatsApp',
                  onPressed: () {
                    final text = (req.whatsappMessageTemplate ?? '').replaceAll('{{UPLOAD_URL}}', uploadUrl);
                    _shareOnWhatsApp(context, text, lead.number);
                  },
                ),
                // Copy Link
                IconButton(
                  icon: const Icon(Icons.copy_rounded, size: 18, color: AppColors.primary),
                  tooltip: 'Copy Link',
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: uploadUrl));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Upload link copied to clipboard!')),
                    );
                  },
                ),
                // Open in Browser
                IconButton(
                  icon: const Icon(Icons.open_in_new_rounded, size: 18, color: AppColors.textSecondary),
                  tooltip: 'Open in Browser',
                  onPressed: () => _openBrowser(uploadUrl),
                ),
                const Spacer(),
                if (!req.isCancelled && !req.isFullyUploaded && !req.isExpired)
                  TextButton.icon(
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.error,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    ),
                    icon: const Icon(Icons.cancel_outlined, size: 16),
                    label: const Text('Deactivate', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                    onPressed: () => _confirmCancelLink(context, ref, req.id),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
