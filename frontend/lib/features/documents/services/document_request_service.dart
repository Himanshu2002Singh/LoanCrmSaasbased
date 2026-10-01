import 'package:capital_care/core/constants/api_constants.dart';
import 'package:capital_care/core/networking/api_client.dart';
import 'package:capital_care/features/documents/models/document_request_model.dart';

class DocumentRequestService {
  Future<DocConfigResponse> getConfigDocs() async {
    final response = await ApiClient.get(ApiConstants.documentRequestConfigDocs);
    if (response is Map<String, dynamic>) {
      return DocConfigResponse.fromJson(response);
    }
    return const DocConfigResponse(presets: {}, masterDocs: []);
  }

  Future<LeadDocumentRequestModel> createDocumentRequest({
    required int leadId,
    String? title,
    required List<DocRequirementItem> requiredDocs,
    int expiryDays = 7,
    String? customMessage,
  }) async {
    final payload = {
      'leadId': leadId,
      if (title != null && title.trim().isNotEmpty) 'title': title.trim(),
      'requiredDocs': requiredDocs.map((d) => d.toJson()).toList(),
      'expiryDays': expiryDays,
      if (customMessage != null && customMessage.trim().isNotEmpty)
        'customMessage': customMessage.trim(),
    };

    final response = await ApiClient.post(
      ApiConstants.documentRequests,
      body: payload,
    );

    final data = response['data'] ?? response;
    return LeadDocumentRequestModel.fromJson(data as Map<String, dynamic>);
  }

  Future<List<LeadDocumentRequestModel>> getRequestsByLead(int leadId) async {
    final response = await ApiClient.get(ApiConstants.documentRequestsByLead(leadId));
    final rawList = response['data'] ?? (response is List ? response : []);
    if (rawList is List) {
      return rawList
          .map((e) => LeadDocumentRequestModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<void> cancelDocumentRequest(int id) async {
    await ApiClient.patch(ApiConstants.cancelDocumentRequest(id));
  }
}
