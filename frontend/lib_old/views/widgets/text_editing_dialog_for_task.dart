import 'package:capital_care/controllers/providers/task_provider.dart';
import 'package:capital_care/models/task_model.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

// final TextEditingController _titleController = TextEditingController();
// final TextEditingController _descriptionController = TextEditingController();
// final TextEditingController _priorityController = TextEditingController();
// DateTime? _startDate;
// DateTime? _endDate;
// String? _selectedStatus;
Future<void> showEditTaskDialog(Task task, BuildContext context) async {
  final TextEditingController titleController = TextEditingController(
    text: task.title,
  );
  final TextEditingController descriptionController = TextEditingController(
    text: task.description,
  );
  final TextEditingController priorityController = TextEditingController(
    text: task.priority ?? '',
  );

  DateTime? startDate = DateTime.tryParse(task.start_date);
  DateTime? endDate = DateTime.tryParse(task.end_date);
  String? selectedPriority = ["High", "Medium", "Low"].contains(task.priority) 
      ? task.priority 
      : "Low";
  String? selectedStatus = task.status;

  await showDialog(
    context: context,
    builder: (context) {
      return StatefulBuilder(
        builder: (context, setState) {
          return AlertDialog(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            title: const Text(
              'Edit Task',
              style: TextStyle(fontWeight: FontWeight.bold),
            ),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextField(
                    controller: titleController,
                    decoration: const InputDecoration(
                      labelText: 'Title',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: descriptionController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Description',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: selectedPriority,
                    items:
                        ["High", "Medium", "Low"]
                            .map(
                              (priority) => DropdownMenuItem(
                                value: priority,
                                child: Text(priority),
                              ),
                            )
                            .toList(),
                    onChanged: (value) {
                      setState(() {
                        selectedPriority = value;
                      });
                    },
                    decoration: const InputDecoration(
                      labelText: 'Priority',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 10),
                  ListTile(
                    title: Text(
                      startDate == null
                          ? 'Select Start Date'
                          : 'Start Date: ${DateFormat('d MMM, yyyy hh:mm a').format(startDate!)}',
                    ),
                    trailing: const Icon(Icons.calendar_today),
                    onTap: () async {
                      final date = await showDatePicker(
                        context: context,
                        initialDate: startDate ?? DateTime.now(),
                        firstDate: DateTime(2000),
                        lastDate: DateTime(2100),
                      );
                      if (date != null) {
                        final time = await showTimePicker(
                          context: context,
                          initialTime: TimeOfDay.fromDateTime(
                            startDate ?? DateTime.now(),
                          ),
                        );
                        if (time != null) {
                          setState(() {
                            startDate = DateTime(
                              date.year,
                              date.month,
                              date.day,
                              time.hour,
                              time.minute,
                            );
                          });
                        }
                      }
                    },
                  ),
                  ListTile(
                    title: Text(
                      endDate == null
                          ? 'Select End Date'
                          : 'End Date: ${DateFormat('d MMM, yyyy hh:mm a').format(endDate!)}',
                    ),
                    trailing: const Icon(Icons.calendar_today),
                    onTap: () async {
                      final date = await showDatePicker(
                        context: context,
                        initialDate: endDate ?? DateTime.now(),
                        firstDate: DateTime(2000),
                        lastDate: DateTime(2100),
                      );
                      if (date != null) {
                        final time = await showTimePicker(
                          context: context,
                          initialTime: TimeOfDay.fromDateTime(
                            endDate ?? DateTime.now(),
                          ),
                        );
                        if (time != null) {
                          setState(() {
                            endDate = DateTime(
                              date.year,
                              date.month,
                              date.day,
                              time.hour,
                              time.minute,
                            );
                          });
                        }
                      }
                    },
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: selectedStatus,
                    items:
                        ["Initial", "On Going", "Completed"]
                            .map(
                              (status) => DropdownMenuItem(
                                value: status,
                                child: Text(status),
                              ),
                            )
                            .toList(),
                    onChanged: (value) {
                      setState(() {
                        selectedStatus = value;
                      });
                    },
                    decoration: const InputDecoration(
                      labelText: 'Status',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text(
                  'Cancel',
                  style: TextStyle(color: Colors.red),
                ),
              ),
              ElevatedButton(
                onPressed: () {
                  if (titleController.text.isEmpty ||
                      descriptionController.text.isEmpty ||
                      startDate == null ||
                      endDate == null ||
                      selectedPriority == null) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Please fill all fields')),
                    );
                    return;
                  }

                  final updatedTask = {
                    "title": titleController.text,
                    "description": descriptionController.text,
                    "priority": selectedPriority,
                    "start_date": startDate!.toIso8601String(),
                    "end_date": endDate!.toIso8601String(),
                    "status": selectedStatus,
                  };

                  final provider = Provider.of<TaskProvider>(
                    context,
                    listen: false,
                  );
                  provider.updateTask(task.task_id, updatedTask);
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
                child: const Text('Submit'),
              ),
            ],
          );
        },
      );
    },
  );
}
