import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:capital_care/features/auth/providers/auth_provider.dart';
import 'package:capital_care/features/leads/models/lead_model.dart';
import 'package:capital_care/features/leads/models/lead_status_model.dart';
import 'package:capital_care/features/leads/models/master_config_model.dart';
import 'package:capital_care/features/leads/models/template_model.dart';
import 'package:capital_care/features/leads/services/lead_service.dart';

final leadServiceProvider = Provider<LeadService>((ref) {
  return LeadService();
});

final leadStatusesProvider = FutureProvider<List<LeadStatusModel>>((ref) async {
  final service = ref.watch(leadServiceProvider);
  final authState = ref.watch(currentUserProvider);
  final user = authState.value;

  String? team;
  if (user != null) {
    if (user.isOps) {
      team = 'operations';
    } else if (user.isCaller || user.role == 'MANAGER') {
      team = 'calling';
    }
  }

  return await service.getLeadStatuses(team: team);
});

final loanProductsProvider = FutureProvider<List<MasterConfigModel>>((ref) async {
  final service = ref.watch(leadServiceProvider);
  return await service.getMasterConfigs('LOAN_PRODUCT');
});

final leadSourcesProvider = FutureProvider<List<MasterConfigModel>>((ref) async {
  final service = ref.watch(leadServiceProvider);
  return await service.getMasterConfigs('LEAD_SOURCE');
});

final documentTypesProvider = FutureProvider<List<MasterConfigModel>>((ref) async {
  final service = ref.watch(leadServiceProvider);
  return await service.getMasterConfigs('DOC_TYPE');
});

final templatesProvider = FutureProvider.autoDispose<List<TemplateModel>>((ref) async {
  final service = ref.watch(leadServiceProvider);
  return await service.getTemplates();
});

final singleLeadProvider = FutureProvider.family.autoDispose<LeadModel, int>((ref, leadId) async {
  final service = ref.watch(leadServiceProvider);
  return await service.getLeadById(leadId);
});

class LeadsState {
  final List<LeadModel> leads;
  final bool isLoading;
  final bool isLoadingMore;
  final String? error;
  final int currentPage;
  final int totalPages;
  final int totalItems;
  final String searchQuery;
  final String selectedStatus;
  final String? selectedLoanType;
  final String? selectedPriority;
  final bool unassignedOnly;

  LeadsState({
    this.leads = const [],
    this.isLoading = false,
    this.isLoadingMore = false,
    this.error,
    this.currentPage = 1,
    this.totalPages = 1,
    this.totalItems = 0,
    this.searchQuery = '',
    this.selectedStatus = 'ALL',
    this.selectedLoanType,
    this.selectedPriority,
    this.unassignedOnly = false,
  });

  LeadsState copyWith({
    List<LeadModel>? leads,
    bool? isLoading,
    bool? isLoadingMore,
    String? error,
    int? currentPage,
    int? totalPages,
    int? totalItems,
    String? searchQuery,
    String? selectedStatus,
    String? selectedLoanType,
    String? selectedPriority,
    bool? unassignedOnly,
  }) {
    return LeadsState(
      leads: leads ?? this.leads,
      isLoading: isLoading ?? this.isLoading,
      isLoadingMore: isLoadingMore ?? this.isLoadingMore,
      error: error,
      currentPage: currentPage ?? this.currentPage,
      totalPages: totalPages ?? this.totalPages,
      totalItems: totalItems ?? this.totalItems,
      searchQuery: searchQuery ?? this.searchQuery,
      selectedStatus: selectedStatus ?? this.selectedStatus,
      selectedLoanType: selectedLoanType ?? this.selectedLoanType,
      selectedPriority: selectedPriority ?? this.selectedPriority,
      unassignedOnly: unassignedOnly ?? this.unassignedOnly,
    );
  }
}

class LeadsNotifier extends StateNotifier<LeadsState> {
  final LeadService _leadService;

  LeadsNotifier(this._leadService) : super(LeadsState()) {
    loadLeads();
  }

  Future<void> loadLeads({bool refresh = false}) async {
    if (refresh) {
      state = state.copyWith(isLoading: true, currentPage: 1, error: null);
    } else {
      state = state.copyWith(isLoading: true, error: null);
    }

    try {
      final response = await _leadService.getLeads(
        page: 1,
        limit: 25,
        search: state.searchQuery.isNotEmpty ? state.searchQuery : null,
        status: state.selectedStatus != 'ALL' ? state.selectedStatus : null,
        loanType: state.selectedLoanType,
        priority: state.selectedPriority,
        unassigned: state.unassignedOnly ? true : null,
      );

      state = state.copyWith(
        leads: response.leads,
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
      final response = await _leadService.getLeads(
        page: nextPage,
        limit: 25,
        search: state.searchQuery.isNotEmpty ? state.searchQuery : null,
        status: state.selectedStatus != 'ALL' ? state.selectedStatus : null,
        loanType: state.selectedLoanType,
        priority: state.selectedPriority,
        unassigned: state.unassignedOnly ? true : null,
      );

      state = state.copyWith(
        leads: [...state.leads, ...response.leads],
        isLoadingMore: false,
        currentPage: response.currentPage,
        totalPages: response.totalPages,
        totalItems: response.totalItems,
      );
    } catch (e) {
      state = state.copyWith(isLoadingMore: false, error: e.toString());
    }
  }

  void setSearchQuery(String query) {
    if (state.searchQuery == query) return;
    state = state.copyWith(searchQuery: query);
    loadLeads(refresh: true);
  }

  void setStatusFilter(String status) {
    if (state.selectedStatus == status) return;
    state = state.copyWith(selectedStatus: status);
    loadLeads(refresh: true);
  }

  void setLoanTypeFilter(String? loanType) {
    state = state.copyWith(selectedLoanType: loanType);
    loadLeads(refresh: true);
  }

  void setPriorityFilter(String? priority) {
    state = state.copyWith(selectedPriority: priority);
    loadLeads(refresh: true);
  }

  void setUnassignedFilter(bool unassigned) {
    state = state.copyWith(unassignedOnly: unassigned);
    loadLeads(refresh: true);
  }

  void applyFilters({
    String? loanType,
    String? priority,
    bool? unassignedOnly,
    String? status,
  }) {
    state = state.copyWith(
      selectedLoanType: loanType,
      selectedPriority: priority,
      unassignedOnly: unassignedOnly ?? state.unassignedOnly,
      selectedStatus: status ?? state.selectedStatus,
    );
    loadLeads(refresh: true);
  }

  void resetAllFilters() {
    state = state.copyWith(
      selectedStatus: 'ALL',
      selectedLoanType: null,
      selectedPriority: null,
      unassignedOnly: false,
      searchQuery: '',
    );
    loadLeads(refresh: true);
  }

  Future<LeadModel?> createLead(Map<String, dynamic> data) async {
    try {
      final newLead = await _leadService.createLead(data);
      loadLeads(refresh: true);
      return newLead;
    } catch (e) {
      state = state.copyWith(error: e.toString());
      rethrow;
    }
  }

  Future<void> updateLeadStatus(
    int leadId,
    String status, {
    String? remarks,
    String? nextMeeting,
  }) async {
    try {
      await _leadService.updateLeadStatus(
        leadId,
        status: status,
        remarks: remarks,
        nextMeeting: nextMeeting,
      );
      loadLeads(refresh: true);
    } catch (e) {
      state = state.copyWith(error: e.toString());
      rethrow;
    }
  }
}

final leadsNotifierProvider = StateNotifierProvider<LeadsNotifier, LeadsState>((ref) {
  final service = ref.watch(leadServiceProvider);
  return LeadsNotifier(service);
});
