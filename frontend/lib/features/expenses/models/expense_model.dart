import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

class ExpenseModel {
  final int id;
  final String expenseCode;
  final String expenseDate;
  final String expenseMonth;
  final String category;
  final String vendorName;
  final String description;
  final double baseAmount;
  final double gstPercent;
  final double gstAmount;
  final double totalAmount;
  final String paymentMode;
  final String status;
  final String remarks;
  final String expenseType;
  final int? employeeId;
  final String? employeeName;
  final int? createdById;
  final String? createdByName;
  final DateTime? createdAt;

  ExpenseModel({
    required this.id,
    this.expenseCode = '',
    required this.expenseDate,
    required this.expenseMonth,
    required this.category,
    this.vendorName = '',
    this.description = '',
    this.baseAmount = 0.0,
    this.gstPercent = 0.0,
    this.gstAmount = 0.0,
    this.totalAmount = 0.0,
    this.paymentMode = 'UPI',
    this.status = 'PAID',
    this.remarks = '',
    this.expenseType = 'EMPLOYEE',
    this.employeeId,
    this.employeeName,
    this.createdById,
    this.createdByName,
    this.createdAt,
  });

  bool get isPaid => status.toUpperCase() == 'PAID';
  bool get isPending => status.toUpperCase() == 'PENDING';

  String get formattedDate {
    if (expenseDate.isEmpty) return '--';
    try {
      final dt = DateTime.parse(expenseDate);
      return DateFormat('dd MMM yyyy').format(dt);
    } catch (_) {
      return expenseDate;
    }
  }

  String get formattedAmount {
    final formatter = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
    return formatter.format(totalAmount);
  }

  IconData get categoryIcon {
    final cat = category.toLowerCase();
    if (cat.contains('travel') || cat.contains('fuel') || cat.contains('petrol') || cat.contains('diesel') || cat.contains('cab') || cat.contains('taxi')) {
      return Icons.local_gas_station_rounded;
    }
    if (cat.contains('client') || cat.contains('food') || cat.contains('lunch') || cat.contains('dinner') || cat.contains('meal')) {
      return Icons.restaurant_rounded;
    }
    if (cat.contains('tea') || cat.contains('coffee') || cat.contains('pantry') || cat.contains('snack')) {
      return Icons.local_cafe_rounded;
    }
    if (cat.contains('phone') || cat.contains('mobile') || cat.contains('recharge') || cat.contains('internet')) {
      return Icons.phone_android_rounded;
    }
    if (cat.contains('software') || cat.contains('subscription') || cat.contains('cloud') || cat.contains('it')) {
      return Icons.devices_rounded;
    }
    if (cat.contains('stationery') || cat.contains('printing') || cat.contains('paper') || cat.contains('pen')) {
      return Icons.edit_note_rounded;
    }
    if (cat.contains('courier') || cat.contains('postage') || cat.contains('parcel')) {
      return Icons.local_shipping_rounded;
    }
    if (cat.contains('rent') || cat.contains('office maintenance') || cat.contains('utility') || cat.contains('electricity')) {
      return Icons.apartment_rounded;
    }
    if (cat.contains('marketing') || cat.contains('advertis')) {
      return Icons.campaign_rounded;
    }
    if (cat.contains('staff') || cat.contains('welfare')) {
      return Icons.groups_rounded;
    }
    return Icons.receipt_long_rounded;
  }

  factory ExpenseModel.fromJson(Map<String, dynamic> json) {
    final base = (json['baseAmount'] ?? json['base_amount'] ?? json['amount']) != null
        ? double.tryParse(json['baseAmount']?.toString() ?? json['base_amount']?.toString() ?? json['amount']?.toString() ?? '0') ?? 0.0
        : 0.0;
    final total = (json['totalAmount'] ?? json['total_amount'] ?? json['amount']) != null
        ? double.tryParse(json['totalAmount']?.toString() ?? json['total_amount']?.toString() ?? json['amount']?.toString() ?? '0') ?? base
        : base;
    final gstPct = json['gstPercent'] != null ? double.tryParse(json['gstPercent'].toString()) ?? 0.0 : 0.0;
    final gstAmt = json['gstAmount'] != null ? double.tryParse(json['gstAmount'].toString()) ?? 0.0 : 0.0;

    return ExpenseModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      expenseCode: json['expenseCode'] ?? json['expense_code'] ?? '',
      expenseDate: json['expenseDate'] ?? json['expense_date'] ?? json['date'] ?? '',
      expenseMonth: json['expenseMonth'] ?? json['expense_month'] ?? json['month'] ?? '',
      category: json['category'] ?? 'Miscellaneous',
      vendorName: json['vendorName'] ?? json['vendor_name'] ?? json['vendor'] ?? '',
      description: json['description'] ?? '',
      baseAmount: base,
      gstPercent: gstPct,
      gstAmount: gstAmt,
      totalAmount: total > 0 ? total : base,
      paymentMode: json['paymentMode'] ?? json['payment_mode'] ?? 'UPI',
      status: (json['status'] ?? 'PAID').toString().toUpperCase(),
      remarks: json['remarks'] ?? '',
      expenseType: (json['expenseType'] ?? json['expense_type'] ?? 'EMPLOYEE').toString().toUpperCase(),
      employeeId: json['employeeId'] ?? json['employee_id'],
      employeeName: json['employee']?['name'] ?? json['employeeName'],
      createdById: json['createdById'] ?? json['created_by_id'],
      createdByName: json['createdBy']?['name'] ?? json['createdByName'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'expenseDate': expenseDate,
    'expenseMonth': expenseMonth,
    'category': category,
    'vendorName': vendorName,
    'description': description,
    'baseAmount': baseAmount,
    'amount': totalAmount,
    'gstPercent': gstPercent,
    'gstAmount': gstAmount,
    'totalAmount': totalAmount,
    'paymentMode': paymentMode,
    'status': status,
    'remarks': remarks,
    'expenseType': expenseType,
    'employeeId': employeeId,
  };
}

class ExpenseStatsModel {
  final double totalAmount;
  final double totalPaid;
  final double totalPending;
  final int count;

  ExpenseStatsModel({
    this.totalAmount = 0.0,
    this.totalPaid = 0.0,
    this.totalPending = 0.0,
    this.count = 0,
  });

  factory ExpenseStatsModel.fromJson(Map<String, dynamic>? json) {
    if (json == null) return ExpenseStatsModel();
    return ExpenseStatsModel(
      totalAmount: double.tryParse(json['totalAmount']?.toString() ?? '0') ?? 0.0,
      totalPaid: double.tryParse(json['totalPaid']?.toString() ?? '0') ?? 0.0,
      totalPending: double.tryParse(json['totalPending']?.toString() ?? '0') ?? 0.0,
      count: int.tryParse(json['matchCount']?.toString() ?? json['count']?.toString() ?? '0') ?? 0,
    );
  }
}
