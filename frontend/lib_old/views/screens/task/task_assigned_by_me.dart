import 'package:capital_care/controllers/providers/task_provider.dart';
import 'package:capital_care/models/task_model.dart';
import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/screens/task/add_task_screen.dart';
import 'package:capital_care/views/widgets/app_scaffold.dart';
import 'package:capital_care/views/widgets/custom_appbar.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:capital_care/views/widgets/text_editing_dialog_for_task.dart';

class TasksAssignedByMeScreen extends StatefulWidget {
  const TasksAssignedByMeScreen({super.key});

  @override
  State<TasksAssignedByMeScreen> createState() =>
      _TasksAssignedByMeScreenState();
}

class _TasksAssignedByMeScreenState extends State<TasksAssignedByMeScreen> {
  List<Task> filteredTasks = [];
  bool is_adminSelected = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = Provider.of<TaskProvider>(context, listen: false);
      provider.fetchTasks().then((_) {
        setState(() {
          filteredTasks = provider.tasks;
        });
      });
    });
  }

  // @override
  // void dispose() {
  //   _titleController.dispose();
  //   _descriptionController.dispose();
  //   _priorityController.dispose();
  //   super.dispose();
  // }

  void filterTasks(String query) {
    final provider = Provider.of<TaskProvider>(context, listen: false);
    if (query.isEmpty) {
      filteredTasks = provider.tasks;
    } else {
      filteredTasks =
          provider.tasks
              .where(
                (task) =>
                    task.title.toLowerCase().contains(query.toLowerCase()),
              )
              .toList();
    }
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final taskProvider = Provider.of<TaskProvider>(context);

    return AppScaffold(
      isFloatingActionButton: true,
      floatingActionButtonIcon: const Icon(Icons.add),
      floatingActionButtonOnTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => AddTaskScreen(),
          ),
        );
      },
      appBar: CustomAppbar(title: "Tasks"),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              color: AppColors.primaryColor,
              child: SearchBar(
                constraints: const BoxConstraints(minHeight: 40),
                hintText: "Search by Task Title",
                hintStyle: MaterialStateProperty.all(
                  const TextStyle(color: Colors.grey),
                ),
                leading: Icon(Icons.search, color: AppColors.primaryColor),
                backgroundColor: MaterialStateProperty.all(Colors.white),
                onChanged: filterTasks,
              ),
            ),
            Expanded(
              child:
                  filteredTasks.isEmpty
                      ? const Center(child: Text("No tasks found."))
                      : ListView.builder(
                        padding: const EdgeInsets.all(10),
                        itemCount: filteredTasks.length,
                        itemBuilder: (context, index) {
                          final t = filteredTasks[index];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            elevation: 2,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          t.title,
                                          style: const TextStyle(
                                            fontSize: 18,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                      IconButton(
                                        icon: const Icon(
                                          Icons.edit,
                                          color: Colors.blue,
                                        ),
                                        onPressed: () {
                                          showEditTaskDialog(t, context);
                                        },
                                      ),
                                      IconButton(
                                        icon: const Icon(
                                          Icons.delete,
                                          color: Colors.red,
                                        ),
                                        onPressed: () {
                                          // Delete logic
                                          showDialog(
                                            context: context,
                                            builder: (_) {
                                              return AlertDialog(
                                                backgroundColor: Colors.white,
                                                title: Text(t.title),
                                                content: Text(
                                                  "Are you shure want to delete?",
                                                ),
                                                actions: [
                                                  TextButton(
                                                    onPressed: () {
                                                      Navigator.pop(context);
                                                    },
                                                    child: Text("Cancel"),
                                                  ),
                                                  ElevatedButton(
                                                    onPressed: () {
                                                      taskProvider.deleteTask(
                                                        t.task_id,
                                                      );
                                                      Navigator.pop(context);
                                                    },
                                                    child: Text("Yes"),
                                                    style:
                                                        ElevatedButton.styleFrom(
                                                          backgroundColor:
                                                              Colors.red,
                                                          foregroundColor:
                                                              Colors.white,
                                                        ),
                                                  ),
                                                ],
                                              );
                                            },
                                          );
                                        },
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.person,
                                        size: 18,
                                        color: Colors.grey,
                                      ),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          "Assigned by: ${t.assigned_by_name ?? "Unknown"}",
                                          style: const TextStyle(
                                            color: Colors.grey,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.access_time,
                                        size: 18,
                                        color: Colors.grey,
                                      ),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          "${formatDateTime(t.start_date)} - ${formatDateTime(t.end_date)}",
                                          style: const TextStyle(
                                            color: Colors.grey,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.flag,
                                        size: 18,
                                        color: Colors.grey,
                                      ),
                                      const SizedBox(width: 6),
                                      Text("Priority: ${t.priority ?? "-"}"),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Icon(
                                        Icons.description,
                                        size: 18,
                                        color: Colors.grey,
                                      ),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          t.description,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.end,
                                    children: [
                                      const Text(
                                        "Status: ",
                                        style: TextStyle(
                                          fontWeight: FontWeight.w500,
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 10,
                                        ),
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(
                                            10,
                                          ),
                                          color:
                                              t.status == "Initial"
                                                  ? Colors.orangeAccent
                                                  : t.status == "On Going"
                                                  ? Colors.blue
                                                  : Colors.green,
                                        ),
                                        child: DropdownButton<String>(
                                          value: t.status,
                                          items:
                                              [
                                                    "Initial",
                                                    "On Going",
                                                    "Completed",
                                                  ]
                                                  .map(
                                                    (status) =>
                                                        DropdownMenuItem(
                                                          value: status,
                                                          child: Text(status),
                                                        ),
                                                  )
                                                  .toList(),
                                          onChanged: (newStatus) {
                                            if (newStatus != null) {
                                              if (newStatus != t.status) {
                                                showDialog(
                                                  context: context,
                                                  builder: (_) {
                                                    return AlertDialog(
                                                      shape: RoundedRectangleBorder(
                                                        borderRadius:
                                                            BorderRadius.circular(
                                                              16,
                                                            ),
                                                      ),
                                                      title: const Text(
                                                        'Change Status',
                                                        style: TextStyle(
                                                          fontWeight:
                                                              FontWeight.bold,
                                                        ),
                                                      ),
                                                      content: Text(
                                                        'Do you want to change the status of "${t.title}" from "${t.status}" to "$newStatus"?',
                                                        style: const TextStyle(
                                                          fontSize: 16,
                                                        ),
                                                      ),
                                                      actions: [
                                                        TextButton(
                                                          onPressed: () {
                                                            Navigator.pop(
                                                              context,
                                                            );
                                                          },
                                                          child: const Text(
                                                            'No',
                                                            style: TextStyle(
                                                              color: Colors.red,
                                                            ),
                                                          ),
                                                        ),
                                                        ElevatedButton(
                                                          onPressed: () {
                                                            taskProvider
                                                                .updateTask(
                                                                  t.task_id,
                                                                  {
                                                                    "status":
                                                                        newStatus,
                                                                  },
                                                                );
                                                            Navigator.pop(
                                                              context,
                                                            );
                                                          },
                                                          style:
                                                              ElevatedButton.styleFrom(
                                                                backgroundColor:
                                                                    Colors
                                                                        .green,
                                                              ),
                                                          child: const Text(
                                                            'Yes',
                                                          ),
                                                        ),
                                                      ],
                                                    );
                                                  },
                                                );
                                              }
                                            }
                                          },
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
            ),
          ],
        ),
      ),
    );
  }
}

String formatDateTime(String dateTimeString) {
  if (dateTimeString.isEmpty) return "";
  final dateTime = DateTime.tryParse(dateTimeString);
  if (dateTime == null) return dateTimeString; // fallback to original string if not parsable
  return DateFormat('d MMM, yyyy hh:mm a').format(dateTime);
}
