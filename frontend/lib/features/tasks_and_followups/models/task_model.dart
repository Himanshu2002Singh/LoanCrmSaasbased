class TaskModel {
  final int id;
  final String title;
  final String? description;
  final DateTime? dueDate;
  final String priority;
  final String status;
  final int? leadId;
  final int? empId;
  final String? owner;
  final String? customerName;
  final DateTime? createdAt;

  TaskModel({
    required this.id,
    required this.title,
    this.description,
    this.dueDate,
    this.priority = 'MEDIUM',
    this.status = 'PENDING',
    this.leadId,
    this.empId,
    this.owner,
    this.customerName,
    this.createdAt,
  });

  factory TaskModel.fromJson(Map<String, dynamic> json) {
    return TaskModel(
      id: json['task_id'] ?? json['id'] ?? 0,
      title: json['title'] ?? '',
      description: json['description'],
      dueDate: json['due_date'] != null
          ? DateTime.tryParse(json['due_date'].toString())
          : (json['dueDate'] != null ? DateTime.tryParse(json['dueDate'].toString()) : null),
      priority: (json['priority'] ?? 'MEDIUM').toString().toUpperCase(),
      status: (json['status'] ?? 'PENDING').toString().toUpperCase(),
      leadId: json['lead_id'] ?? json['leadId'],
      empId: json['emp_id'] ?? json['userId'],
      owner: json['owner'] ?? json['user']?['name'],
      customerName: json['customer_name'] ?? json['lead']?['customer']?['name'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'description': description,
    'due_date': dueDate?.toIso8601String(),
    'priority': priority,
    'status': status,
    'lead_id': leadId,
    'emp_id': empId,
    'owner': owner,
    'customer_name': customerName,
    'createdAt': createdAt?.toIso8601String(),
  };

  bool get isCompleted => status == 'COMPLETED';
}
