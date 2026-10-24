import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/utils/provider_reset.dart';
import 'package:capital_care/core/widgets/custom_button.dart';
import 'package:capital_care/features/auth/providers/auth_provider.dart';

class SubscriptionExpiredDialog extends ConsumerWidget {
  final String message;
  final String? expiredAt;
  final bool isSuspended;

  const SubscriptionExpiredDialog({
    super.key,
    required this.message,
    this.expiredAt,
    this.isSuspended = false,
  });

  static bool _isShowing = false;

  static Future<void> show(
    BuildContext context, {
    required String message,
    String? expiredAt,
    bool isSuspended = false,
  }) async {
    if (_isShowing) return;
    _isShowing = true;

    try {
      await showDialog(
        context: context,
        barrierDismissible: false,
        barrierColor: Colors.black.withValues(alpha: 0.75),
        builder: (ctx) => PopScope(
          canPop: false,
          child: SubscriptionExpiredDialog(
            message: message,
            expiredAt: expiredAt,
            isSuspended: isSuspended,
          ),
        ),
      );
    } finally {
      _isShowing = false;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final title = isSuspended ? 'Account Suspended' : 'Subscription Plan Expired';
    final primaryColor = isSuspended ? AppColors.error : const Color(0xFFE11D48);

    String? formattedDate;
    if (expiredAt != null && expiredAt!.isNotEmpty) {
      try {
        final dt = DateTime.parse(expiredAt!);
        formattedDate = '${dt.day}/${dt.month}/${dt.year}';
      } catch (_) {
        formattedDate = expiredAt;
      }
    }

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      backgroundColor: AppColors.surface,
      insetPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Top Glowing Icon
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: primaryColor.withValues(alpha: 0.12),
                shape: BoxShape.circle,
                border: Border.all(color: primaryColor.withValues(alpha: 0.25), width: 2),
              ),
              child: Center(
                child: Icon(
                  isSuspended ? Icons.block_rounded : Icons.lock_clock_rounded,
                  color: primaryColor,
                  size: 38,
                ),
              ),
            ),
            const SizedBox(height: 18),

            // Title
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: AppColors.textPrimary,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 10),

            // Expiry Date Badge if available
            if (formattedDate != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: primaryColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'Expired on: $formattedDate',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: primaryColor,
                  ),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Message Body
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: AppColors.cardBorder),
              ),
              child: Text(
                message.isNotEmpty
                    ? message
                    : 'Your company’s CRM subscription has expired. API calls are restricted. Please contact your company administrator or support team to renew the plan.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 13.5,
                  height: 1.45,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            const SizedBox(height: 22),

            // Support Note
            const Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.headset_mic_outlined, size: 16, color: AppColors.textSecondary),
                SizedBox(width: 6),
                Text(
                  'Need help? Contact your company admin',
                  style: TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Logout / Dismiss Button
            CustomButton(
              text: 'Logout from App',
              icon: Icons.logout_rounded,
              backgroundColor: AppColors.textPrimary,
              onPressed: () async {
                Navigator.of(context, rootNavigator: true).pop();
                await ref.read(currentUserProvider.notifier).logout();
                invalidateAllAppProvidersFromWidget(ref);
                if (context.mounted) {
                  context.go('/login');
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}
