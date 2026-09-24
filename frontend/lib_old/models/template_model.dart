class Template {
  final String name;
  final String description;
  final String fileType;
  final String fileUrl;

  Template({
    required this.name,
    required this.description,
    required this.fileType,
    required this.fileUrl,
  });

  factory Template.fromJson(Map<String, dynamic> json) {
    return Template(
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      fileType: json['fileType'] ?? '',
      fileUrl: json['fileUrl'] ?? '',
    );
  }
}
