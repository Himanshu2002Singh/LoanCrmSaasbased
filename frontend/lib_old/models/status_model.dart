class LeadStatus {
  final int? statusId;
  final String name;
  final String team;
  final bool isInitial;
  final bool isFileLogin;
  final bool isProtected;
  final bool isActive;
  final int sortOrder;

  LeadStatus({
    this.statusId,
    required this.name,
    required this.team,
    this.isInitial = false,
    this.isFileLogin = false,
    this.isProtected = false,
    this.isActive = true,
    this.sortOrder = 100,
  });

  factory LeadStatus.fromJson(Map<String, dynamic> json) {
    return LeadStatus(
      statusId: json['status_id'],
      name: json['name'] ?? '',
      team: json['team'] ?? 'calling',
      isInitial: json['is_initial'] ?? false,
      isFileLogin: json['is_file_login'] ?? false,
      isProtected: json['is_protected'] ?? false,
      isActive: json['is_active'] ?? true,
      sortOrder: json['sort_order'] ?? 100,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'status_id': statusId,
      'name': name,
      'team': team,
      'is_initial': isInitial,
      'is_file_login': isFileLogin,
      'is_protected': isProtected,
      'is_active': isActive,
      'sort_order': sortOrder,
    };
  }
}
