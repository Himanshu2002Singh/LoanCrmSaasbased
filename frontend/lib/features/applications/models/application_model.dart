class ApplicationModel {
  final int id;
  final String applicationNumber;
  final int? leadId;
  final int? customerId;
  final String loanProduct;
  final double appliedAmount;
  final double? sanctionedAmount;
  final double? disbursedAmount;
  final String status;
  final int? lenderId;
  final String? lenderName;
  final String? customerName;
  final String? customerMobile;
  final String? assignedBanker;
  final String? rejectionReason;
  final DateTime? createdAt;

  ApplicationModel({
    required this.id,
    required this.applicationNumber,
    this.leadId,
    this.customerId,
    required this.loanProduct,
    required this.appliedAmount,
    this.sanctionedAmount,
    this.disbursedAmount,
    required this.status,
    this.lenderId,
    this.lenderName,
    this.customerName,
    this.customerMobile,
    this.assignedBanker,
    this.rejectionReason,
    this.createdAt,
  });

  factory ApplicationModel.fromJson(Map<String, dynamic> json) {
    return ApplicationModel(
      id: json['id'] ?? json['application_id'] ?? 0,
      applicationNumber: json['applicationNumber'] ?? json['application_number'] ?? '',
      leadId: json['leadId'] ?? json['lead_id'],
      customerId: json['customerId'] ?? json['customer_id'],
      loanProduct: json['loanProduct'] ?? json['loan_product'] ?? '',
      appliedAmount: json['appliedAmount'] != null ? double.tryParse(json['appliedAmount'].toString()) ?? 0.0 : 0.0,
      sanctionedAmount: json['sanctionedAmount'] != null ? double.tryParse(json['sanctionedAmount'].toString()) : null,
      disbursedAmount: json['disbursedAmount'] != null ? double.tryParse(json['disbursedAmount'].toString()) : null,
      status: json['status'] ?? 'DOCS_PENDING',
      lenderId: json['lenderId'] ?? json['lender_id'],
      lenderName: json['lender']?['name'] ?? json['lenderName'],
      customerName: json['customer']?['name'] ?? json['lead']?['customer']?['name'] ?? json['customerName'],
      customerMobile: json['customer']?['mobile'] ?? json['lead']?['customer']?['mobile'] ?? json['customerMobile'],
      assignedBanker: json['banker']?['name'] ?? json['assignedBanker'],
      rejectionReason: json['rejectionReason'] ?? json['rejection_reason'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'applicationNumber': applicationNumber,
    'leadId': leadId,
    'customerId': customerId,
    'loanProduct': loanProduct,
    'appliedAmount': appliedAmount,
    'sanctionedAmount': sanctionedAmount,
    'disbursedAmount': disbursedAmount,
    'status': status,
  };
}
