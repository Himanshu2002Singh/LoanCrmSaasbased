class DashboardCounts {
  final int totalLeads;
  final int totalCalls;
  final int todayFollowups;
  final int pendingFollowups;
  final int upcomingFollowups;
  final int unassignedLeads;

  DashboardCounts({
    this.totalLeads = 0,
    this.totalCalls = 0,
    this.todayFollowups = 0,
    this.pendingFollowups = 0,
    this.upcomingFollowups = 0,
    this.unassignedLeads = 0,
  });

  factory DashboardCounts.fromJson(Map<String, dynamic>? json) {
    if (json == null) return DashboardCounts();
    return DashboardCounts(
      totalLeads: json['totalLeads'] ?? 0,
      totalCalls: json['totalCalls'] ?? 0,
      todayFollowups: json['todayFollowups'] ?? 0,
      pendingFollowups: json['pendingFollowups'] ?? 0,
      upcomingFollowups: json['upcomingFollowups'] ?? 0,
      unassignedLeads: json['unassignedLeads'] ?? 0,
    );
  }
}

class DashboardData {
  final DashboardCounts counts;
  final Map<String, int> leadStatusCounts;
  final Map<String, int> loanTypeCounts;
  final Map<String, int> sourceCounts;
  final List<dynamic> employeeStats;

  DashboardData({
    required this.counts,
    required this.leadStatusCounts,
    required this.loanTypeCounts,
    required this.sourceCounts,
    required this.employeeStats,
  });

  factory DashboardData.fromJson(Map<String, dynamic> json) {
    final statusMap = <String, int>{};
    if (json['leadStatusCounts'] != null && json['leadStatusCounts'] is Map) {
      (json['leadStatusCounts'] as Map).forEach((k, v) {
        statusMap[k.toString()] = int.tryParse(v.toString()) ?? 0;
      });
    }

    final loanMap = <String, int>{};
    if (json['loanTypeCounts'] != null && json['loanTypeCounts'] is Map) {
      (json['loanTypeCounts'] as Map).forEach((k, v) {
        loanMap[k.toString()] = int.tryParse(v.toString()) ?? 0;
      });
    }

    final sourceMap = <String, int>{};
    if (json['sourceCounts'] != null && json['sourceCounts'] is Map) {
      (json['sourceCounts'] as Map).forEach((k, v) {
        sourceMap[k.toString()] = int.tryParse(v.toString()) ?? 0;
      });
    }

    return DashboardData(
      counts: DashboardCounts.fromJson(json['counts']),
      leadStatusCounts: statusMap,
      loanTypeCounts: loanMap,
      sourceCounts: sourceMap,
      employeeStats: json['employeeStats'] as List<dynamic>? ?? [],
    );
  }
}
