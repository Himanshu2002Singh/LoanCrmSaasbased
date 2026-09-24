import 'package:capital_care/models/task_model.dart';
import 'package:capital_care/services/api_service.dart';
import 'package:flutter/cupertino.dart';

class TaskProvider with ChangeNotifier {
  List<Task> _tasks = [];

  List<Task> get tasks => _tasks;
  // List<Task> get tasksByLeadId => _tasks.where((task)=> task)

  Future<void> addTask(Task newTask) async {
    Task addedTask = await ApiService.addTask(newTask) ?? Task();
    if (addedTask.task_id != null) {
      _tasks.insert(0, addedTask);
      notifyListeners();
    }
  }

  Future<void> fetchTasks() async {
    _tasks = await ApiService.getTasks();
    notifyListeners();
  }

  Future<void> updateTask(
    int taskId,
    Map<String, dynamic> updatedFields,
  ) async {
    final updatedTask = await ApiService.updateTask(
      taskId.toString(),
      updatedFields,
    );
    if (updatedTask.task_id != null) {
      final index = _tasks.indexWhere((t) => t.task_id == taskId);
      if (index != -1) {
        _tasks[index] = updatedTask;
        notifyListeners();
      }
    }
  }

  Future<void> deleteTask(int taskId) async {
    bool success = await ApiService.deleteTask(taskId.toString());
    if (success) {
      _tasks.removeWhere((task) => task.task_id == taskId);
      notifyListeners();
    }
  }
}
