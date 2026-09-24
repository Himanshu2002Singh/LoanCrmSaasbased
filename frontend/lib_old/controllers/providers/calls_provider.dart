import 'package:capital_care/models/calls_model.dart';
import 'package:capital_care/services/api_service.dart';
import 'package:flutter/material.dart';

class CallsProvider with ChangeNotifier {
  // List<Calls> _calls = [];
  List<Calls> _filteredCalls = [];
  List<Calls> _newCalls = [];
  int _totalCallsCount = 0;
  int _todayCallsCount = 0;

  DateTime lastStartDate = DateTime.now();
  DateTime lastEndDate = DateTime.now();
  String _lastStatus = "All";
  String _lastLoanType = "All";

  int _currentPage = 1;
  bool _hasNextPage = true;
  bool _isFetchingMore = false;
  int _totalFilteredCallsCount = 0;

  List<Calls> get filteredCalls => _filteredCalls;
  int get totalCallsCount => _totalCallsCount;
  int get todayCallsCount => _todayCallsCount;
  bool get isFetchingMore => _isFetchingMore;
  bool get hasNextPage => _hasNextPage;
  int get totalFilteredCallsCount => _totalFilteredCallsCount;

  Future<void> addCall(Calls call) async {
    try {
      Calls? newCall = await ApiService.addCalls(call);
      if (newCall != null) {
        // _calls.insert(0, newCall); // ✅ insert at top of list
        _newCalls.add(newCall);
        DateTime now = DateTime.now();
        if (now.isAfter(lastStartDate) && now.isBefore(lastEndDate)) {
          // your code here
          _filteredCalls.insert(0, newCall);
        }
        _totalCallsCount++;
        _todayCallsCount++;
        notifyListeners();
      }
    } catch (e) {
      print("Error adding new call: $e");
    }
  }

  Future<bool> updateLastCallRemark(String newRemark) async {
    Calls lastCall = _newCalls.last;
    Calls updatedCall = Calls(
      call_id: lastCall.call_id,
      lead_id: lastCall.lead_id,
      emp_id: lastCall.emp_id,
      name: lastCall.name,
      number: lastCall.number,
      remark: newRemark,
      createdAt: lastCall.createdAt,
    );

    try {
      bool success = await ApiService.updateCall(updatedCall, lastCall.call_id);

      if (success) {
        int index = _filteredCalls.lastIndexWhere(
          (c) => c.call_id == lastCall.call_id,
        );
        if (index != -1) _filteredCalls[index] = updatedCall;
        notifyListeners();
        return true;
      } else {
        print("❌ API update failed");
        return false;
      }
    } catch (e) {
      print("❌ Exception during update: $e");
      return false;
    }
  }

  Future<void> fetchTotalCalls() async {
    try {
      final counts = await ApiService.getTotalCallsCount();
      _totalCallsCount = counts['total'] ?? 0;
      _todayCallsCount = counts['today'] ?? 0;
    } catch (e) {
      print("Error fetching calls: $e");
      _totalCallsCount = 0;
      _todayCallsCount = 0;
    } finally {
      notifyListeners();
    }
  }

  Future<void> filterCallsByDateRange(
    DateTime? start,
    DateTime? end,
    String status,
    String loanType,
  ) async {
    try {
      DateTime startDate =
          start ?? DateTime.now().subtract(const Duration(days: 30));
      DateTime endDate = end ?? DateTime.now();
      endDate = endDate.add(Duration(days: 1));

      _currentPage = 1;
      _hasNextPage = true;
      _lastStatus = status;
      _lastLoanType = loanType;
      lastStartDate = startDate;
      lastEndDate = endDate;

      FilterCallsResponse response = await ApiService.filterCalls(
        startDate: startDate,
        endDate: endDate,
        status: status,
        loanType: loanType,
        page: _currentPage,
        limit: 20,
      );
      
      _filteredCalls = response.data;
      _hasNextPage = response.hasNextPage;
      _totalFilteredCallsCount = response.totalItems;
      notifyListeners();
    } catch (e) {
      print("Error filtering calls by date range: $e");
      _filteredCalls = [];
      _hasNextPage = false;
      _totalFilteredCallsCount = 0;
      notifyListeners();
    }
  }

  Future<void> fetchMoreFilteredCalls() async {
    if (!_hasNextPage || _isFetchingMore) return;

    _isFetchingMore = true;
    notifyListeners();

    try {
      _currentPage++;
      FilterCallsResponse response = await ApiService.filterCalls(
        startDate: lastStartDate,
        endDate: lastEndDate,
        status: _lastStatus,
        loanType: _lastLoanType,
        page: _currentPage,
        limit: 20,
      );

      _filteredCalls.addAll(response.data);
      _hasNextPage = response.hasNextPage;
    } catch (e) {
      print("Error fetching more calls: $e");
    } finally {
      _isFetchingMore = false;
      notifyListeners();
    }
  }

}
