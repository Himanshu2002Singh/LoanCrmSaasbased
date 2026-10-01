class DocRequirementItem {
  final String id;
  final String title;
  final String docType;
  final String category;
  final bool isRequired;
  final String description;
  final String status; // PENDING, UPLOADED
  final int? documentId;
  final String? fileName;
  final String? fileUrl;
  final int? fileSize;
  final DateTime? uploadedAt;

  const DocRequirementItem({
    required this.id,
    required this.title,
    required this.docType,
    this.category = 'KYC',
    this.isRequired = true,
    this.description = '',
    this.status = 'PENDING',
    this.documentId,
    this.fileName,
    this.fileUrl,
    this.fileSize,
    this.uploadedAt,
  });

  bool get isUploaded => status.toUpperCase() == 'UPLOADED';

  DocRequirementItem copyWith({
    String? id,
    String? title,
    String? docType,
    String? category,
    bool? isRequired,
    String? description,
    String? status,
    int? documentId,
    String? fileName,
    String? fileUrl,
    int? fileSize,
    DateTime? uploadedAt,
  }) {
    return DocRequirementItem(
      id: id ?? this.id,
      title: title ?? this.title,
      docType: docType ?? this.docType,
      category: category ?? this.category,
      isRequired: isRequired ?? this.isRequired,
      description: description ?? this.description,
      status: status ?? this.status,
      documentId: documentId ?? this.documentId,
      fileName: fileName ?? this.fileName,
      fileUrl: fileUrl ?? this.fileUrl,
      fileSize: fileSize ?? this.fileSize,
      uploadedAt: uploadedAt ?? this.uploadedAt,
    );
  }

  factory DocRequirementItem.fromJson(Map<String, dynamic> json) {
    return DocRequirementItem(
      id: json['id']?.toString() ?? 'doc_${DateTime.now().millisecondsSinceEpoch}',
      title: json['title']?.toString() ?? json['docType']?.toString() ?? 'Document',
      docType: (json['docType']?.toString() ?? 'OTHER').toUpperCase(),
      category: json['category']?.toString() ?? 'KYC',
      isRequired: json['isRequired'] != false,
      description: json['description']?.toString() ?? '',
      status: (json['status']?.toString() ?? 'PENDING').toUpperCase(),
      documentId: json['documentId'] != null ? int.tryParse(json['documentId'].toString()) : null,
      fileName: json['fileName']?.toString(),
      fileUrl: json['fileUrl']?.toString(),
      fileSize: json['fileSize'] != null ? int.tryParse(json['fileSize'].toString()) : null,
      uploadedAt: json['uploadedAt'] != null ? DateTime.tryParse(json['uploadedAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'docType': docType,
      'category': category,
      'isRequired': isRequired,
      'description': description,
      'status': status,
      if (documentId != null) 'documentId': documentId,
      if (fileName != null) 'fileName': fileName,
      if (fileUrl != null) 'fileUrl': fileUrl,
      if (fileSize != null) 'fileSize': fileSize,
      if (uploadedAt != null) 'uploadedAt': uploadedAt?.toIso8601String(),
    };
  }
}

class DocConfigResponse {
  final Map<String, List<DocRequirementItem>> presets;
  final List<DocRequirementItem> masterDocs;

  const DocConfigResponse({
    required this.presets,
    required this.masterDocs,
  });

  factory DocConfigResponse.fromJson(Map<String, dynamic> json) {
    final rawPresets = json['presets'] as Map<String, dynamic>? ?? {};
    final presetsMap = <String, List<DocRequirementItem>>{};

    rawPresets.forEach((key, val) {
      if (val is List) {
        presetsMap[key] = val
            .map((e) => DocRequirementItem.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    });

    final rawMaster = json['masterDocs'] as List<dynamic>? ?? [];
    final masterList = rawMaster
        .map((e) => DocRequirementItem.fromJson(e as Map<String, dynamic>))
        .toList();

    return DocConfigResponse(
      presets: presetsMap,
      masterDocs: masterList,
    );
  }
}

class LeadDocumentRequestModel {
  final int id;
  final int? companyId;
  final int leadId;
  final String token;
  final String title;
  final List<DocRequirementItem> requiredDocs;
  final String status; // PENDING, PARTIALLY_UPLOADED, COMPLETED, CANCELLED, EXPIRED
  final DateTime? expiresAt;
  final int? createdById;
  final String? creatorName;
  final String? customMessage;
  final String? customerNotes;
  final int accessCount;
  final DateTime? createdAt;
  final DateTime? completedAt;
  final bool isExpired;
  final int totalDocs;
  final int uploadedDocs;
  final int requiredPending;
  final bool isCompleted;
  final String? uploadUrl;
  final String? whatsappMessageTemplate;
  final String? customerPhone;
  final String? customerName;

  const LeadDocumentRequestModel({
    required this.id,
    this.companyId,
    required this.leadId,
    required this.token,
    required this.title,
    this.requiredDocs = const [],
    required this.status,
    this.expiresAt,
    this.createdById,
    this.creatorName,
    this.customMessage,
    this.customerNotes,
    this.accessCount = 0,
    this.createdAt,
    this.completedAt,
    this.isExpired = false,
    this.totalDocs = 0,
    this.uploadedDocs = 0,
    this.requiredPending = 0,
    this.isCompleted = false,
    this.uploadUrl,
    this.whatsappMessageTemplate,
    this.customerPhone,
    this.customerName,
  });

  bool get isCancelled => status.toUpperCase() == 'CANCELLED';
  bool get isFullyUploaded => isCompleted || status.toUpperCase() == 'COMPLETED';

  double get progressRatio {
    if (totalDocs == 0) return 0.0;
    return (uploadedDocs / totalDocs).clamp(0.0, 1.0);
  }

  factory LeadDocumentRequestModel.fromJson(Map<String, dynamic> json) {
    final rawDocs = json['requiredDocs'] as List<dynamic>? ?? [];
    final docs = rawDocs
        .map((e) => DocRequirementItem.fromJson(e as Map<String, dynamic>))
        .toList();

    final now = DateTime.now();
    final expDate = json['expiresAt'] != null ? DateTime.tryParse(json['expiresAt'].toString()) : null;
    final expired = json['isExpired'] == true || (expDate != null && expDate.isBefore(now));

    final total = json['totalDocs'] != null ? int.tryParse(json['totalDocs'].toString()) ?? docs.length : docs.length;
    final uploaded = json['uploadedDocs'] != null
        ? int.tryParse(json['uploadedDocs'].toString()) ?? docs.where((d) => d.isUploaded).length
        : docs.where((d) => d.isUploaded).length;
    final reqPending = json['requiredPending'] != null
        ? int.tryParse(json['requiredPending'].toString()) ?? docs.where((d) => d.isRequired && !d.isUploaded).length
        : docs.where((d) => d.isRequired && !d.isUploaded).length;

    return LeadDocumentRequestModel(
      id: json['id'] != null ? int.tryParse(json['id'].toString()) ?? 0 : 0,
      companyId: json['companyId'] != null ? int.tryParse(json['companyId'].toString()) : null,
      leadId: json['leadId'] != null ? int.tryParse(json['leadId'].toString()) ?? 0 : 0,
      token: json['token']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Document Upload Request',
      requiredDocs: docs,
      status: json['status']?.toString() ?? 'PENDING',
      expiresAt: expDate,
      createdById: json['createdById'] != null ? int.tryParse(json['createdById'].toString()) : null,
      creatorName: json['creator']?['name']?.toString() ?? json['creatorName']?.toString(),
      customMessage: json['customMessage']?.toString(),
      customerNotes: json['customerNotes']?.toString(),
      accessCount: json['accessCount'] != null ? int.tryParse(json['accessCount'].toString()) ?? 0 : 0,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      completedAt: json['completedAt'] != null ? DateTime.tryParse(json['completedAt'].toString()) : null,
      isExpired: expired,
      totalDocs: total,
      uploadedDocs: uploaded,
      requiredPending: reqPending,
      isCompleted: json['isCompleted'] == true || (total > 0 && reqPending == 0),
      uploadUrl: json['uploadUrl']?.toString(),
      whatsappMessageTemplate: json['whatsappMessageTemplate']?.toString(),
      customerPhone: json['customerPhone']?.toString(),
      customerName: json['customerName']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'leadId': leadId,
      'token': token,
      'title': title,
      'requiredDocs': requiredDocs.map((d) => d.toJson()).toList(),
      'status': status,
      'expiresAt': expiresAt?.toIso8601String(),
      'createdById': createdById,
      'customMessage': customMessage,
      'customerNotes': customerNotes,
      'accessCount': accessCount,
      'createdAt': createdAt?.toIso8601String(),
      'completedAt': completedAt?.toIso8601String(),
    };
  }
}
