class CallLogModel {
  final int id;
  final int? leadId;
  final int? empId;
  final String? caller;
  final String? customerName;
  final String? customerNumber;
  final String callStatus;
  final int duration;
  final String? remarks;
  final String? recordingUrl;
  final DateTime? createdAt;

  CallLogModel({
    required this.id,
    this.leadId,
    this.empId,
    this.caller,
    this.customerName,
    this.customerNumber,
    required this.callStatus,
    this.duration = 0,
    this.remarks,
    this.recordingUrl,
    this.createdAt,
  });

  factory CallLogModel.fromJson(Map<String, dynamic> json) {
    return CallLogModel(
      id: json['call_id'] ?? json['id'] ?? 0,
      leadId: json['lead_id'] ?? json['leadId'],
      empId: json['emp_id'] ?? json['userId'],
      caller: json['caller'] ?? json['user']?['name'],
      customerName: json['customer_name'] ?? json['lead']?['customer']?['name'],
      customerNumber: json['customer_number'] ?? json['lead']?['customer']?['mobile'],
      callStatus: json['call_status'] ?? json['callStatus'] ?? 'CONNECTED',
      duration: json['duration'] ?? json['durationSec'] ?? 0,
      remarks: json['remarks'] ?? json['remark'],
      recordingUrl: json['recording_url'] ?? json['recordingUrl'],
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'lead_id': leadId,
    'emp_id': empId,
    'caller': caller,
    'customer_name': customerName,
    'customer_number': customerNumber,
    'call_status': callStatus,
    'duration': duration,
    'remarks': remarks,
    'recording_url': recordingUrl,
    'createdAt': createdAt?.toIso8601String(),
  };

  String get formattedDuration {
    final minutes = (duration / 60).floor();
    final seconds = duration % 60;
    if (minutes > 0) {
      return '${minutes}m ${seconds.toString().padLeft(2, '0')}s';
    }
    return '${seconds}s';
  }
}
