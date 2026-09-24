import 'package:capital_care/models/status_model.dart';
import 'package:capital_care/services/api_service.dart';
import 'package:flutter/foundation.dart';

class StatusProvider with ChangeNotifier {
  List<LeadStatus> _statuses = [];
  bool _isLoading = false;
  String? _error;

  List<LeadStatus> get statuses => _statuses;
  bool get isLoading => _isLoading;
  String? get error => _error;

  List<String> get statusNames => _statuses.map((s) => s.name).toList();
  
  List<String> get statusNamesWithAll => ['All', ..._statuses.map((s) => s.name)];

  Future<void> fetchStatuses({String? team}) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _statuses = await ApiService.fetchLeadStatuses(team: team);
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _error = e.toString();
      _isLoading = false;
      notifyListeners();
    }
  }

  LeadStatus? getStatusByName(String name) {
    try {
      return _statuses.firstWhere((status) => status.name == name);
    } catch (e) {
      return null;
    }
  }

  LeadStatus? getStatusById(int id) {
    try {
      return _statuses.firstWhere((status) => status.statusId == id);
    } catch (e) {
      return null;
    }
  }

  void refreshStatuses({String? team}) {
    fetchStatuses(team: team);
  }
}
