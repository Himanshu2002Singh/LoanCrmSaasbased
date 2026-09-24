class Leads {
  final lead_id;
  final person_id;
  final name;
  final number;
  final email;
  // final dob;
  final owner;
  final source;
  final priority;
  final status;
  final next_meeting;
  final refrence;
  final description;
  final address;
  final loanType;
  final est_budget;
  final remark;
  final createdAt;
  final employment_type;
  // final loan_term;
  // final salary;

  Leads({
    this.lead_id,
    this.person_id,
    this.name,
    this.number,
    this.email,
    // this.dob,
    this.owner,
    this.source,
    this.priority,
    this.status,
    this.next_meeting,
    this.refrence,
    this.description,
    this.address,
    this.loanType,
    this.est_budget,
    this.remark,
    this.createdAt,
    this.employment_type,
    // this.loan_term,
    // this.salary,
  });

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> json = {};
    if (person_id != null) json["person_id"] = person_id == "" ? null : person_id;
    if (name != null) json["name"] = name == "" ? null : name;
    if (number != null) json["number"] = number == "" ? null : number;
    if (email != null) json["email"] = email == "" ? null : email;
    // if (dob != null) json["dob"] = dob;
    if (owner != null) json["owner"] = owner == "" ? null : owner;
    if (source != null) json["source"] = source == "" ? null : source;
    if (priority != null) json["priority"] = priority == "" ? null : priority;
    if (status != null) json["status"] = status == "" ? null : status;
    if (next_meeting != null) json["next_meeting"] = next_meeting == "" ? null : next_meeting;
    if (refrence != null) json["refrence"] = refrence == "" ? null : refrence;
    if (description != null) json["description"] = description == "" ? null : description;
    if (address != null) json["address"] = address == "" ? null : address;
    if (loanType != null) json["loan_type"] = loanType == "" ? null : loanType;
    if (est_budget != null) json["est_budget"] = est_budget == "" ? null : est_budget;
    if (remark != null) json["remark"] = remark == "" ? null : remark;
    if (employment_type != null) json["employment_type"] = employment_type == "" ? null : employment_type;
    // if (loan_term != null) json["loan_term"] = loan_term;
    // if (salary != null) json["salary"] = salary;
    return json;
  }

  factory Leads.fromJson(Map<String, dynamic> json) {
    return Leads(
      lead_id: json['lead_id'],
      person_id: json['person_id'] ?? "",
      name: json['name'] ?? "",
      number: json['number'] ?? "",
      owner: json['owner'] ?? "",
      source: json['source'] ?? "",
      createdAt: json['createdAt'] ?? "",
      priority: json['priority'] ?? "",
      status: json['status'] ?? "",
      description: json['description'] ?? "",
      next_meeting: json['next_meeting'] ?? "",
      est_budget: json['est_budget'] ?? "",
      address: json['address'] ?? "",
      email: json['email'] ?? "",
      refrence: json['refrence'] ?? "",
      loanType: json['loan_type'] ?? "",
      remark: json['remark'] ?? "",
      // dob: json['dob'] ?? "",
      employment_type: json['employment_type'] ?? "",
      // loan_term: json['loan_term'] ?? "",
      // salary: json['salary'] ?? "",
    );
  }
}
