import 'package:flutter_test/flutter_test.dart';
import 'package:capital_care/features/auth/models/user_model.dart';
import 'package:capital_care/features/leads/models/lead_model.dart';
import 'package:capital_care/features/telecalling/models/call_log_model.dart';
import 'package:capital_care/features/tasks_and_followups/models/task_model.dart';
import 'package:capital_care/features/attendance/models/attendance_model.dart';
import 'package:capital_care/features/applications/models/application_model.dart';

void main() {
  group('CRM Models Serialization Tests', () {
    test('UserModel parse test', () {
      final json = {
        'id': 1,
        'name': 'Rahul Sharma',
        'email': 'rahul@capitalcare.com',
        'role': 'EMPLOYEE',
        'status': 'active',
        'company': {'id': 1, 'name': 'CapitalCare', 'slug': 'capitalcare'},
        'branch': {'id': 1, 'name': 'Jaipur HQ', 'office_lat': 26.9124, 'office_lng': 75.7873, 'geo_radius_meters': 250},
      };

      final user = UserModel.fromJson(json);
      expect(user.id, 1);
      expect(user.name, 'Rahul Sharma');
      expect(user.role, 'EMPLOYEE');
      expect(user.isCaller, true);
      expect(user.branch?.geoRadiusMeters, 250);
      expect(user.branch?.officeLat, 26.9124);
    });

    test('LeadModel parse test', () {
      final json = {
        'lead_id': 101,
        'name': 'Amit Verma',
        'number': '9876543210',
        'loan_type': 'Personal Loan',
        'est_budget': 500000,
        'status': 'FRESH',
        'priority': 'HIGH',
      };

      final lead = LeadModel.fromJson(json);
      expect(lead.id, 101);
      expect(lead.name, 'Amit Verma');
      expect(lead.number, '9876543210');
      expect(lead.loanType, 'Personal Loan');
      expect(lead.estBudget, 500000);
      expect(lead.priority, 'HIGH');
    });

    test('CallLogModel duration formatting test', () {
      final json = {
        'call_id': 55,
        'lead_id': 101,
        'call_status': 'CONNECTED',
        'duration': 125,
        'remarks': 'Customer agreed for home loan documents',
      };

      final call = CallLogModel.fromJson(json);
      expect(call.id, 55);
      expect(call.callStatus, 'CONNECTED');
      expect(call.duration, 125);
      expect(call.formattedDuration, '2m 05s');
    });

    test('TaskModel & AttendanceModel test', () {
      final taskJson = {
        'task_id': 12,
        'title': 'Collect KYC Documents',
        'priority': 'HIGH',
        'status': 'PENDING',
      };
      final task = TaskModel.fromJson(taskJson);
      expect(task.title, 'Collect KYC Documents');
      expect(task.isCompleted, false);

      final attJson = {
        'attendance_id': 99,
        'date': '2026-09-14',
        'check_in_time': '2026-09-14T09:30:00.000Z',
        'check_out_time': '2026-09-14T18:00:00.000Z',
        'working_hours': 8.5,
        'status': 'PRESENT',
      };
      final att = AttendanceModel.fromJson(attJson);
      expect(att.status, 'PRESENT');
      expect(att.workingHours, 8.5);
      expect(att.formattedCheckIn, isNotEmpty);
      expect(att.formattedCheckOut, isNotEmpty);

      final summaryJson = {
        'daysMarked': 18,
        'totalHours': 144.0,
        'PRESENT': 15,
        'LATE': 2,
        'HALF_DAY': 1,
        'ABSENT': 0,
      };
      final summary = AttendanceSummaryModel.fromJson(summaryJson);
      expect(summary.totalDays, 18);
      expect(summary.presentDays, 15);
      expect(summary.lateDays, 2);
      expect(summary.halfDays, 1);
      expect(summary.absentDays, 0);
      expect(summary.totalWorkingHours, 144.0);
    });

    test('LeadModel formattedAmount test', () {
      final lead1 = LeadModel(id: 1, name: 'A', number: '123', status: 'FRESH', statusValue: 'FRESH', estBudget: 5000000);
      expect(lead1.formattedAmount, '₹50.00 L');

      final lead2 = LeadModel(id: 2, name: 'B', number: '456', status: 'FRESH', statusValue: 'FRESH', estBudget: 15000000);
      expect(lead2.formattedAmount, '₹1.50 Cr');
    });

    test('ApplicationModel parse test', () {
      final appJson = {
        'id': 1,
        'applicationNumber': 'APP-2026-0001',
        'loanProduct': 'Home Loan',
        'appliedAmount': 2500000,
        'status': 'UNDER_REVIEW',
      };
      final app = ApplicationModel.fromJson(appJson);
      expect(app.applicationNumber, 'APP-2026-0001');
      expect(app.appliedAmount, 2500000);
      expect(app.status, 'UNDER_REVIEW');
    });
  });
}
