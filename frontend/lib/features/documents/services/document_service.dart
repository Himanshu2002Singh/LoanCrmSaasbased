import 'package:capital_care/core/constants/api_constants.dart';
import 'package:capital_care/core/networking/api_client.dart';
import 'package:capital_care/features/documents/models/document_model.dart';

class DocumentService {
  Future<DocumentModel> uploadDocument({
    required int leadId,
    required String docType,
    required String filePath,
    String? remarks,
  }) async {
    final fields = <String, String>{
      'leadId': leadId.toString(),
      'docType': docType,
      if (remarks != null) 'remarks': remarks,
    };

    final response = await ApiClient.uploadFile(
      ApiConstants.documents,
      filePath: filePath,
      fileFieldName: 'file',
      fields: fields,
    );

    final data = response['document'] ?? response['data'] ?? response;
    return DocumentModel.fromJson(data as Map<String, dynamic>);
  }

  Future<List<DocumentModel>> getDocumentsByLead(int leadId) async {
    final response = await ApiClient.get(
      ApiConstants.documents,
      queryParameters: {'leadId': leadId.toString()},
    );
    final rows = (response['rows'] as List<dynamic>? ?? response['documents'] as List<dynamic>? ?? [])
        .map((e) => DocumentModel.fromJson(e as Map<String, dynamic>))
        .toList();
    return rows;
  }
}
