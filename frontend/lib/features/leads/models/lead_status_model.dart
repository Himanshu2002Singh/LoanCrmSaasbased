class LeadStatusModel {
  final int statusId;
  final String name;
  final String value;
  final String? team;
  final int sortOrder;
  final bool isInitial;
  final bool isFileLogin;
  final bool isActive;
  final bool isProtected;
  final String? colorCode;

  LeadStatusModel({
    required this.statusId,
    required this.name,
    required this.value,
    this.team,
    this.sortOrder = 100,
    this.isInitial = false,
    this.isFileLogin = false,
    this.isActive = true,
    this.isProtected = false,
    this.colorCode,
  });

  factory LeadStatusModel.fromJson(Map<String, dynamic> json) {
    return LeadStatusModel(
      statusId: json['status_id'] ?? json['id'] ?? 0,
      name: json['name'] ?? json['label'] ?? '',
      value: json['value'] ?? '',
      team: json['team'],
      sortOrder: json['sort_order'] ?? json['orderIndex'] ?? 100,
      isInitial: json['is_initial'] ?? false,
      isFileLogin: json['is_file_login'] ?? false,
      isActive: json['is_active'] ?? json['isActive'] ?? true,
      isProtected: json['is_protected'] ?? false,
      colorCode: json['color_code'] ?? json['colorCode'],
    );
  }

  Map<String, dynamic> toJson() => {
    'status_id': statusId,
    'name': name,
    'value': value,
    'team': team,
    'sort_order': sortOrder,
    'is_initial': isInitial,
    'is_file_login': isFileLogin,
    'is_active': isActive,
    'is_protected': isProtected,
    'color_code': colorCode,
  };
}
