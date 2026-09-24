  import 'dart:convert';

import 'package:capital_care/constants/server_url.dart';
import 'package:capital_care/models/calls_model.dart';
import 'package:capital_care/models/history_model.dart';
import 'package:capital_care/models/leads_model.dart';
import 'package:capital_care/models/employee_model.dart';
import 'package:capital_care/models/task_model.dart';
import 'package:capital_care/models/template_model.dart';
import 'package:capital_care/models/status_model.dart';

import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';

class FilterCallsResponse {
  final List<Calls> data;
  final bool hasNextPage;
  final int totalItems;
  FilterCallsResponse({required this.data, required this.hasNextPage, required this.totalItems});
}

class ApiService {
  static String baseUrl = ServerUrl;

  static final FlutterSecureStorage secureStorage = FlutterSecureStorage();

  static Future<Map<String, dynamic>?> fetchSettings() async {
    try {
      final url = Uri.parse("$baseUrl/settings");
      final response = await http.get(url);
      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        return decoded['data'];
      }
    } catch (e) {
      print("Error fetching settings: $e");
    }
    return null;
  }

  static Future<Employee> getUserById(String userId) async {
    final url = Uri.parse("$baseUrl/employees/$userId");

    final response = await http.get(url);

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return Employee.fromJson(data);
    } else {
      throw Exception('Failed to fetch User : ${response.body}');
    }
  }

  static Future<bool> updateUser(String userId, Employee employee) async {
    final url = Uri.parse("$baseUrl/update_employee/$userId");
    final response = await http.put(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode(employee.toJson()),
    );
    if (response.statusCode == 200) {
      print("employee updated: ${response.body}");
      return true;
    } else {
      // print(
      //   "Update failed =================================================>>>>>>>>>>>>>>>: ${response.body}",
      // );
      return false;
    }
  }

  static Future<Employee> login(String username, String password) async {
    final url = Uri.parse('$baseUrl/login');
    final response = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({'username': username, 'password': password}),
    );
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);

      final token = data['token'];
      final userJson = data['employee'];

      await secureStorage.write(key: "auth_token", value: token);
      await secureStorage.write(
        key: "userId",
        value: Employee.fromJson(userJson).empId,
      );
      await secureStorage.write(
        key: "userRole",
        value: Employee.fromJson(userJson).role ?? "",
      );
      await secureStorage.write(
        key: "loginTime",
        value: DateTime.now().toIso8601String(),
      );

      return Employee.fromJson(userJson);
    } else {
      throw Exception('Login failed: ${response.body}');
    }
  }

  static Future<List<LeadStatus>> fetchLeadStatuses({String? team}) async {
    final queryParameters = <String, String>{};
    if (team != null && team.isNotEmpty) {
      queryParameters["team"] = team;
    }

    final url = Uri.parse(
      "$baseUrl/lead-statuses",
    ).replace(queryParameters: queryParameters);

    final response = await http.get(url);

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final statuses = data["statuses"] as List;
      return statuses.map((status) => LeadStatus.fromJson(status)).toList();
    }

    throw Exception("Failed to fetch lead statuses: ${response.body}");
  }

  static Future<Map<String, dynamic>> fetchLeads(
    DateTime startDate,
    DateTime endDate, {
    int page = 1,
    int? limit,
    String search = "",
    String status = "All",
    String loanType = "All",
  }) async {
    final emp_id = await secureStorage.read(key: "userId");

    // Set default values if dates are null
    final url = Uri.parse("$baseUrl/getLeadsByEmpIdAndDate/$emp_id").replace(
      queryParameters: {
        'startDate': DateFormat('yyyy-MM-dd').format(startDate),
        'endDate': DateFormat('yyyy-MM-dd').format(endDate),
        'page': page.toString(),
        if (limit != null) 'limit': limit.toString(),
        if (search.isNotEmpty) 'search': search,
        if (status != "All") 'status': status,
        if (loanType != "All") 'loanType': loanType,
      },
    );

    final response = await http.get(url);

    if (response.statusCode == 200) {
      final decoded = jsonDecode(response.body);
      final List jsonData = decoded['data'] ?? decoded;
      return {
        'leads': jsonData.map((e) => Leads.fromJson(e)).toList(),
        'pagination': decoded['pagination'],
      };
    } else {
      throw Exception("Failed to load leads");
    }
  }

  static Future<int> addLead(Leads lead) async {
    final url = Uri.parse("$baseUrl/submit-lead");
    final token = await secureStorage.read(key: "auth_token");
    final headers = {
      "Content-Type": "application/json",
      if (token != null && token.isNotEmpty) "Authorization": "Bearer $token",
    };
    final response = await http.post(
      url,
      headers: headers,
      body: jsonEncode(lead.toJson()),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      // print("lead added : ${response.body}");
      final Map<String, dynamic> jsonData = jsonDecode(response.body);
      // print(
      //   "===========================================>>>>>>>>>${jsonData['id']}",
      // );
      // print("==================================>>>>${response.body[1]}");
      return jsonData['id'];
    } else {
      print("failed : ${response.body}");
      return -1;
    }
  }

  static Future<bool> updateLead(int id, Leads lead) async {
    final url = Uri.parse(
      "$baseUrl/leads/$id",
    ); // assuming backend uses /leads/:id
    final token = await secureStorage.read(key: "auth_token");
    final headers = {
      "Content-Type": "application/json",
      if (token != null && token.isNotEmpty) "Authorization": "Bearer $token",
    };
    final response = await http.put(
      url,
      headers: headers,
      body: jsonEncode(lead.toJson()),
    );

    if (response.statusCode == 200) {
      print("Lead updated: ${response.body}");
      return true;
    } else {
      // print(
      //   "Update failed =================================================>>>>>>>>>>>>>>>: ${response.body}",
      // );
      return false;
    }
  }

  static Future<Map<String, dynamic>> getLeadsCount() async {
    final emp_id = await secureStorage.read(key: "userId");
    final url = Uri.parse("$baseUrl/getCountsByEmpId/$emp_id");

    final response = await http.get(
      url,
      headers: {"Content-Type": "application/json"},
    );

    if (response.statusCode == 200) {
      final Map<String, dynamic> jsonData = jsonDecode(response.body);
      // print("=============================>>${jsonData['fileLoginCount']}");
      // Ensure all keys are present and values are int
      return {
        'totalLeads': jsonData['totalLeads'] ?? 0,
        'fileLoginCount': jsonData['fileLoginCount'],
        'todayLeadCount': jsonData['todayFollowups'] ?? [],
        'tomorrowLeadCount': jsonData['tomorrowFollowups'] ?? [],
      };
    } else {
      throw Exception("Failed to fetch leads count");
    }
  }

  static Future<List<Leads>> getFreshLeads() async {
    final emp_id = await secureStorage.read(key: "userId");
    final url = Uri.parse("$baseUrl/getFreshLeadsByEmpId/$emp_id");
    final response = await http.get(
      url,
      headers: {"Content-Type": "application/json"},
    );
    if (response.statusCode == 200) {
      final List jsonData = jsonDecode(response.body);
      return jsonData.map((json) => Leads.fromJson(json)).toList();
    } else {
      print("${response.statusCode} error fetching fresh leads");
      return [];
    }
  }

  static Future<Map<String, dynamic>> getUnassignedFreshLeadPool() async {
    final url = Uri.parse("$baseUrl/unassigned-fresh-leads");
    final response = await http.get(
      url,
      headers: {"Content-Type": "application/json"},
    );

    if (response.statusCode == 200) {
      final Map<String, dynamic> jsonData = jsonDecode(response.body);
      final List leadsJson = jsonData["leads"] ?? [];
      return {
        "leads": leadsJson.map((json) => Leads.fromJson(json)).toList(),
        "availableCount": jsonData["availableCount"] ?? 0,
        "maxAssignable": jsonData["maxAssignable"] ?? 50,
      };
    }

    throw Exception("Failed to fetch unassigned fresh leads: ${response.body}");
  }

  static Future<Map<String, dynamic>> assignUnassignedFreshLeads(
    int count,
  ) async {
    final empId = await secureStorage.read(key: "userId");
    final url = Uri.parse("$baseUrl/assign-unassigned-fresh-leads/$empId");
    final response = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({"count": count}),
    );

    final Map<String, dynamic> jsonData =
        response.body.isNotEmpty ? jsonDecode(response.body) : {};

    if (response.statusCode == 200) {
      final List leadsJson = jsonData["leads"] ?? [];
      return {
        "message": jsonData["message"] ?? "Leads assigned successfully",
        "assignedCount": jsonData["assignedCount"] ?? 0,
        "availableCount": jsonData["availableCount"] ?? 0,
        "maxAssignable": jsonData["maxAssignable"] ?? 50,
        "leads": leadsJson.map((json) => Leads.fromJson(json)).toList(),
      };
    }

    throw Exception(jsonData["message"] ?? "Failed to assign leads");
  }

  static Future<Leads> getLeadByLeadId(var leadId) async {
    final url = Uri.parse("$baseUrl/getLead/$leadId");
    final response = await http.get(
      url,
      headers: {"Content-Type": "application/json"},
    );
    if (response.statusCode == 200) {
      final jsonData = jsonDecode(response.body);
      return Leads.fromJson(jsonData);
    } else {
      print("${response.statusCode} error fetching lead");
      return Leads();
    }
  }

  static Future<Leads> getLeadByNumber(var number) async {
    final url = Uri.parse("$baseUrl/getLeadByNumber/$number");
    final response = await http.get(url);
    if (response.statusCode == 200) {
      if (response.body == "null") {
        return Leads();
      } else {
        final jsonData = jsonDecode(response.body);
        return Leads.fromJson(jsonData);
      }
    } else {
      print("${response.statusCode} error fetching lead by number");
      return Leads();
    }
  }

  static Future<bool> addHistory(History history) async {
    final url = Uri.parse("$baseUrl/histories");
    final response = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode(history.toJson()),
    );
    if (response.statusCode == 200) {
      print("history added : ${response.body}");
      return true;
    } else {
      print("failed : ${response.body}");
      return false;
    }
  }

  static Future<List<History>> getHistory(int id) async {
    final url = Uri.parse("$baseUrl/histories/$id");

    final response = await http.get(url);

    if (response.statusCode == 200) {
      final Map<String, dynamic> jsonData = jsonDecode(response.body);

      final List historyList =
          jsonData['history']; // Extract the 'history' list
      // print(historyList[5]);

      return historyList.map((e) => History.fromJson(e)).toList();
    } else {
      throw Exception("Failed to load history");
    }
  }

  static Future<Calls?> addCalls(Calls call) async {
    final url = Uri.parse("$baseUrl/calls");
    final response = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode(call.toJson()),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      print("Call added: ${response.body}");
      final Map<String, dynamic> jsonData = jsonDecode(response.body);
      print(jsonData['call_id']);
      return Calls.fromJson(jsonData);
    } else {
      print("Failed: ${response.body}");
      return null;
    }
  }

  static Future<List<Calls>> getCalls() async {
    final emp_id = await secureStorage.read(key: "userId");
    final url = Uri.parse("$baseUrl/calls/$emp_id");
    final response = await http.get(url);
    if (response.statusCode == 200) {
      final Map<String, dynamic> jsonData = jsonDecode(response.body);

      final List callList = jsonData['calls'];
      return callList.map((e) => Calls.fromJson(e)).toList();
    } else {
      throw Exception("Failed to load Calls");
    }
  }

  static Future<List<Calls>> getCallsByDates(
    DateTime startDate,
    DateTime endDate,
  ) async {
    final emp_id = await secureStorage.read(key: "userId");
    final formattedStart =
        "${startDate.year}-${startDate.month.toString().padLeft(2, '0')}-${startDate.day.toString().padLeft(2, '0')}";

    final formattedEnd =
        "${endDate.year}-${endDate.month.toString().padLeft(2, '0')}-${endDate.day.toString().padLeft(2, '0')}";

    final url = Uri.parse("$baseUrl/callsByEmpIdAndDate/$emp_id").replace(
      queryParameters: {'startDate': formattedStart, 'endDate': formattedEnd},
    );

    final response = await http.get(url);

    if (response.statusCode == 200) {
      final Map<String, dynamic> jsonData = jsonDecode(response.body);
      final List callList = jsonData['calls'];
      return callList.map((e) => Calls.fromJson(e)).toList();
    } else {
      throw Exception("Failed to load Calls");
    }
  }

  static Future<bool> updateCall(Calls call, int callId) async {
    // print("===========================>update call called");
    final url = Uri.parse("$baseUrl/updateCall/$callId");
    final response = await http.put(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode(call.toJson()),
    );
    // print("=====================>call update ${response.body}");
    if (response.statusCode == 200) {
      print("Call updated: ${response.body}");
      return true;
    } else {
      // print(
      //   "Update failed =================================================>>>>>>>>>>>>>>>: ${response.body}",
      // );
      return false;
    }
  }

  static Future<Map<String, int>> getTotalCallsCount() async {
    final emp_id = await secureStorage.read(key: "userId");
    print(emp_id);
    final url = Uri.parse("$baseUrl/totalCallsCountByEmployee/$emp_id");
    final response = await http.get(url);

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      // print("================================>>>$data");
      return {'total': data['total'] ?? 0, 'today': data['today'] ?? 0};
    } else {
      print("Failed to get total calls count. Status: ${response.statusCode}");
      return {'total': 0, 'today': 0};
    }
  }
  static Future<FilterCallsResponse> filterCalls({
    required DateTime startDate,
    required DateTime endDate,
    String? status,
    String? loanType,
    int page = 1,
    int limit = 20,
  }) async {
    final emp_id = await secureStorage.read(key: "userId");
    try {
      final queryParameters = {
        "startDate": startDate.toIso8601String(),
        "endDate": endDate.toIso8601String(),
        if (status != null && status != "All") "status": status,
        if (loanType != null && loanType != "All") "loanType": loanType,
      };

      final uri = Uri.parse(
        "$baseUrl/filterCalls/${emp_id}",
      ).replace(queryParameters: queryParameters..addAll({
        "page": page.toString(),
        "limit": limit.toString()
      }));

      final response = await http.get(
        uri,
        headers: {"Content-Type": "application/json"},
      );

      if (response.statusCode == 200) {
        final decoded = jsonDecode(response.body);
        List<dynamic> jsonData = [];
        bool hasNextPage = false;
        int totalItems = 0;
        
        if (decoded is Map) {
          if (decoded['data'] is List) {
            jsonData = decoded['data'];
          }
          if (decoded['pagination'] is Map) {
            hasNextPage = decoded['pagination']['hasNextPage'] ?? false;
            totalItems = decoded['pagination']['totalItems'] ?? 0;
          }
        } else if (decoded is List) {
          jsonData = decoded;
          totalItems = jsonData.length;
        }

        final calls = jsonData.map((e) => Calls.fromJson(e)).toList();
        return FilterCallsResponse(data: calls, hasNextPage: hasNextPage, totalItems: totalItems);
      } else {
        throw Exception("Failed to load filtered calls");
      }
    } catch (e) {
      print("Error in filterCalls API: $e");
      return FilterCallsResponse(data: [], hasNextPage: false, totalItems: 0);
    }
  }

  static Future<Task?> addTask(Task task) async {
    final url = Uri.parse("$baseUrl/add_task");
    final response = await http.post(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode(task.toJson()),
    );

    if (response.statusCode == 200) {
      final jsonData = jsonDecode(response.body);
      print("Task added successfully: ${jsonData}");

      if (jsonData['task'] != null) {
        return Task.fromJson(jsonData['task']);
      } else {
        print("No 'task' key found in response");
        return null;
      }
    } else {
      print("Task add failed: ${response.statusCode} - ${response.body}");
      return null;
    }
  }

  static Future<List<Task>> getTasks() async {
    final emp_id = await secureStorage.read(key: "userId");
    final url = Uri.parse("$baseUrl/task/$emp_id");
    final response = await http.get(url);
    if (response.statusCode == 200) {
      final Map<String, dynamic> jsonData = jsonDecode(response.body);
      final List taskList = jsonData['tasks'];
      return taskList.map((e) => Task.fromJson(e)).toList();
    } else {
      throw Exception("Failed to load Tasks");
    }
  }

  static Future<List<Task>> getTasksByLeadId(int lead_id) async {
    final url = Uri.parse("$baseUrl/task_by_lead_id/$lead_id");
    final response = await http.get(url);
    if (response.statusCode == 200) {
      final Map<String, dynamic> jsonData = jsonDecode(response.body);
      final List taskList = jsonData['tasks'];
      // print("===============> tasks fetched + $taskList");
      return taskList.map((e) => Task.fromJson(e)).toList();
    } else {
      throw Exception("Failed to load Tasks");
    }
  }

  static Future<Task> updateTask(
    String taskId,
    Map<String, dynamic> updatedFields,
  ) async {
    final url = Uri.parse("$baseUrl/update_task/$taskId");

    final response = await http.put(
      url,
      headers: {"Content-Type": "application/json"},
      body: jsonEncode(updatedFields),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return Task.fromJson(data["task"]);
    } else {
      print("Update failed: ${response.body}");
      return Task(); // empty Task
    }
  }

  static Future<bool> deleteTask(String taskId) async {
    try {
      final url = Uri.parse(
        '$baseUrl/deleteTask/$taskId',
      ); // ✅ Adjust your route
      final response = await http.delete(
        url,
        headers: {'Content-Type': 'application/json'},
      );

      if (response.statusCode == 200) {
        return true;
      } else {
        print("Failed to delete task: ${response.body}");
        return false;
      }
    } catch (e) {
      print("Error deleting task: $e");
      return false;
    }
  }

  static Future<List<Template>> getTemplates() async {
    final url = Uri.parse("$baseUrl/get_templates");
    final response = await http.get(url);
    // print("template get krne ki koshish");
    if (response.statusCode == 200) {
      // print("status code 200 h");
      final jd = jsonDecode(response.body);
      final List jsonData = jd['data'] as List<dynamic>;
      // print("===============>${jsonData}");
      // print(jsonData.length);
      return jsonData.map((e) => Template.fromJson(e)).toList();
    } else {
      throw Exception("Failed to load templates");
    }
  }
}
