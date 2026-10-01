import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:capital_care/features/documents/models/document_model.dart';
import 'package:capital_care/features/documents/models/document_request_model.dart';
import 'package:capital_care/features/documents/services/document_service.dart';
import 'package:capital_care/features/documents/services/document_request_service.dart';

final documentServiceProvider = Provider<DocumentService>((ref) => DocumentService());
final documentRequestServiceProvider = Provider<DocumentRequestService>((ref) => DocumentRequestService());

final documentConfigDocsProvider = FutureProvider<DocConfigResponse>((ref) async {
  final service = ref.read(documentRequestServiceProvider);
  return service.getConfigDocs();
});

final leadDocumentRequestsProvider =
    FutureProvider.family<List<LeadDocumentRequestModel>, int>((ref, leadId) async {
  final service = ref.read(documentRequestServiceProvider);
  return service.getRequestsByLead(leadId);
});

final leadUploadedDocumentsProvider =
    FutureProvider.family<List<DocumentModel>, int>((ref, leadId) async {
  final service = ref.read(documentServiceProvider);
  return service.getDocumentsByLead(leadId);
});
