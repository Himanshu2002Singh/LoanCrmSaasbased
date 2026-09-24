class Calls {
  final call_id;
  final lead_id;
  final emp_id;
  final name;
  final number;
  final remark;
  final createdAt;

  Calls({
    this.call_id,
    this.lead_id,
    this.emp_id,
    this.name,
    this.number,
    this.remark,
    this.createdAt,
  });
  Map<String, dynamic> toJson() {
    final Map<String, dynamic> json = {};
    if (lead_id != null) json["lead_id"] = lead_id;
    if (emp_id != null) json["emp_id"] = emp_id;
    if (name != null) json["name"] = name;
    if (number != null) json["number"] = number;
    if (remark != null) json["remark"] = remark;
    return json;
  }

  factory Calls.fromJson(Map<String, dynamic> json) {
    return Calls(
      call_id: json['call_id'],
      lead_id: json['lead_id'],
      emp_id: json['emp_id'],
      name: json['name'],
      number: json['number'],
      remark: json['remark'],
      createdAt: json['createdAt'],
    );
  }
}
