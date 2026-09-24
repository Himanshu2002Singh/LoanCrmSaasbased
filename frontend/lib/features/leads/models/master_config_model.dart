class MasterConfigModel {
  final int id;
  final String configType;
  final String label;
  final String value;
  final String? colorCode;
  final int orderIndex;
  final bool isActive;

  MasterConfigModel({
    required this.id,
    required this.configType,
    required this.label,
    required this.value,
    this.colorCode,
    this.orderIndex = 100,
    this.isActive = true,
  });

  factory MasterConfigModel.fromJson(Map<String, dynamic> json) {
    return MasterConfigModel(
      id: json['id'] ?? 0,
      configType: json['configType'] ?? json['config_type'] ?? '',
      label: json['label'] ?? '',
      value: json['value'] ?? '',
      colorCode: json['colorCode'] ?? json['color_code'],
      orderIndex: json['orderIndex'] ?? json['order_index'] ?? 100,
      isActive: json['isActive'] ?? json['is_active'] ?? true,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'config_type': configType,
    'label': label,
    'value': value,
    'color_code': colorCode,
    'order_index': orderIndex,
    'is_active': isActive,
  };
}
