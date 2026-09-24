class Employee {
  final empId;
  final username;
  final email;
  final phone;
  final ename;
  final password;
  final role;
  final status;

  Employee({
    this.empId,
    this.username,
    this.email,
    this.phone,
    this.ename,
    this.password,
    this.role,
    this.status,
  });

  factory Employee.fromJson(Map<String, dynamic> json) {
    return Employee(
      empId: json['emp_id'].toString(),
      username: json['username'],
      email: json['email'],
      phone: json['phone'],
      ename: json['ename'],
      password: json['password'],
      role: json['role'],
      status: json['status'],
    );
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> json = {};
    if (email != null) json['email'] = email;
    if (phone != null) json['phone'] = phone;
    if (ename != null) json['ename'] = ename;
    if (password != null) json['password'] = password;
    if (role != null) json['role'] = role;
    if (status != null) json['status'] = status;
    return json;
  }
}
