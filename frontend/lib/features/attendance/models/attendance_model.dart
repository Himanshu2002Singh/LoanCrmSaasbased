import 'package:intl/intl.dart';

class AttendanceModel {
  final int id;
  final int? empId;
  final String? employee;
  final String date;
  final String? checkInTime;
  final String? checkOutTime;
  final double? checkInLat;
  final double? checkInLng;
  final double? checkOutLat;
  final double? checkOutLng;
  final double workingHours;
  final String status;
  final bool isManualOverride;
  final String? overrideReason;
  final DateTime? createdAt;

  AttendanceModel({
    required this.id,
    this.empId,
    this.employee,
    required this.date,
    this.checkInTime,
    this.checkOutTime,
    this.checkInLat,
    this.checkInLng,
    this.checkOutLat,
    this.checkOutLng,
    this.workingHours = 0.0,
    this.status = 'PRESENT',
    this.isManualOverride = false,
    this.overrideReason,
    this.createdAt,
  });

  String get formattedCheckIn {
    if (checkInTime == null || checkInTime!.isEmpty) return '--:--';
    try {
      final dt = DateTime.parse(checkInTime!).toLocal();
      return DateFormat('hh:mm a').format(dt);
    } catch (_) {
      return checkInTime!;
    }
  }

  String get formattedCheckOut {
    if (checkOutTime == null || checkOutTime!.isEmpty) return '--:--';
    try {
      final dt = DateTime.parse(checkOutTime!).toLocal();
      return DateFormat('hh:mm a').format(dt);
    } catch (_) {
      return checkOutTime!;
    }
  }

  bool get isLate => status.toUpperCase() == 'LATE';
  bool get isPresent => status.toUpperCase() == 'PRESENT';
  bool get isHalfDay => status.toUpperCase() == 'HALF_DAY';
  bool get isAbsent => status.toUpperCase() == 'ABSENT';

  DateTime? get parsedDate => DateTime.tryParse(date);

  String get formattedDateLong {
    try {
      final d = DateTime.parse(date);
      return DateFormat('EEEE, dd MMM yyyy').format(d);
    } catch (_) {
      return date;
    }
  }

  String get formattedWorkingDuration {
    if (workingHours <= 0) return '0h';
    final h = workingHours.floor();
    final m = ((workingHours - h) * 60).round();
    if (m == 0) return '${h}h';
    return '${h}h ${m}m';
  }

  factory AttendanceModel.fromJson(Map<String, dynamic> json) {
    return AttendanceModel(
      id: json['attendance_id'] ?? json['id'] ?? 0,
      empId: json['emp_id'] ?? json['userId'],
      employee: json['employee'] ?? json['user']?['name'],
      date: json['date'] ?? '',
      checkInTime: json['check_in_time'] ?? json['checkInTime'],
      checkOutTime: json['check_out_time'] ?? json['checkOutTime'],
      checkInLat: json['check_in_lat'] != null ? double.tryParse(json['check_in_lat'].toString()) : (json['checkInLat'] != null ? double.tryParse(json['checkInLat'].toString()) : null),
      checkInLng: json['check_in_lng'] != null ? double.tryParse(json['check_in_lng'].toString()) : (json['checkInLng'] != null ? double.tryParse(json['checkInLng'].toString()) : null),
      checkOutLat: json['check_out_lat'] != null ? double.tryParse(json['check_out_lat'].toString()) : (json['checkOutLat'] != null ? double.tryParse(json['checkOutLat'].toString()) : null),
      checkOutLng: json['check_out_lng'] != null ? double.tryParse(json['check_out_lng'].toString()) : (json['checkOutLng'] != null ? double.tryParse(json['checkOutLng'].toString()) : null),
      workingHours: json['working_hours'] != null ? double.tryParse(json['working_hours'].toString()) ?? 0.0 : (json['workingHours'] != null ? double.tryParse(json['workingHours'].toString()) ?? 0.0 : 0.0),
      status: json['status'] ?? 'PRESENT',
      isManualOverride: json['is_manual_override'] ?? json['isManualOverride'] ?? false,
      overrideReason: json['override_reason'] ?? json['overrideReason'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'emp_id': empId,
    'employee': employee,
    'date': date,
    'check_in_time': checkInTime,
    'check_out_time': checkOutTime,
    'working_hours': workingHours,
    'status': status,
  };
}

class AttendanceSummaryModel {
  final int totalDays;
  final int presentDays;
  final int lateDays;
  final int halfDays;
  final int absentDays;
  final double totalWorkingHours;

  AttendanceSummaryModel({
    this.totalDays = 0,
    this.presentDays = 0,
    this.lateDays = 0,
    this.halfDays = 0,
    this.absentDays = 0,
    this.totalWorkingHours = 0.0,
  });

  factory AttendanceSummaryModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return AttendanceSummaryModel();
    return AttendanceSummaryModel(
      totalDays: json['daysMarked'] ?? json['totalDays'] ?? json['days'] ?? 0,
      presentDays: json['PRESENT'] ?? json['presentDays'] ?? json['present'] ?? 0,
      lateDays: json['LATE'] ?? json['lateDays'] ?? json['late'] ?? 0,
      halfDays: json['HALF_DAY'] ?? json['halfDays'] ?? json['halfDay'] ?? 0,
      absentDays: json['ABSENT'] ?? json['absentDays'] ?? json['absent'] ?? 0,
      totalWorkingHours: json['totalHours'] != null
          ? double.tryParse(json['totalHours'].toString()) ?? 0.0
          : (json['totalWorkingHours'] != null
              ? double.tryParse(json['totalWorkingHours'].toString()) ?? 0.0
              : 0.0),
    );
  }
}
