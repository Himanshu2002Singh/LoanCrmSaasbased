import 'package:flutter/material.dart';

class AppColors {
  // Brand & Primary
  static const Color primary = Color(0xFF0F172A); // Dark Slate
  static const Color primaryLight = Color(0xFF1E293B);
  static const Color primaryDark = Color(0xFF020617);
  static const Color primarySurface = Color(0xFFF1F5F9);
  static const Color secondary = Color(0xFF2563EB); // Royal Blue
  static const Color secondaryLight = Color(0xFF3B82F6);
  static const Color accent = Color(0xFF10B981); // Emerald Green
  static const Color accentLight = Color(0xFF34D399);

  // Backgrounds & Surfaces
  static const Color background = Color(0xFFF8FAFC);
  static const Color surface = Colors.white;
  static const Color cardBackground = Colors.white;
  static const Color cardBorder = Color(0xFFE2E8F0);
  static const Color border = Color(0xFFE2E8F0);
  static const Color inputBorder = Color(0xFFCBD5E1);
  static const Color divider = Color(0xFFF1F5F9);
  static const Color successSurface = Color(0xFFECFDF5);
  static const Color errorSurface = Color(0xFFFEF2F2);

  // Text Colors
  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF64748B);
  static const Color textMuted = Color(0xFF94A3B8);

  // Status & Badge Colors
  static const Color success = Color(0xFF10B981);
  static const Color successBg = Color(0xFFECFDF5);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningBg = Color(0xFFFFFBEB);
  static const Color error = Color(0xFFEF4444);
  static const Color errorBg = Color(0xFFFEF2F2);
  static const Color info = Color(0xFF3B82F6);
  static const Color infoBg = Color(0xFFEFF6FF);
  static const Color purple = Color(0xFF8B5CF6);
  static const Color purpleBg = Color(0xFFF5F3FF);

  // Status mappings
  static Color getStatusColor(String status) {
    final s = status.toUpperCase();
    if (s.contains('NEW') || s.contains('FRESH')) return info;
    if (s.contains('FOLLOW') || s.contains('CALL_BACK') || s.contains('PENDING')) return warning;
    if (s.contains('INTERESTED') || s.contains('QUALIFIED') || s.contains('VERIFIED') || s.contains('SANCTIONED') || s.contains('DISBURSED') || s.contains('PRESENT')) return success;
    if (s.contains('REJECT') || s.contains('CANCEL') || s.contains('ABSENT') || s.contains('WRONG')) return error;
    if (s.contains('OPS') || s.contains('BANKER') || s.contains('REVIEW')) return purple;
    return textSecondary;
  }

  static Color getStatusBgColor(String status) {
    final s = status.toUpperCase();
    if (s.contains('NEW') || s.contains('FRESH')) return infoBg;
    if (s.contains('FOLLOW') || s.contains('CALL_BACK') || s.contains('PENDING')) return warningBg;
    if (s.contains('INTERESTED') || s.contains('QUALIFIED') || s.contains('VERIFIED') || s.contains('SANCTIONED') || s.contains('DISBURSED') || s.contains('PRESENT')) return successBg;
    if (s.contains('REJECT') || s.contains('CANCEL') || s.contains('ABSENT') || s.contains('WRONG')) return errorBg;
    if (s.contains('OPS') || s.contains('BANKER') || s.contains('REVIEW')) return purpleBg;
    return const Color(0xFFF1F5F9);
  }
}
