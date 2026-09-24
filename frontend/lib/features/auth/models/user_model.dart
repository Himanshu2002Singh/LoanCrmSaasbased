class CompanyModel {
  final int id;
  final String name;
  final String? slug;
  final String? email;
  final String? phone;
  final String? logoUrl;
  final String? status;

  CompanyModel({
    required this.id,
    required this.name,
    this.slug,
    this.email,
    this.phone,
    this.logoUrl,
    this.status,
  });

  factory CompanyModel.fromJson(Map<String, dynamic> json) {
    return CompanyModel(
      id: json['id'] ?? 0,
      name: json['name'] ?? '',
      slug: json['slug'],
      email: json['email'],
      phone: json['phone'],
      logoUrl: json['logo_url'] ?? json['logoUrl'],
      status: json['status'],
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'slug': slug,
        'email': email,
        'phone': phone,
        'logo_url': logoUrl,
        'status': status,
      };
}

class BranchModel {
  final int id;
  final int companyId;
  final String name;
  final String? city;
  final String? state;
  final String? address;
  final double? officeLat;
  final double? officeLng;
  final int geoRadiusMeters;

  BranchModel({
    required this.id,
    required this.companyId,
    required this.name,
    this.city,
    this.state,
    this.address,
    this.officeLat,
    this.officeLng,
    this.geoRadiusMeters = 200,
  });

  factory BranchModel.fromJson(Map<String, dynamic> json) {
    return BranchModel(
      id: json['id'] ?? 0,
      companyId: json['company_id'] ?? json['companyId'] ?? 0,
      name: json['name'] ?? '',
      city: json['city'],
      state: json['state'],
      address: json['address'],
      officeLat: json['office_lat'] != null ? double.tryParse(json['office_lat'].toString()) : null,
      officeLng: json['office_lng'] != null ? double.tryParse(json['office_lng'].toString()) : null,
      geoRadiusMeters: json['geo_radius_meters'] ?? json['geoRadiusMeters'] ?? 200,
    );
  }
}

class UserModel {
  final int id;
  final int? companyId;
  final String name;
  final String email;
  final String? phone;
  final String role; // SUPERADMIN, COMPANY_ADMIN, MANAGER, EMPLOYEE, OPS, BANKER
  final int? managerId;
  final int? branchId;
  final String status;
  final CompanyModel? company;
  final BranchModel? branch;

  UserModel({
    required this.id,
    this.companyId,
    required this.name,
    required this.email,
    this.phone,
    required this.role,
    this.managerId,
    this.branchId,
    this.status = 'active',
    this.company,
    this.branch,
  });

  bool get isSuperAdmin => role == 'SUPERADMIN';
  bool get isAdmin => role == 'COMPANY_ADMIN' || role == 'SUPERADMIN';
  bool get isManager => role == 'MANAGER' || isAdmin;
  bool get isOps => role == 'OPS';
  bool get isBanker => role == 'BANKER';
  bool get isCaller => role == 'EMPLOYEE';

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] ?? 0,
      companyId: json['company_id'] ?? json['companyId'],
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'],
      role: json['role'] ?? 'EMPLOYEE',
      managerId: json['manager_id'] ?? json['managerId'],
      branchId: json['branch_id'] ?? json['branchId'],
      status: json['status'] ?? 'active',
      company: json['company'] != null ? CompanyModel.fromJson(json['company']) : null,
      branch: json['branch'] != null ? BranchModel.fromJson(json['branch']) : null,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'company_id': companyId,
        'name': name,
        'email': email,
        'phone': phone,
        'role': role,
        'manager_id': managerId,
        'branch_id': branchId,
        'status': status,
      };
}
