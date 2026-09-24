import 'package:capital_care/features/telecalling/models/call_log_model.dart';
import 'package:capital_care/features/tasks_and_followups/models/followup_model.dart';

class CustomerModel {
  final int? id;
  final String? name;
  final String? mobile;
  final String? alternateMobile;
  final String? email;
  final String? city;
  final String? state;
  final String? pincode;
  final String? address;
  final String? employmentType;
  final double? monthlyIncome;
  final String? panNumber;
  final String? aadhaarNumber;

  CustomerModel({
    this.id,
    this.name,
    this.mobile,
    this.alternateMobile,
    this.email,
    this.city,
    this.state,
    this.pincode,
    this.address,
    this.employmentType,
    this.monthlyIncome,
    this.panNumber,
    this.aadhaarNumber,
  });

  factory CustomerModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return CustomerModel();
    return CustomerModel(
      id: json['id'] ?? json['customer_id'],
      name: json['name'],
      mobile: json['mobile'] ?? json['number'],
      alternateMobile: json['alternateMobile'] ?? json['alternate_number'],
      email: json['email'],
      city: json['city'],
      state: json['state'],
      pincode: json['pincode'],
      address: json['address'],
      employmentType: json['employmentType'] ?? json['employment_type'],
      monthlyIncome: json['monthlyIncome'] != null ? double.tryParse(json['monthlyIncome'].toString()) : null,
      panNumber: json['panNumber'] ?? json['pan_number'],
      aadhaarNumber: json['aadhaarNumber'] ?? json['aadhaar_number'],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'mobile': mobile,
    'alternateMobile': alternateMobile,
    'email': email,
    'city': city,
    'state': state,
    'pincode': pincode,
    'address': address,
    'employmentType': employmentType,
    'monthlyIncome': monthlyIncome,
    'panNumber': panNumber,
    'aadhaarNumber': aadhaarNumber,
  };
}

class LeadModel {
  final int id;
  final int? customerId;
  final String name;
  final String number;
  final String? alternateNumber;
  final String? email;
  final String? city;
  final String? employmentType;
  final double? monthlyIncome;
  final String? source;
  final String? loanType;
  final double? estBudget;
  final String status;
  final String statusValue;
  final int? statusId;
  final String? statusTeam;
  final String priority;
  final String? nextMeeting;
  final int? personId;
  final String? owner;
  final int? managerId;
  final String? manager;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final CustomerModel? customer;
  final String? remarks;
  final String? initialRemark;
  final String? lastRemark;
  final List<CallLogModel> callLogs;
  final List<FollowUpModel> followUps;

  LeadModel({
    required this.id,
    this.customerId,
    required this.name,
    required this.number,
    this.alternateNumber,
    this.email,
    this.city,
    this.employmentType,
    this.monthlyIncome,
    this.source,
    this.loanType,
    this.estBudget,
    required this.status,
    required this.statusValue,
    this.statusId,
    this.statusTeam,
    this.priority = 'MEDIUM',
    this.nextMeeting,
    this.personId,
    this.owner,
    this.managerId,
    this.manager,
    this.remarks,
    this.initialRemark,
    this.lastRemark,
    this.createdAt,
    this.updatedAt,
    this.customer,
    this.callLogs = const [],
    this.followUps = const [],
  });

  String get formattedAmount {
    if (estBudget == null || estBudget == 0) return '₹--';
    if (estBudget! >= 10000000) {
      return '₹${(estBudget! / 10000000).toStringAsFixed(2)} Cr';
    } else if (estBudget! >= 100000) {
      return '₹${(estBudget! / 100000).toStringAsFixed(2)} L';
    } else {
      return '₹${estBudget!.toStringAsFixed(0)}';
    }
  }

  factory LeadModel.fromJson(Map<String, dynamic> json) {
    final calls = <CallLogModel>[];
    if (json['callLogs'] != null && json['callLogs'] is List) {
      for (final item in json['callLogs']) {
        if (item is Map<String, dynamic>) {
          calls.add(CallLogModel.fromJson(item));
        }
      }
    }

    final followups = <FollowUpModel>[];
    if (json['followUps'] != null && json['followUps'] is List) {
      for (final item in json['followUps']) {
        if (item is Map<String, dynamic>) {
          followups.add(FollowUpModel.fromJson(item));
        }
      }
    }

    return LeadModel(
      id: json['lead_id'] ?? json['id'] ?? 0,
      customerId: json['customer_id'] ?? json['customerId'],
      name: json['name'] ?? json['customer']?['name'] ?? 'Unknown Customer',
      number: json['number'] ?? json['customer']?['mobile'] ?? '',
      alternateNumber: json['alternate_number'] ?? json['customer']?['alternateMobile'],
      email: json['email'] ?? json['customer']?['email'],
      city: json['city'] ?? json['customer']?['city'],
      employmentType: json['employment_type'] ?? json['customer']?['employmentType'],
      monthlyIncome: json['monthly_income'] != null
          ? double.tryParse(json['monthly_income'].toString())
          : (json['income'] != null
              ? double.tryParse(json['income'].toString())
              : (json['customer']?['monthlyIncome'] != null
                  ? double.tryParse(json['customer']['monthlyIncome'].toString())
                  : null)),
      source: json['source'] ?? json['leadSource'],
      loanType: json['loan_type'] ?? json['loanType'],
      estBudget: json['est_budget'] != null
          ? double.tryParse(json['est_budget'].toString())
          : (json['requiredAmount'] != null ? double.tryParse(json['requiredAmount'].toString()) : null),
      status: json['status'] ?? 'NEW',
      statusValue: json['status_value'] ?? json['status'] ?? 'NEW',
      statusId: json['status_id'],
      statusTeam: json['status_team'],
      priority: (json['priority'] ?? 'MEDIUM').toString().toUpperCase(),
      nextMeeting: json['next_meeting'] ?? json['nextFollowupDate'],
      personId: json['person_id'] ?? json['assignedEmployeeId'],
      owner: json['owner'] ?? json['assignedEmployee']?['name'],
      managerId: json['manager_id'] ?? json['assignedManagerId'],
      manager: json['manager'] ?? json['assignedManager']?['name'],
      remarks: json['remarks'] ?? json['initial_remark'],
      initialRemark: json['initial_remark'] ?? json['remarks'],
      lastRemark: json['last_remark'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      updatedAt: json['updatedAt'] != null ? DateTime.tryParse(json['updatedAt'].toString()) : null,
      customer: json['customer'] != null ? CustomerModel.fromJson(json['customer']) : null,
      callLogs: calls,
      followUps: followups,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'customer_id': customerId,
    'name': name,
    'number': number,
    'alternate_number': alternateNumber,
    'email': email,
    'city': city,
    'employment_type': employmentType,
    'monthly_income': monthlyIncome,
    'source': source,
    'loan_type': loanType,
    'est_budget': estBudget,
    'status': status,
    'status_value': statusValue,
    'status_id': statusId,
    'status_team': statusTeam,
    'priority': priority,
    'next_meeting': nextMeeting,
    'person_id': personId,
    'owner': owner,
    'manager_id': managerId,
    'manager': manager,
    'remarks': remarks,
    'initial_remark': initialRemark,
    'last_remark': lastRemark,
    'createdAt': createdAt?.toIso8601String(),
    'updatedAt': updatedAt?.toIso8601String(),
  };
}
