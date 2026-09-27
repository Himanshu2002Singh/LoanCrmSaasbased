import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:capital_care/features/expenses/models/expense_model.dart';
import 'package:capital_care/features/expenses/services/expense_service.dart';

final expenseServiceProvider = Provider<ExpenseService>((ref) {
  return ExpenseService();
});

class ExpenseState {
  final List<ExpenseModel> expenses;
  final List<String> categories;
  final ExpenseStatsModel stats;
  final String selectedMonth;
  final String selectedCategory;
  final String selectedStatus;
  final String searchQuery;
  final bool isLoading;
  final bool isSubmitting;
  final String? error;

  ExpenseState({
    this.expenses = const [],
    this.categories = const [],
    required this.stats,
    required this.selectedMonth,
    this.selectedCategory = 'ALL',
    this.selectedStatus = 'ALL',
    this.searchQuery = '',
    this.isLoading = false,
    this.isSubmitting = false,
    this.error,
  });

  double get calculatedTotal {
    if (stats.totalAmount > 0) return stats.totalAmount;
    return expenses.fold<double>(0.0, (sum, e) => sum + e.totalAmount);
  }

  double get calculatedPaid {
    if (stats.totalPaid > 0) return stats.totalPaid;
    return expenses.where((e) => e.isPaid).fold<double>(0.0, (sum, e) => sum + e.totalAmount);
  }

  double get calculatedPending {
    if (stats.totalPending > 0) return stats.totalPending;
    return expenses.where((e) => e.isPending).fold<double>(0.0, (sum, e) => sum + e.totalAmount);
  }

  ExpenseState copyWith({
    List<ExpenseModel>? expenses,
    List<String>? categories,
    ExpenseStatsModel? stats,
    String? selectedMonth,
    String? selectedCategory,
    String? selectedStatus,
    String? searchQuery,
    bool? isLoading,
    bool? isSubmitting,
    String? error,
  }) {
    return ExpenseState(
      expenses: expenses ?? this.expenses,
      categories: categories ?? this.categories,
      stats: stats ?? this.stats,
      selectedMonth: selectedMonth ?? this.selectedMonth,
      selectedCategory: selectedCategory ?? this.selectedCategory,
      selectedStatus: selectedStatus ?? this.selectedStatus,
      searchQuery: searchQuery ?? this.searchQuery,
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      error: error,
    );
  }
}

class ExpenseNotifier extends StateNotifier<ExpenseState> {
  final ExpenseService _service;

  ExpenseNotifier(this._service)
      : super(
          ExpenseState(
            stats: ExpenseStatsModel(),
            selectedMonth: DateFormat('yyyy-MM').format(DateTime.now()),
            categories: ExpenseService.defaultCategories,
          ),
        ) {
    loadAll();
  }

  Future<void> loadAll() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final cats = await _service.getCategories();
      final res = await _service.getExpenses(
        month: state.selectedMonth,
        category: state.selectedCategory,
        status: state.selectedStatus,
        search: state.searchQuery,
      );

      state = state.copyWith(
        categories: cats.isNotEmpty ? cats : ExpenseService.defaultCategories,
        expenses: res['rows'] as List<ExpenseModel>,
        stats: (res['stats'] as ExpenseStatsModel?) ?? ExpenseStatsModel(),
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> setMonth(String month) async {
    if (state.selectedMonth == month) return;
    state = state.copyWith(selectedMonth: month);
    await loadAll();
  }

  Future<void> setCategory(String category) async {
    if (state.selectedCategory == category) return;
    state = state.copyWith(selectedCategory: category);
    await loadAll();
  }

  Future<void> setStatus(String status) async {
    if (state.selectedStatus == status) return;
    state = state.copyWith(selectedStatus: status);
    await loadAll();
  }

  Future<void> setSearch(String query) async {
    state = state.copyWith(searchQuery: query);
    await loadAll();
  }

  Future<bool> createExpense(Map<String, dynamic> data) async {
    state = state.copyWith(isSubmitting: true, error: null);
    try {
      await _service.createExpense(data);
      state = state.copyWith(isSubmitting: false);
      await loadAll();
      return true;
    } catch (e) {
      state = state.copyWith(isSubmitting: false, error: e.toString());
      rethrow;
    }
  }

  Future<bool> updateExpense(int id, Map<String, dynamic> data) async {
    state = state.copyWith(isSubmitting: true, error: null);
    try {
      await _service.updateExpense(id, data);
      state = state.copyWith(isSubmitting: false);
      await loadAll();
      return true;
    } catch (e) {
      state = state.copyWith(isSubmitting: false, error: e.toString());
      rethrow;
    }
  }

  Future<bool> deleteExpense(int id) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _service.deleteExpense(id);
      await loadAll();
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      rethrow;
    }
  }
}

final expenseStateProvider = StateNotifierProvider<ExpenseNotifier, ExpenseState>((ref) {
  final service = ref.watch(expenseServiceProvider);
  return ExpenseNotifier(service);
});
