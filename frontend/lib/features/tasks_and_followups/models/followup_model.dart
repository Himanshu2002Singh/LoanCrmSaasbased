class FollowUpModel {
  final int id;
  final int? leadId;
  final int? empId;
  final String? owner;
  final String? customerName;
  final String? customerNumber;
  final DateTime? scheduledAt;
  final String? reminderType;
  final String status;
  final String? remarks;
  final DateTime? createdAt;

  FollowUpModel({
    required this.id,
    this.leadId,
    this.empId,
    this.owner,
    this.customerName,
    this.customerNumber,
    this.scheduledAt,
    this.reminderType,
    required this.status,
    this.remarks,
    this.createdAt,
  });

  factory FollowUpModel.fromJson(Map<String, dynamic> json) {
    return FollowUpModel(
      id: json['followup_id'] ?? json['id'] ?? 0,
      leadId: json['lead_id'] ?? json['leadId'],
      empId: json['emp_id'] ?? json['userId'],
      owner: json['owner'] ?? json['user']?['name'],
      customerName: json['customer_name'] ?? json['lead']?['customer']?['name'],
      customerNumber: json['customer_number'] ?? json['lead']?['customer']?['mobile'],
      scheduledAt: json['scheduled_at'] != null
          ? DateTime.tryParse(json['scheduled_at'].toString())
          : (json['scheduledAt'] != null ? DateTime.tryParse(json['scheduledAt'].toString()) : null),
      reminderType: json['reminder_type'] ?? json['reminderType'],
      status: json['status'] ?? 'PENDING',
      remarks: json['remarks'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'lead_id': leadId,
    'emp_id': empId,
    'owner': owner,
    'customer_name': customerName,
    'customer_number': customerNumber,
    'scheduled_at': scheduledAt?.toIso8601String(),
    'reminder_type': reminderType,
    'status': status,
    'remarks': remarks,
    'createdAt': createdAt?.toIso8601String(),
  };

  bool get isOverdue {
    if (scheduledAt == null || status == 'COMPLETED') return false;
    return scheduledAt!.isBefore(DateTime.now());
  }
}
