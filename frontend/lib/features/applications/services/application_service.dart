import 'package:capital_care/core/constants/api_constants.dart';
import 'package:capital_care/core/networking/api_client.dart';
import 'package:capital_care/features/applications/models/application_model.dart';

class ApplicationsResponse {
  final List<ApplicationModel> applications;
  final int totalItems;
  final int totalPages;

  ApplicationsResponse({required this.applications, required this.totalItems, required this.totalPages});
}

class ApplicationService {
  Future<ApplicationsResponse> getApplications({
    int page = 1,
    int limit = 25,
    String? status,
    String? search,
  }) async {
    final query = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (status != null && status.isNotEmpty && status != 'ALL') query['status'] = status;
    if (search != null && search.isNotEmpty) query['search'] = search;

    final response = await ApiClient.get(
      ApiConstants.applications,
      queryParameters: query,
    );

    final rows = (response['rows'] as List<dynamic>? ?? response['applications'] as List<dynamic>? ?? [])
        .map((e) => ApplicationModel.fromJson(e as Map<String, dynamic>))
        .toList();

    final pagination = response['pagination'] as Map<String, dynamic>? ?? {};
    final totalItems = pagination['totalItems'] ?? pagination['total'] ?? rows.length;
    final totalPages = pagination['totalPages'] ?? pagination['pages'] ?? 1;

    return ApplicationsResponse(
      applications: rows,
      totalItems: totalItems is int ? totalItems : int.tryParse(totalItems.toString()) ?? rows.length,
      totalPages: totalPages is int ? totalPages : int.tryParse(totalPages.toString()) ?? 1,
    );
  }

  Future<ApplicationModel> createApplication(Map<String, dynamic> data) async {
    final response = await ApiClient.post(
      ApiConstants.applications,
      body: data,
    );
    final appData = response['application'] ?? response['data'] ?? response;
    return ApplicationModel.fromJson(appData as Map<String, dynamic>);
  }

  Future<ApplicationModel> updateStatus(int id, String status, {String? rejectionReason}) async {
    final response = await ApiClient.patch(
      '${ApiConstants.applications}/$id/status',
      body: {
        'status': status,
        if (rejectionReason != null) 'rejectionReason': rejectionReason,
      },
    );
    final appData = response['application'] ?? response['data'] ?? response;
    return ApplicationModel.fromJson(appData as Map<String, dynamic>);
  }
}
