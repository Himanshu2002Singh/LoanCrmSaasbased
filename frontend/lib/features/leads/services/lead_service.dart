import 'package:capital_care/core/constants/api_constants.dart';
import 'package:capital_care/core/networking/api_client.dart';
import 'package:capital_care/features/leads/models/lead_model.dart';
import 'package:capital_care/features/leads/models/lead_status_model.dart';
import 'package:capital_care/features/leads/models/master_config_model.dart';
import 'package:capital_care/features/leads/models/template_model.dart';

class LeadsResponse {
  final List<LeadModel> leads;
  final int totalItems;
  final int totalPages;
  final int currentPage;

  LeadsResponse({
    required this.leads,
    required this.totalItems,
    required this.totalPages,
    required this.currentPage,
  });
}

class LeadService {
  Future<LeadsResponse> getLeads({
    int page = 1,
    int limit = 25,
    String? search,
    String? status,
    String? loanType,
    String? priority,
    String? sortBy,
    String? sortDir,
    bool? unassigned,
    String? fromDate,
    String? toDate,
  }) async {
    final query = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (search != null && search.isNotEmpty) query['search'] = search;
    if (status != null && status.isNotEmpty && status != 'ALL') query['status'] = status;
    if (loanType != null && loanType.isNotEmpty) query['loanType'] = loanType;
    if (priority != null && priority.isNotEmpty) query['priority'] = priority;
    if (sortBy != null) query['sortBy'] = sortBy;
    if (sortDir != null) query['sortDir'] = sortDir;
    if (unassigned == true) query['unassigned'] = 'true';
    if (fromDate != null) query['fromDate'] = fromDate;
    if (toDate != null) query['toDate'] = toDate;

    final response = await ApiClient.get(
      ApiConstants.leads,
      queryParameters: query,
    );

    final rows = (response['rows'] as List<dynamic>? ?? response['data'] as List<dynamic>? ?? [])
        .map((e) => LeadModel.fromJson(e as Map<String, dynamic>))
        .toList();

    final pagination = response['pagination'] as Map<String, dynamic>? ?? {};
    final totalItems = pagination['totalItems'] ?? pagination['total'] ?? rows.length;
    final totalPages = pagination['totalPages'] ?? pagination['pages'] ?? 1;
    final currentPage = pagination['page'] ?? pagination['currentPage'] ?? page;

    return LeadsResponse(
      leads: rows,
      totalItems: totalItems is int ? totalItems : int.tryParse(totalItems.toString()) ?? rows.length,
      totalPages: totalPages is int ? totalPages : int.tryParse(totalPages.toString()) ?? 1,
      currentPage: currentPage is int ? currentPage : int.tryParse(currentPage.toString()) ?? page,
    );
  }

  Future<List<LeadStatusModel>> getLeadStatuses({String? team}) async {
    final query = <String, dynamic>{};
    if (team != null && team.isNotEmpty) query['team'] = team;
    final response = await ApiClient.get(ApiConstants.leadStatuses, queryParameters: query.isNotEmpty ? query : null);
    final list = response['statuses'] as List<dynamic>? ?? [];
    return list.map((e) => LeadStatusModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<MasterConfigModel>> getMasterConfigs(String configType) async {
    final response = await ApiClient.get('${ApiConstants.masterConfigs}/$configType');
    final list = (response['data'] as List<dynamic>?) ?? [];
    return list.map((e) => MasterConfigModel.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<LeadModel> getLeadById(int leadId) async {
    final response = await ApiClient.get('${ApiConstants.leads}/$leadId');
    final data = response['data'] ?? response;
    return LeadModel.fromJson(data as Map<String, dynamic>);
  }

  Future<LeadModel> createLead(Map<String, dynamic> data) async {
    final response = await ApiClient.post(
      ApiConstants.leads,
      body: data,
    );
    final leadData = response['data'] ?? response['lead'] ?? response;
    return LeadModel.fromJson(leadData as Map<String, dynamic>);
  }

  Future<LeadModel> updateLead(int leadId, Map<String, dynamic> data) async {
    final response = await ApiClient.put(
      '${ApiConstants.leads}/$leadId',
      body: data,
    );
    final leadData = response['data'] ?? response['lead'] ?? response;
    return LeadModel.fromJson(leadData as Map<String, dynamic>);
  }

  Future<LeadModel> updateLeadStatus(
    int leadId, {
    required String status,
    String? remarks,
    String? nextMeeting,
  }) async {
    final body = <String, dynamic>{
      'status': status,
    };
    if (remarks != null && remarks.isNotEmpty) body['remarks'] = remarks;
    if (nextMeeting != null && nextMeeting.isNotEmpty) body['next_meeting'] = nextMeeting;

    final response = await ApiClient.patch(
      '${ApiConstants.leads}/$leadId/status',
      body: body,
    );
    final leadData = response['data'] ?? response['lead'] ?? response;
    return LeadModel.fromJson(leadData as Map<String, dynamic>);
  }

  Future<LeadModel> assignLead(int leadId, int employeeId) async {
    final response = await ApiClient.patch(
      '${ApiConstants.leads}/$leadId/assign',
      body: {'assignedEmployeeId': employeeId},
    );
    final leadData = response['data'] ?? response['lead'] ?? response;
    return LeadModel.fromJson(leadData as Map<String, dynamic>);
  }

  Future<List<TemplateModel>> getTemplates() async {
    final response = await ApiClient.get(
      ApiConstants.templates,
      queryParameters: {'limit': '200'},
    );
    final list = response['data'] as List<dynamic>? ??
        response['templates'] as List<dynamic>? ??
        (response is List ? response : []);
    return list
        .map((e) => TemplateModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
