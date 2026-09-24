class History {
  final history_id;
  final lead_id;
  final owner;
  final changedBy;
  final changedByEmpId;
  final previousStatus;
  final status;
  final next_meeting;
  final loanType;
  final remark;
  final createdAt;

  History({
    this.history_id,
    this.lead_id,
    this.owner,
    this.changedBy,
    this.changedByEmpId,
    this.previousStatus,
    this.status,
    this.next_meeting,
    this.loanType,
    this.remark,
    this.createdAt,
  });

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> json = {};
    if (lead_id != null) json["lead_id"] = lead_id;
    if (owner != null) json["owner"] = owner;
    if (changedByEmpId != null) json["changed_by_emp_id"] = changedByEmpId;
    if (next_meeting != null) json["next_meeting"] = next_meeting;
    if (status != null) json["status"] = status;
    if (loanType != null) json["loanType"] = loanType;
    if (remark != null) json["remark"] = remark;
    return json;
  }

  factory History.fromJson(Map<String, dynamic> json) {
    return History(
      history_id: json['history_id'],
      lead_id: json['lead_id'],
      changedBy: json['changedBy'] != null ? json['changedBy']['ename'] : json['changed_by_emp_id'] ?? "",
      changedByEmpId: json['changedBy'] != null ? json['changedBy']['emp_id'] : json['changed_by_emp_id'] ?? "",
      previousStatus: json['previousStatusDetails'] != null ? json['previousStatusDetails']['name'] : json['previous_status_id']?.toString() ?? "",
      status: json['statusDetails'] != null ? json['statusDetails']['name'] : json['status'] ?? "",
      next_meeting: json['next_meeting'] ?? "",
      loanType: json['loanType'] ?? "",
      remark: json['remark'] ?? "",
      createdAt: json['createdAt'] ?? "",
    );
  }
}
