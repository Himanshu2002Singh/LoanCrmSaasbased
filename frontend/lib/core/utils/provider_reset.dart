import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:capital_care/features/attendance/providers/attendance_provider.dart';
import 'package:capital_care/features/leads/providers/leads_provider.dart';
import 'package:capital_care/features/telecalling/providers/telecalling_provider.dart';
import 'package:capital_care/features/tasks_and_followups/providers/tasks_provider.dart';
import 'package:capital_care/features/applications/providers/application_provider.dart';
import 'package:capital_care/features/expenses/providers/expense_provider.dart';
import 'package:capital_care/features/notes/providers/note_provider.dart';
import 'package:capital_care/features/dashboard/providers/dashboard_provider.dart';
import 'package:capital_care/features/documents/providers/document_request_provider.dart';

/// Resets and invalidates all domain state providers across the app.
/// This ensures that when a user logs out and a new user logs in (or same user re-logs in),
/// no stale data (attendance, leads, tasks, followups, calls, expenses, notes, etc.)
/// is retained in memory.
void invalidateAllAppProviders(Ref ref) {
  _invalidateAll(ref.invalidate);
}

void invalidateAllAppProvidersFromWidget(WidgetRef ref) {
  _invalidateAll(ref.invalidate);
}

void _invalidateAll(void Function(ProviderOrFamily) invalidate) {
  // Attendance
  invalidate(attendanceStateProvider);

  // Leads & Master Configs
  invalidate(leadsNotifierProvider);
  invalidate(leadStatusesProvider);
  invalidate(loanProductsProvider);
  invalidate(leadSourcesProvider);
  invalidate(documentTypesProvider);

  // Telecalling & Calls
  invalidate(callsNotifierProvider);

  // Tasks & Followups
  invalidate(tasksNotifierProvider);
  invalidate(followUpsNotifierProvider);

  // Applications
  invalidate(applicationsNotifierProvider);

  // Expenses
  invalidate(expenseStateProvider);

  // Notes
  invalidate(notesProvider);
  invalidate(notesFilterProvider);

  // Dashboard & Documents
  invalidate(dashboardDataProvider);
  invalidate(documentConfigDocsProvider);
}
