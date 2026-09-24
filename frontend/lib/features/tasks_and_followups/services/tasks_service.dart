import 'package:capital_care/core/constants/api_constants.dart';
import 'package:capital_care/core/networking/api_client.dart';
import 'package:capital_care/features/tasks_and_followups/models/task_model.dart';
import 'package:capital_care/features/tasks_and_followups/models/followup_model.dart';

class TasksResponse {
  final List<TaskModel> tasks;
  final int totalItems;
  final int totalPages;

  TasksResponse({required this.tasks, required this.totalItems, required this.totalPages});
}

class FollowUpsResponse {
  final List<FollowUpModel> followUps;
  final int totalItems;
  final int totalPages;

  FollowUpsResponse({required this.followUps, required this.totalItems, required this.totalPages});
}

class TasksService {
  Future<TasksResponse> getTasks({
    int page = 1,
    int limit = 25,
    String? status,
    String? priority,
    String? search,
  }) async {
    final query = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (status != null && status.isNotEmpty && status != 'ALL') query['status'] = status;
    if (priority != null && priority.isNotEmpty && priority != 'ALL') query['priority'] = priority;
    if (search != null && search.isNotEmpty) query['search'] = search;

    final response = await ApiClient.get(
      ApiConstants.tasks,
      queryParameters: query,
    );

    final rows = (response['rows'] as List<dynamic>? ?? response['data'] as List<dynamic>? ?? [])
        .map((e) => TaskModel.fromJson(e as Map<String, dynamic>))
        .toList();

    final pagination = response['pagination'] as Map<String, dynamic>? ?? {};
    final totalItems = pagination['totalItems'] ?? pagination['total'] ?? rows.length;
    final totalPages = pagination['totalPages'] ?? pagination['pages'] ?? 1;

    return TasksResponse(
      tasks: rows,
      totalItems: totalItems is int ? totalItems : int.tryParse(totalItems.toString()) ?? rows.length,
      totalPages: totalPages is int ? totalPages : int.tryParse(totalPages.toString()) ?? 1,
    );
  }

  Future<TaskModel> createTask(Map<String, dynamic> data) async {
    final response = await ApiClient.post(ApiConstants.tasks, body: data);
    final row = response['data'] ?? response['task'] ?? response;
    return TaskModel.fromJson(row as Map<String, dynamic>);
  }

  Future<TaskModel> updateTask(int taskId, Map<String, dynamic> data) async {
    final response = await ApiClient.put('${ApiConstants.tasks}/$taskId', body: data);
    final row = response['data'] ?? response['task'] ?? response;
    return TaskModel.fromJson(row as Map<String, dynamic>);
  }

  Future<FollowUpsResponse> getFollowUps({
    int page = 1,
    int limit = 25,
    String? window, // 'today', 'overdue', 'upcoming'
    String? status,
  }) async {
    final query = <String, String>{
      'page': page.toString(),
      'limit': limit.toString(),
    };
    if (window != null && window.isNotEmpty && window != 'all') query['window'] = window;
    if (status != null && status.isNotEmpty && status != 'ALL') query['status'] = status;

    final response = await ApiClient.get(
      ApiConstants.followups,
      queryParameters: query,
    );

    final rows = (response['rows'] as List<dynamic>? ?? response['data'] as List<dynamic>? ?? [])
        .map((e) => FollowUpModel.fromJson(e as Map<String, dynamic>))
        .toList();

    final pagination = response['pagination'] as Map<String, dynamic>? ?? {};
    final totalItems = pagination['totalItems'] ?? pagination['total'] ?? rows.length;
    final totalPages = pagination['totalPages'] ?? pagination['pages'] ?? 1;

    return FollowUpsResponse(
      followUps: rows,
      totalItems: totalItems is int ? totalItems : int.tryParse(totalItems.toString()) ?? rows.length,
      totalPages: totalPages is int ? totalPages : int.tryParse(totalPages.toString()) ?? 1,
    );
  }

  Future<FollowUpModel> createFollowUp(Map<String, dynamic> data) async {
    final response = await ApiClient.post(ApiConstants.followups, body: data);
    final row = response['data'] ?? response['followUp'] ?? response;
    return FollowUpModel.fromJson(row as Map<String, dynamic>);
  }

  Future<FollowUpModel> completeFollowUp(int followupId, {String? remarks}) async {
    final response = await ApiClient.put(
      '${ApiConstants.followups}/$followupId',
      body: {
        'status': 'COMPLETED',
        if (remarks != null) 'remarks': remarks,
      },
    );
    final row = response['data'] ?? response['followUp'] ?? response;
    return FollowUpModel.fromJson(row as Map<String, dynamic>);
  }
}
