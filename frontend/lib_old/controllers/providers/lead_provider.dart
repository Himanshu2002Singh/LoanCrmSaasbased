import 'package:capital_care/models/leads_model.dart';
import 'package:capital_care/services/api_service.dart';
import 'package:flutter/material.dart';

class LeadProvider with ChangeNotifier {
  List<Leads> _leads = [];
  int _totalLeadsCount = 0;
  List<Leads> _todayLeads = [];
  List<Leads> _tomorrowLeads = [];
  List<Leads> _fileLoginLeads = [];
  DateTime _lastStartDate = DateTime.now();
  DateTime _lastEndDate = DateTime.now().add(Duration(days: 1));

  // List<Leads> _freshLeads = [];
  bool _isLoading = false;
  bool _hasMore = true;
  int _currentPage = 1;
  int _currentViewTotalLeads = 0;

  List<Leads> get leads => _leads;
  int get totalLeadsCount => _totalLeadsCount;
  List<Leads> get todayLeads => _todayLeads;
  List<Leads> get tomorrowLeads => _tomorrowLeads;
  List<Leads> get fileLoginLeads => _fileLoginLeads;
  bool get hasMore => _hasMore;
  int get currentViewTotalLeads => _currentViewTotalLeads;

  // int allLeads => _allLeads;
  Future<List<Leads>> get freshLeads async {
    return await ApiService.getFreshLeads();
  }

  Future<Map<String, dynamic>> get unassignedFreshLeadPool async {
    return await ApiService.getUnassignedFreshLeadPool();
  }

  bool get isLoading => _isLoading;

  Future<void> fetchLeads({
    DateTime? start,
    DateTime? end,
    bool loadMore = false,
    String search = "",
    String status = "All",
    String loanType = "All",
  }) async {
    if (loadMore) {
      if (!_hasMore || _isLoading) return;
      _currentPage++;
      _isLoading = true;
      notifyListeners();
    } else {
      _isLoading = true;
      _currentPage = 1;
      _hasMore = true;
      _leads = [];
      notifyListeners();
    }

    try {
      DateTime startDate = start ?? _lastStartDate;
      DateTime endDate = end ?? _lastEndDate;
      if (!loadMore) {
        startDate = start ?? DateTime.now().subtract(const Duration(days: 30));
        endDate = end ?? DateTime.now();
        endDate = endDate.add(const Duration(days: 1));
        _lastStartDate = startDate;
        _lastEndDate = endDate;
      }

      final result = await ApiService.fetchLeads(
        startDate,
        endDate,
        page: _currentPage,
        search: search,
        status: status,
        loanType: loanType,
      );

      final List<Leads> fetchedLeads = List<Leads>.from(result['leads']);

      if (loadMore) {
        _leads.addAll(fetchedLeads);
      } else {
        _leads = fetchedLeads;
      }

      if (result['pagination'] != null) {
        _currentViewTotalLeads = result['pagination']['totalItems'] ?? 0;
        _hasMore = result['pagination']['hasNextPage'] ?? false;
      } else {
        _currentViewTotalLeads = _leads.length;
        _hasMore = false;
      }
    } catch (e) {
      print("Error fetching leads: $e");
      if (!loadMore) _leads = [];
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Future<void> fetchFreshLeads() async {
  //   _isLoading = true;
  //   notifyListeners();

  //   _freshLeads = _leads.where((lead) => lead.status == "Fresh Lead").toList();

  //   _isLoading = false;
  //   notifyListeners();
  //   print(_freshLeads);
  // }

  Future<void> fetchAllLeads() async {
    try {
      Map<String, dynamic> data = await ApiService.getLeadsCount();

      _totalLeadsCount = data["totalLeads"] ?? 0;

      _todayLeads =
          (data['todayLeadCount'] as List)
              .map((item) => Leads.fromJson(item))
              .toList();

      _tomorrowLeads =
          (data['tomorrowLeadCount'] as List)
              .map((item) => Leads.fromJson(item))
              .toList();

      _fileLoginLeads =
          (data['fileLoginCount'] as List)
              .map((item) => Leads.fromJson(item))
              .toList();
    } catch (e) {
      print("Error fetching all leads: $e");
      _leads = [];
    } finally {
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> assignUnassignedFreshLeads(int count) async {
    final result = await ApiService.assignUnassignedFreshLeads(count);
    final List<Leads> assignedLeads = result["leads"] ?? [];

    for (final lead in assignedLeads) {
      final index = _leads.indexWhere((item) => item.lead_id == lead.lead_id);
      if (index == -1) {
        _leads.insert(0, lead);
      } else {
        _leads[index] = lead;
      }
    }

    _totalLeadsCount += assignedLeads.length;
    notifyListeners();
    return result;
  }

  Future<int> addLead(Leads newLead) async {
    try {
      int newId = await ApiService.addLead(newLead);

      if (newId != -1) {
        DateTime now = DateTime.now();
        if (now.isAfter(_lastStartDate) && now.isBefore(_lastEndDate)) {
          _leads.add(newLead);
        }

        _totalLeadsCount++;

        if (newLead.status == "File Login") {
          _fileLoginLeads.insert(0, newLead);
        }

        DateTime today = DateTime(now.year, now.month, now.day);
        DateTime tomorrow = today.add(Duration(days: 1));

        // 🔁 Convert next_meeting to DateTime (date-only)
        DateTime? nextMeeting;
        try {
          if (newLead.next_meeting is String) {
            final parsed = DateTime.parse(newLead.next_meeting);
            nextMeeting = DateTime(parsed.year, parsed.month, parsed.day);
          } else if (newLead.next_meeting is DateTime) {
            nextMeeting = DateTime(
              newLead.next_meeting.year,
              newLead.next_meeting.month,
              newLead.next_meeting.day,
            );
          }
        } catch (e) {
          print("Invalid next_meeting format: $e");
        }

        if (nextMeeting != null) {
          if (nextMeeting == today) {
            _todayLeads.insert(0, newLead);
          } else if (nextMeeting == tomorrow) {
            _tomorrowLeads.insert(0, newLead);
          }
        }

        notifyListeners();
        return newId;
      }
      return -1;
    } catch (e) {
      print("Error adding lead: $e");
      return -1;
    }
  }

  Future<bool> updateLead(Leads updatedLead, int leadId) async {
    // print("==============================> updateleadCalled");
    try {
      bool success = await ApiService.updateLead(leadId, updatedLead);
      if (success) {
        final index = _leads.indexWhere((lead) => lead.lead_id == leadId);

        if (index != -1) {
          final oldLead = _leads[index];

          final mergedLead = Leads(
            lead_id: oldLead.lead_id,
            person_id: updatedLead.person_id ?? oldLead.person_id,
            name: updatedLead.name ?? oldLead.name,
            number: updatedLead.number ?? oldLead.number,
            email: updatedLead.email ?? oldLead.email,
            // dob: updatedLead.dob ?? oldLead.dob,
            owner: updatedLead.owner ?? oldLead.owner,
            source: updatedLead.source ?? oldLead.source,
            priority: updatedLead.priority ?? oldLead.priority,
            status: updatedLead.status ?? oldLead.status,
            next_meeting: updatedLead.next_meeting ?? oldLead.next_meeting,
            refrence: updatedLead.refrence ?? oldLead.refrence,
            description: updatedLead.description ?? oldLead.description,
            address: updatedLead.address ?? oldLead.address,
            loanType: updatedLead.loanType ?? oldLead.loanType,
            est_budget: updatedLead.est_budget ?? oldLead.est_budget,
            remark: updatedLead.remark ?? oldLead.remark,
            createdAt: oldLead.createdAt,
            employment_type:
                updatedLead.employment_type ?? oldLead.employment_type,
            // loan_term: updatedLead.loan_term ?? oldLead.loan_term,
          );

          // File login handling
          if (oldLead.status == "File Login" &&
              updatedLead.status != "File Login") {
            _fileLoginLeads.removeWhere(
              (lead) => lead.lead_id == oldLead.lead_id,
            );
          }
          if (updatedLead.status == "File Login" &&
              oldLead.status != "File Login") {
            _fileLoginLeads.insert(0, mergedLead);
          }

          // Replace in _leads
          _leads[index] = mergedLead;

          final now = DateTime.now();
          final today = DateTime(now.year, now.month, now.day);
          final tomorrow = today.add(Duration(days: 1));

          // Helper to get date-only value (returns null if invalid/empty)
          DateTime? toDateOnly(dynamic val) {
            if (val == null) return null;
            final str = val.toString().trim();
            if (str.isEmpty || str.toLowerCase() == 'null') return null;
            try {
              if (val is String) {
                final dt = DateTime.parse(str);
                return DateTime(dt.year, dt.month, dt.day);
              } else if (val is DateTime) {
                return DateTime(val.year, val.month, val.day);
              }
            } catch (e) {
              print("toDateOnly parsing error: $e");
            }
            return null;
          }

          final oldLeadNextMeetingDate = toDateOnly(oldLead.next_meeting);
          final updatedNextMeetingDate = toDateOnly(mergedLead.next_meeting);

          if (oldLeadNextMeetingDate != null) {
            if (oldLeadNextMeetingDate == today) {
              _todayLeads.removeWhere(
                (lead) => lead.lead_id == oldLead.lead_id,
              );
            }

            if (oldLeadNextMeetingDate == tomorrow) {
              _tomorrowLeads.removeWhere(
                (lead) => lead.lead_id == oldLead.lead_id,
              );
            }
          }

          if (updatedNextMeetingDate != null) {
            if (updatedNextMeetingDate == today) {
              _todayLeads.removeWhere(
                (lead) => lead.lead_id == mergedLead.lead_id,
              );
              _todayLeads.insert(0, mergedLead);
            } else if (updatedNextMeetingDate == tomorrow) {
              _tomorrowLeads.removeWhere(
                (lead) => lead.lead_id == mergedLead.lead_id,
              );
              _tomorrowLeads.insert(0, mergedLead);
            }
          }

          // print("=====================================> lead updated");
          notifyListeners();
        }
        return true;
      }
      return false;
    } catch (e) {
      print("Error updating lead: $e");
      return false;
    }
  }

  Leads? getLeadIfAvailable(var lead_id) {
    // print("=================> provider me dhunda");
    final index = _leads.indexWhere((lead) => lead.lead_id == lead_id);
    if (index != -1) {
      return _leads[index];
    }
    return null;
  }
}
