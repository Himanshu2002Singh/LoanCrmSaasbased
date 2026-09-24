import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:capital_care/features/applications/models/application_model.dart';
import 'package:capital_care/features/applications/services/application_service.dart';

final applicationServiceProvider = Provider<ApplicationService>((ref) {
  return ApplicationService();
});

class ApplicationsState {
  final List<ApplicationModel> applications;
  final bool isLoading;
  final String? error;
  final String selectedStatus;

  ApplicationsState({
    this.applications = const [],
    this.isLoading = false,
    this.error,
    this.selectedStatus = 'ALL',
  });

  ApplicationsState copyWith({
    List<ApplicationModel>? applications,
    bool? isLoading,
    String? error,
    String? selectedStatus,
  }) {
    return ApplicationsState(
      applications: applications ?? this.applications,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      selectedStatus: selectedStatus ?? this.selectedStatus,
    );
  }
}

class ApplicationsNotifier extends StateNotifier<ApplicationsState> {
  final ApplicationService _service;

  ApplicationsNotifier(this._service) : super(ApplicationsState()) {
    loadApplications();
  }

  Future<void> loadApplications() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await _service.getApplications(
        status: state.selectedStatus != 'ALL' ? state.selectedStatus : null,
      );
      state = state.copyWith(applications: res.applications, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void setStatus(String status) {
    state = state.copyWith(selectedStatus: status);
    loadApplications();
  }

  Future<void> updateStatus(int id, String status, {String? rejectionReason}) async {
    await _service.updateStatus(id, status, rejectionReason: rejectionReason);
    loadApplications();
  }
}

final applicationsNotifierProvider = StateNotifierProvider<ApplicationsNotifier, ApplicationsState>((ref) {
  final service = ref.watch(applicationServiceProvider);
  return ApplicationsNotifier(service);
});
