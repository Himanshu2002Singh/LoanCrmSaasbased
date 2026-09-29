import 'package:capital_care/core/constants/api_constants.dart';

class TemplateModel {
  final int id;
  final String name;
  final String description;
  final String fileUrl;
  final String fileType;
  final String? uploader;
  final DateTime? createdAt;

  TemplateModel({
    required this.id,
    required this.name,
    required this.description,
    required this.fileUrl,
    required this.fileType,
    this.uploader,
    this.createdAt,
  });

  bool get hasFile => fileUrl.trim().isNotEmpty;
  bool get isTextOnly => fileUrl.trim().isEmpty;

  bool get isPdf =>
      hasFile &&
      (fileType.toLowerCase().contains('pdf') ||
          Uri.tryParse(fileUrl)?.path.toLowerCase().endsWith('.pdf') == true ||
          name.toLowerCase().endsWith('.pdf'));

  bool get isImage =>
      hasFile &&
      (fileType.toLowerCase().contains('image') ||
          fileType.toLowerCase().contains('png') ||
          fileType.toLowerCase().contains('jpg') ||
          fileType.toLowerCase().contains('jpeg') ||
          fileType.toLowerCase().contains('webp') ||
          fileUrl.toLowerCase().endsWith('.png') ||
          fileUrl.toLowerCase().endsWith('.jpg') ||
          fileUrl.toLowerCase().endsWith('.jpeg') ||
          fileUrl.toLowerCase().endsWith('.webp'));

  String get fullFileUrl => hasFile ? ApiConstants.getFullFileUrl(fileUrl) : '';

  factory TemplateModel.fromJson(Map<String, dynamic> json) {
    return TemplateModel(
      id:
          json['id'] is int
              ? json['id']
              : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      name: json['name'] ?? json['fileName'] ?? json['file_name'] ?? 'Template',
      description:
          json['description'] ??
          json['rejectionReason'] ??
          json['rejection_reason'] ??
          '',
      fileUrl: json['fileUrl'] ?? json['file_url'] ?? '',
      fileType: (json['fileType'] ?? json['file_type'] ?? 'image').toString(),
      uploader: json['uploader']?.toString(),
      createdAt:
          json['createdAt'] != null
              ? DateTime.tryParse(json['createdAt'].toString())
              : null,
    );
  }
}
