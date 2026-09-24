import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:capital_care/features/tasks_and_followups/models/task_model.dart';
import 'package:capital_care/features/tasks_and_followups/models/followup_model.dart';
import 'package:capital_care/features/tasks_and_followups/services/tasks_service.dart';

final tasksServiceProvider = Provider<TasksService>((ref) {
  return TasksService();
});

// Tasks State
class TasksState {
  final List<TaskModel> tasks;
  final bool isLoading;
  final String? error;
  final String selectedStatus;
  final String selectedPriority;

  TasksState({
    this.tasks = const [],
    this.isLoading = false,
    this.error,
    this.selectedStatus = 'ALL',
    this.selectedPriority = 'ALL',
  });

  TasksState copyWith({
    List<TaskModel>? tasks,
    bool? isLoading,
    String? error,
    String? selectedStatus,
    String? selectedPriority,
  }) {
    return TasksState(
      tasks: tasks ?? this.tasks,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      selectedStatus: selectedStatus ?? this.selectedStatus,
      selectedPriority: selectedPriority ?? this.selectedPriority,
    );
  }
}

class TasksNotifier extends StateNotifier<TasksState> {
  final TasksService _service;

  TasksNotifier(this._service) : super(TasksState()) {
    loadTasks();
  }

  Future<void> loadTasks() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await _service.getTasks(
        status: state.selectedStatus != 'ALL' ? state.selectedStatus : null,
        priority: state.selectedPriority != 'ALL' ? state.selectedPriority : null,
      );
      state = state.copyWith(tasks: res.tasks, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void setStatus(String status) {
    state = state.copyWith(selectedStatus: status);
    loadTasks();
  }

  void setPriority(String priority) {
    state = state.copyWith(selectedPriority: priority);
    loadTasks();
  }

  Future<void> createTask(Map<String, dynamic> data) async {
    await _service.createTask(data);
    loadTasks();
  }

  Future<void> toggleTaskStatus(TaskModel task) async {
    final nextStatus = task.status == 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    await _service.updateTask(task.id, {'status': nextStatus});
    loadTasks();
  }
}

final tasksNotifierProvider = StateNotifierProvider<TasksNotifier, TasksState>((ref) {
  final service = ref.watch(tasksServiceProvider);
  return TasksNotifier(service);
});

// FollowUps State
class FollowUpsState {
  final List<FollowUpModel> followUps;
  final bool isLoading;
  final String? error;
  final String selectedWindow; // 'today', 'overdue', 'upcoming', 'all'

  FollowUpsState({
    this.followUps = const [],
    this.isLoading = false,
    this.error,
    this.selectedWindow = 'today',
  });

  FollowUpsState copyWith({
    List<FollowUpModel>? followUps,
    bool? isLoading,
    String? error,
    String? selectedWindow,
  }) {
    return FollowUpsState(
      followUps: followUps ?? this.followUps,
      isLoading: isLoading ?? this.isLoading,
      error: error,
      selectedWindow: selectedWindow ?? this.selectedWindow,
    );
  }
}

class FollowUpsNotifier extends StateNotifier<FollowUpsState> {
  final TasksService _service;

  FollowUpsNotifier(this._service) : super(FollowUpsState()) {
    loadFollowUps();
  }

  Future<void> loadFollowUps() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await _service.getFollowUps(window: state.selectedWindow);
      state = state.copyWith(followUps: res.followUps, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void setWindow(String window) {
    state = state.copyWith(selectedWindow: window);
    loadFollowUps();
  }

  Future<void> completeFollowUp(int followupId, {String? remarks}) async {
    await _service.completeFollowUp(followupId, remarks: remarks);
    loadFollowUps();
  }
}

final followUpsNotifierProvider = StateNotifierProvider<FollowUpsNotifier, FollowUpsState>((ref) {
  final service = ref.watch(tasksServiceProvider);
  return FollowUpsNotifier(service);
});
