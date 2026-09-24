class Task {
  final task_id;
  final emp_id;
  final title;
  final choose_lead;
  final lead_id;
  final start_date;
  final end_date;
  final priority;
  final description;
  final assigned_by_name;
  final assigned_by_id;
  var status;
  final createdAt;

  Task({
    this.task_id,
    this.emp_id,
    this.title,
    this.choose_lead,
    this.lead_id,
    this.start_date,
    this.end_date,
    this.priority,
    this.description,
    this.assigned_by_name,
    this.assigned_by_id,
    this.status,
    this.createdAt,
  });

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> json = {};
    if (emp_id != null) json["emp_id"] = emp_id;
    if (title != null) json["title"] = title;
    if (choose_lead != null) json["choose_lead"] = choose_lead;
    if (lead_id != null) json["lead_id"] = lead_id;
    if (start_date != null) json["start_date"] = start_date;
    if (end_date != null) json["end_date"] = end_date;
    if (priority != null) json["priority"] = priority;
    if (description != null) json["description"] = description;
    if (assigned_by_name != null) json["assigned_by_name"] = assigned_by_name;
    if (assigned_by_id != null) json["assigned_by_id"] = assigned_by_id;
    if (status != null) json["status"] = status;
    if (createdAt != null) json["createdAt"] = createdAt;
    return json;
  }

  factory Task.fromJson(Map<String, dynamic> json) {
    return Task(
      task_id: json["task_id"] ?? "",
      emp_id: json["emp_id"] ?? "",
      title: json["title"] ?? "",
      choose_lead: json["choose_lead"] ?? "",
      lead_id: json["lead_id"] ?? "",
      start_date: json["start_date"] ?? "",
      end_date: json["end_date"] ?? "",
      priority: json["priority"] ?? "",
      description: json["description"] ?? "",
      assigned_by_name: json["assigned_by_name"] ?? "",
      assigned_by_id: json["assigned_by_id"] ?? "",
      status: json["status"] ?? "",
      createdAt: json["createdAt"] ?? "",
    );
  }
}
