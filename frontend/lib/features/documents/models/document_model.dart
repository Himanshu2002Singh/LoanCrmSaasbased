class DocumentModel {
  final int id;
  final int? leadId;
  final int? customerId;
  final String docType;
  final String fileName;
  final String fileUrl;
  final String? mimeType;
  final int? fileSize;
  final String status;
  final String? remarks;
  final DateTime? createdAt;

  DocumentModel({
    required this.id,
    this.leadId,
    this.customerId,
    required this.docType,
    required this.fileName,
    required this.fileUrl,
    this.mimeType,
    this.fileSize,
    this.status = 'PENDING',
    this.remarks,
    this.createdAt,
  });

  factory DocumentModel.fromJson(Map<String, dynamic> json) {
    return DocumentModel(
      id: json['id'] ?? json['document_id'] ?? 0,
      leadId: json['leadId'] ?? json['lead_id'],
      customerId: json['customerId'] ?? json['customer_id'],
      docType: json['docType'] ?? json['doc_type'] ?? 'OTHER',
      fileName: json['fileName'] ?? json['file_name'] ?? 'Document',
      fileUrl: json['fileUrl'] ?? json['file_url'] ?? '',
      mimeType: json['mimeType'] ?? json['mime_type'],
      fileSize: json['fileSize'] ?? json['file_size'],
      status: json['status'] ?? 'PENDING',
      remarks: json['remarks'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'lead_id': leadId,
    'customer_id': customerId,
    'doc_type': docType,
    'file_name': fileName,
    'file_url': fileUrl,
    'status': status,
  };
}
