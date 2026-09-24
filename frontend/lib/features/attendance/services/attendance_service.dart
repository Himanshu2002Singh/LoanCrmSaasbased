import 'package:capital_care/core/constants/api_constants.dart';
import 'package:capital_care/core/networking/api_client.dart';
import 'package:capital_care/features/attendance/models/attendance_model.dart';

class AttendanceService {
  Future<AttendanceModel?> getTodayStatus() async {
    try {
      final response = await ApiClient.get(ApiConstants.attendanceToday);
      final data = response['data'] ?? response['attendance'] ?? response;
      if (data == null || (data is Map && data.isEmpty)) return null;
      return AttendanceModel.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      return null;
    }
  }

  Future<AttendanceModel> checkIn({required double lat, required double lng, String? remark}) async {
    final response = await ApiClient.post(
      ApiConstants.checkIn,
      body: {
        'lat': lat,
        'lng': lng,
        if (remark != null) 'remark': remark,
      },
    );
    final data = response['data'] ?? response['attendance'] ?? response;
    return AttendanceModel.fromJson(data as Map<String, dynamic>);
  }

  Future<AttendanceModel> checkOut({required double lat, required double lng}) async {
    final response = await ApiClient.put(
      ApiConstants.checkOut,
      body: {
        'lat': lat,
        'lng': lng,
      },
    );
    final data = response['data'] ?? response['attendance'] ?? response;
    return AttendanceModel.fromJson(data as Map<String, dynamic>);
  }

  Future<List<AttendanceModel>> getAttendanceHistory({int page = 1, int limit = 30, String? fromDate, String? toDate}) async {
    final query = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (fromDate != null) query['fromDate'] = fromDate;
    if (toDate != null) query['toDate'] = toDate;

    final response = await ApiClient.get(
      ApiConstants.attendance,
      queryParameters: query,
    );

    final rawList = response['data'] ?? response['rows'] ?? (response is List ? response : []);
    final rows = (rawList as List<dynamic>)
        .map((e) => AttendanceModel.fromJson(e as Map<String, dynamic>))
        .toList();

    return rows;
  }

  Future<AttendanceSummaryModel> getAttendanceSummary() async {
    try {
      final response = await ApiClient.get(ApiConstants.attendanceSummary);
      final data = response['data'] ?? response['summary'] ?? response;
      return AttendanceSummaryModel.fromJson(data as Map<String, dynamic>);
    } catch (_) {
      return AttendanceSummaryModel();
    }
  }
}
