import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:capital_care/features/telecalling/models/call_log_model.dart';
import 'package:capital_care/features/telecalling/services/telecalling_service.dart';

final telecallingServiceProvider = Provider<TelecallingService>((ref) {
  return TelecallingService();
});

class CallsState {
  final List<CallLogModel> calls;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final int currentPage;
  final int totalPages;
  final int totalItems;
  final String selectedStatus;

  CallsState({
    this.calls = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.currentPage = 1,
    this.totalPages = 1,
    this.totalItems = 0,
    this.selectedStatus = 'ALL',
  });

  CallsState copyWith({
    List<CallLogModel>? calls,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    int? currentPage,
    int? totalPages,
    int? totalItems,
    String? selectedStatus,
  }) {
    return CallsState(
      calls: calls ?? this.calls,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: error,
      currentPage: currentPage ?? this.currentPage,
      totalPages: totalPages ?? this.totalPages,
      totalItems: totalItems ?? this.totalItems,
      selectedStatus: selectedStatus ?? this.selectedStatus,
    );
  }
}

class CallsNotifier extends StateNotifier<CallsState> {
  final TelecallingService _service;

  CallsNotifier(this._service) : super(CallsState()) {
    loadCalls();
  }

  Future<void> loadCalls({bool refresh = false}) async {
    if (refresh) {
      state = state.copyWith(isLoading: true, currentPage: 1, error: null);
    } else {
      state = state.copyWith(isLoading: true, error: null);
    }

    try {
      final response = await _service.getCalls(
        page: 1,
        limit: 25,
        callStatus: state.selectedStatus != 'ALL' ? state.selectedStatus : null,
      );

      state = state.copyWith(
        calls: response.calls,
        isLoading: false,
        currentPage: response.currentPage,
        totalPages: response.totalPages,
        totalItems: response.totalItems,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> loadMore() async {
    if (state.isLoadingMore || state.currentPage >= state.totalPages) return;

    state = state.copyWith(isLoadingMore: true);
    final nextPage = state.currentPage + 1;

    try {
      final response = await _service.getCalls(
        page: nextPage,
        limit: 25,
        callStatus: state.selectedStatus != 'ALL' ? state.selectedStatus : null,
      );

      state = state.copyWith(
        calls: [...state.calls, ...response.calls],
        isLoadingMore: false,
        currentPage: response.currentPage,
        totalPages: response.totalPages,
        totalItems: response.totalItems,
      );
    } catch (e) {
      state = state.copyWith(isLoadingMore: false, error: e.toString());
    }
  }

  void setStatusFilter(String status) {
    if (state.selectedStatus == status) return;
    state = state.copyWith(selectedStatus: status);
    loadCalls(refresh: true);
  }

  Future<void> logCall(Map<String, dynamic> data) async {
    await _service.logCall(data);
    loadCalls(refresh: true);
  }
}

final callsNotifierProvider = StateNotifierProvider<CallsNotifier, CallsState>((ref) {
  final service = ref.watch(telecallingServiceProvider);
  return CallsNotifier(service);
});
