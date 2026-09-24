import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:capital_care/features/dashboard/models/dashboard_stats_model.dart';
import 'package:capital_care/features/dashboard/services/dashboard_service.dart';

final dashboardServiceProvider = Provider<DashboardService>((ref) {
  return DashboardService();
});

final dashboardDataProvider = FutureProvider.autoDispose<DashboardData>((ref) async {
  final service = ref.watch(dashboardServiceProvider);
  return await service.getDashboardData();
});
