import 'dart:io';
import 'package:flutter/foundation.dart';

class ApiConstants {
  // Base URL with Android Emulator / iOS Simulator / Web fallback
  static String get baseUrl {
    if (kIsWeb) return 'http://localhost:5002/api';
    if (Platform.isAndroid) return 'http://192.168.1.2:5002/api';
    return 'http://localhost:5002/api';
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

  // Master Configurations & Notifications
  static String get masterConfigs => '$baseUrl/master-configs';
  static String get notifications => '$baseUrl/notifications';
  static String get users => '$baseUrl/users';
  static String get branches => '$baseUrl/branches';
}
