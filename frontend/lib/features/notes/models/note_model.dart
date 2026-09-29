import 'package:flutter/material.dart';

class NoteColorTheme {
  final String id;
  final String name;
  final Color bg;
  final Color border;
  final Color accent;
  final Color dot;

  const NoteColorTheme({
    required this.id,
    required this.name,
    required this.bg,
    required this.border,
    required this.accent,
    required this.dot,
  });

  static const List<NoteColorTheme> themes = [
    NoteColorTheme(
      id: 'amber',
      name: 'Amber',
      bg: Color(0xFFFFFBEB),
      border: Color(0xFFFDE68A),
      accent: Color(0xFFD97706),
      dot: Color(0xFFF59E0B),
    ),
    NoteColorTheme(
      id: 'sky',
      name: 'Sky Blue',
      bg: Color(0xFFF0F9FF),
      border: Color(0xFFBAE6FD),
      accent: Color(0xFF0284C7),
      dot: Color(0xFF0EA5E9),
    ),
    NoteColorTheme(
      id: 'emerald',
      name: 'Emerald',
      bg: Color(0xFFECFDF5),
      border: Color(0xFFA7F3D0),
      accent: Color(0xFF059669),
      dot: Color(0xFF10B981),
    ),
    NoteColorTheme(
      id: 'purple',
      name: 'Purple',
      bg: Color(0xFFFAF5FF),
      border: Color(0xFFE9D5FF),
      accent: Color(0xFF7C3AED),
      dot: Color(0xFF8B5CF6),
    ),
    NoteColorTheme(
      id: 'rose',
      name: 'Rose',
      bg: Color(0xFFFFF1F2),
      border: Color(0xFFFECDD3),
      accent: Color(0xFFE11D48),
      dot: Color(0xFFF43F5E),
    ),
    NoteColorTheme(
      id: 'slate',
      name: 'Slate',
      bg: Color(0xFFF8FAFC),
      border: Color(0xFFE2E8F0),
      accent: Color(0xFF475569),
      dot: Color(0xFF64748B),
    ),
  ];

  static NoteColorTheme fromId(String? id) {
    if (id == null) return themes.first;
    return themes.firstWhere(
      (t) => t.id.toLowerCase() == id.toLowerCase(),
      orElse: () => themes.first,
    );
  }
}

class ConnectedLeadInfo {
  final int id;
  final String loanType;
  final double requiredAmount;
  final String status;
  final String customerName;
  final String customerMobile;
  final String customerCity;

  ConnectedLeadInfo({
    required this.id,
    required this.loanType,
    required this.requiredAmount,
    required this.status,
    required this.customerName,
    required this.customerMobile,
    required this.customerCity,
  });

  factory ConnectedLeadInfo.fromJson(Map<String, dynamic> json) {
    final customer = json['customer'] as Map<String, dynamic>?;
    return ConnectedLeadInfo(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      loanType: json['loanType']?.toString() ?? json['loan_type']?.toString() ?? '',
      requiredAmount: (json['requiredAmount'] ?? json['required_amount'] ?? 0).toDouble(),
      status: json['status']?.toString() ?? '',
      customerName: customer?['name']?.toString() ?? json['customer_name']?.toString() ?? 'Customer',
      customerMobile: customer?['mobile']?.toString() ?? json['customer_mobile']?.toString() ?? '',
      customerCity: customer?['city']?.toString() ?? json['customer_city']?.toString() ?? '',
    );
  }
}

class NoteModel {
  final int id;
  final int userId;
  final int? leadId;
  final String title;
  final String content;
  final String color;
  final String priority;
  final bool isPinned;
  final String noteDate;
  final ConnectedLeadInfo? lead;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  NoteModel({
    required this.id,
    required this.userId,
    this.leadId,
    required this.title,
    required this.content,
    required this.color,
    required this.priority,
    required this.isPinned,
    required this.noteDate,
    this.lead,
    this.createdAt,
    this.updatedAt,
  });

  NoteColorTheme get theme => NoteColorTheme.fromId(color);

  bool get hasLead => leadId != null && leadId! > 0;

  bool get isHighPriority => priority.toUpperCase() == 'HIGH' || priority.toUpperCase() == 'URGENT';

  factory NoteModel.fromJson(Map<String, dynamic> json) {
    return NoteModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      userId: json['userId'] is int
          ? json['userId']
          : int.tryParse(json['user_id']?.toString() ?? json['userId']?.toString() ?? '0') ?? 0,
      leadId: json['leadId'] != null ? int.tryParse(json['leadId'].toString()) : null,
      title: json['title']?.toString() ?? 'Untitled Note',
      content: json['content']?.toString() ?? '',
      color: json['color']?.toString() ?? 'amber',
      priority: (json['priority']?.toString() ?? 'NORMAL').toUpperCase(),
      isPinned: json['isPinned'] == true || json['is_pinned'] == true || json['isPinned'] == 1,
      noteDate: json['noteDate']?.toString() ?? json['note_date']?.toString() ?? '',
      lead: json['lead'] != null && json['lead'] is Map<String, dynamic>
          ? ConnectedLeadInfo.fromJson(json['lead'] as Map<String, dynamic>)
          : null,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      updatedAt: json['updatedAt'] != null ? DateTime.tryParse(json['updatedAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'content': content,
      'color': color,
      'priority': priority,
      'isPinned': isPinned,
      'noteDate': noteDate,
      if (leadId != null) 'leadId': leadId,
    };
  }

  NoteModel copyWith({
    int? id,
    int? userId,
    int? leadId,
    String? title,
    String? content,
    String? color,
    String? priority,
    bool? isPinned,
    String? noteDate,
    ConnectedLeadInfo? lead,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return NoteModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      leadId: leadId ?? this.leadId,
      title: title ?? this.title,
      content: content ?? this.content,
      color: color ?? this.color,
      priority: priority ?? this.priority,
      isPinned: isPinned ?? this.isPinned,
      noteDate: noteDate ?? this.noteDate,
      lead: lead ?? this.lead,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

class AssignableLeadModel {
  final int id;
  final String leadNumber;
  final String customerName;
  final String customerMobile;
  final String customerCity;
  final String loanType;
  final double loanAmount;
  final String status;

  AssignableLeadModel({
    required this.id,
    required this.leadNumber,
    required this.customerName,
    required this.customerMobile,
    required this.customerCity,
    required this.loanType,
    required this.loanAmount,
    required this.status,
  });

  factory AssignableLeadModel.fromJson(Map<String, dynamic> json) {
    return AssignableLeadModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      leadNumber: json['lead_number']?.toString() ?? 'LD-${json['id']}',
      customerName: json['customer_name']?.toString() ?? 'Customer',
      customerMobile: json['customer_mobile']?.toString() ?? '',
      customerCity: json['customer_city']?.toString() ?? '',
      loanType: json['loan_type']?.toString() ?? '',
      loanAmount: (json['loan_amount'] ?? 0).toDouble(),
      status: json['status']?.toString() ?? '',
    );
  }
}
