import 'package:capital_care/core/constants/api_constants.dart';
import 'package:capital_care/core/networking/api_client.dart';
import 'package:capital_care/features/telecalling/models/call_log_model.dart';

class CallsResponse {
  final List<CallLogModel> calls;
  final int totalItems;
  final int totalPages;
  final int currentPage;

  CallsResponse({
    required this.calls,
    required this.totalItems,
    required this.totalPages,
    required this.currentPage,
  });
}

class TelecallingService {
  Future<CallsResponse> getCalls({
    int page = 1,
    int limit = 25,
    String? callStatus,
    int? leadId,
    String? fromDate,
    String? toDate,
  }) async {
    final query = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (callStatus != null && callStatus.isNotEmpty && callStatus != 'ALL') {
      query['callStatus'] = callStatus;
    }
    if (leadId != null) query['leadId'] = leadId.toString();
    if (fromDate != null) query['fromDate'] = fromDate;
    if (toDate != null) query['toDate'] = toDate;

    final response = await ApiClient.get(
      ApiConstants.calls,
      queryParameters: query,
    );

    final rows = (response['rows'] as List<dynamic>? ?? response['data'] as List<dynamic>? ?? [])
        .map((e) => CallLogModel.fromJson(e as Map<String, dynamic>))
        .toList();

    final pagination = response['pagination'] as Map<String, dynamic>? ?? {};
    final totalItems = pagination['totalItems'] ?? pagination['total'] ?? rows.length;
    final totalPages = pagination['totalPages'] ?? pagination['pages'] ?? 1;

    return CallsResponse(
      calls: rows,
      totalItems: totalItems is int ? totalItems : int.tryParse(totalItems.toString()) ?? rows.length,
      totalPages: totalPages is int ? totalPages : int.tryParse(totalPages.toString()) ?? 1,
      currentPage: page,
    );
  }

  Future<CallLogModel> logCall(Map<String, dynamic> data) async {
    final response = await ApiClient.post(
      ApiConstants.calls,
      body: data,
    );
    final callData = response['data'] ?? response['call'] ?? response;
    return CallLogModel.fromJson(callData as Map<String, dynamic>);
  }
}
