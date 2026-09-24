import 'package:capital_care/core/constants/api_constants.dart';
import 'package:capital_care/core/networking/api_client.dart';
import 'package:capital_care/features/dashboard/models/dashboard_stats_model.dart';

class DashboardService {
  Future<DashboardData> getDashboardData({
    String? fromDate,
    String? toDate,
    int? employeeId,
  }) async {
    final queryParams = <String, String>{};
    if (fromDate != null && fromDate.isNotEmpty) queryParams['fromDate'] = fromDate;
    if (toDate != null && toDate.isNotEmpty) queryParams['toDate'] = toDate;
    if (employeeId != null) queryParams['employeeId'] = employeeId.toString();

    final response = await ApiClient.get(
      ApiConstants.dashboardReport,
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
    );

    return DashboardData.fromJson(response);
  }
}
