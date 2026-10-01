import 'dart:io';
import 'package:flutter/foundation.dart';

class ApiConstants {
  // Base URL with Android Emulator / iOS Simulator / Web fallback
  static String get baseUrl {
    if (kIsWeb) return 'https://loancrm.trustingbrains.com/api';
    if (Platform.isAndroid) return 'https://loancrm.trustingbrains.com/api';
    return 'https://loancrm.trustingbrains.com/api';
  }

  // Auth Endpoints
  static String get login => '$baseUrl/auth/login';
  static String get me => '$baseUrl/auth/me';
  static String get changePassword => '$baseUrl/auth/change-password';

  // Dashboard & Reports
  static String get dashboardReport => '$baseUrl/reports/dashboard';
  static String get leadsReport => '$baseUrl/reports/leads';
  static String get performanceReport => '$baseUrl/reports/performance';

  // Leads & Statuses
  static String get leads => '$baseUrl/leads';
  static String get leadStatuses => '$baseUrl/lead-statuses';
  static String get customers => '$baseUrl/customers';

  // Telecalling & Follow-ups
  static String get calls => '$baseUrl/calls';
  static String get followups => '$baseUrl/followups';

  // Tasks
  static String get tasks => '$baseUrl/tasks';

  // Attendance
  static String get attendance => '$baseUrl/attendance';
  static String get attendanceToday => '$baseUrl/attendance/today';
  static String get attendanceSummary => '$baseUrl/attendance/summary';
  static String get checkIn => '$baseUrl/attendance/check-in';
  static String get checkOut => '$baseUrl/attendance/check-out';

  // Operations & Documents
  static String get documents => '$baseUrl/documents';
  static String get applications => '$baseUrl/applications';
  static String get lenders => '$baseUrl/lenders';
  static String get documentRequests => '$baseUrl/document-requests';
  static String get documentRequestConfigDocs => '$baseUrl/document-requests/config-docs';
  static String documentRequestsByLead(int leadId) => '$baseUrl/document-requests/lead/$leadId';
  static String cancelDocumentRequest(int id) => '$baseUrl/document-requests/$id/cancel';

  // Expenses & Claims
  static String get expenses => '$baseUrl/expenses';
  static String get expenseCategories => '$baseUrl/expenses/categories';
  static String get expenseSummary => '$baseUrl/expenses/summary';

  // Quick Notes & Scratchpad
  static String get notes => '$baseUrl/notes';
  static String get noteAssignableLeads => '$baseUrl/notes/my-leads';

  // Master Configurations, Templates & Notifications
  static String get masterConfigs => '$baseUrl/master-configs';
  static String get templates => '$baseUrl/templates';
  static String get notifications => '$baseUrl/notifications';
  static String get users => '$baseUrl/users';
  static String get branches => '$baseUrl/branches';

  /// Resolves relative or localhost URL to the active baseUrl server address
  static String getFullFileUrl(String? rawUrl) {
    if (rawUrl == null || rawUrl.trim().isEmpty) return '';
    final trimmed = rawUrl.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      try {
        final uri = Uri.parse(trimmed);
        if (uri.host == 'localhost' || uri.host == '127.0.0.1') {
          final baseUri = Uri.parse(baseUrl);
          final portStr = baseUri.hasPort ? ':${baseUri.port}' : '';
          return '${baseUri.scheme}://${baseUri.host}$portStr${uri.path}';
        }
        return trimmed;
      } catch (_) {
        return trimmed;
      }
    }
    final baseUri = Uri.parse(baseUrl);
    final origin = '${baseUri.scheme}://${baseUri.host}${baseUri.hasPort ? ':${baseUri.port}' : ''}';
    final path = trimmed.startsWith('/') ? trimmed : '/$trimmed';
    return '$origin$path';
  }
}
