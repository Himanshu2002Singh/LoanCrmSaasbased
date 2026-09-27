import 'package:capital_care/core/constants/api_constants.dart';
import 'package:capital_care/core/networking/api_client.dart';
import 'package:capital_care/features/expenses/models/expense_model.dart';

class ExpenseService {
  static const List<String> defaultCategories = [
    'Travel & Fuel',
    'Client Meeting & Food',
    'Tea, Coffee & Pantry',
    'Mobile Recharge',
    'Stationery & Printing',
    'Courier & Postage',
    'Software & Subscriptions',
    'Office Rent',
    'Electricity & Utility',
    'Office Maintenance',
    'Marketing & Advertising',
    'Staff Welfare',
    'Legal & Accounting',
    'Miscellaneous',
  ];

  Future<Map<String, dynamic>> getExpenses({
    String? month,
    String? category,
    String? status,
    String? search,
    int page = 1,
    int limit = 50,
  }) async {
    final query = <String, dynamic>{
      'page': page.toString(),
      'limit': limit.toString(),
    };

    if (month != null && month != 'ALL') query['month'] = month;
    if (category != null && category != 'ALL') query['category'] = category;
    if (status != null && status != 'ALL') query['status'] = status;
    if (search != null && search.trim().isNotEmpty) query['search'] = search.trim();

    final response = await ApiClient.get(
      ApiConstants.expenses,
      queryParameters: query,
    );

    final rawList = response['data'] ?? response['rows'] ?? (response is List ? response : []);
    final rows = (rawList as List<dynamic>)
        .map((e) => ExpenseModel.fromJson(e as Map<String, dynamic>))
        .toList();

    final stats = response['stats'] != null
        ? ExpenseStatsModel.fromJson(response['stats'] as Map<String, dynamic>)
        : null;

    return {
      'rows': rows,
      'stats': stats,
      'total': response['pagination']?['totalItems'] ?? rows.length,
    };
  }

  Future<List<String>> getCategories() async {
    try {
      final response = await ApiClient.get(ApiConstants.expenseCategories);
      final rawList = response['data'] ?? (response is List ? response : []);
      if (rawList is List && rawList.isNotEmpty) {
        return rawList.map((e) => e.toString()).toList();
      }
    } catch (_) {
      // Fallback to defaults
    }
    return defaultCategories;
  }

  Future<ExpenseModel> createExpense(Map<String, dynamic> data) async {
    final response = await ApiClient.post(
      ApiConstants.expenses,
      body: data,
    );
    final row = response['data'] ?? response['expense'] ?? response;
    return ExpenseModel.fromJson(row as Map<String, dynamic>);
  }

  Future<ExpenseModel> updateExpense(int id, Map<String, dynamic> data) async {
    final response = await ApiClient.put(
      '${ApiConstants.expenses}/$id',
      body: data,
    );
    final row = response['data'] ?? response['expense'] ?? response;
    return ExpenseModel.fromJson(row as Map<String, dynamic>);
  }

  Future<bool> deleteExpense(int id) async {
    await ApiClient.delete('${ApiConstants.expenses}/$id');
    return true;
  }
}
