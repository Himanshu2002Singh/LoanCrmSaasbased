import 'package:capital_care/controllers/providers/lead_provider.dart';
import 'package:capital_care/controllers/providers/task_provider.dart';
import 'package:capital_care/controllers/providers/userprovider.dart';
import 'package:capital_care/models/leads_model.dart';
import 'package:capital_care/models/task_model.dart';
import 'package:capital_care/services/api_service.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:dropdown_search/dropdown_search.dart';

import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/widgets/custom_appbar.dart';
import 'package:capital_care/views/widgets/custom_button.dart';

class AddTaskScreen extends StatefulWidget {
  final lead;

  const AddTaskScreen({super.key, this.lead});
  @override
  _AddTaskScreenState createState() => _AddTaskScreenState();
}

class _AddTaskScreenState extends State<AddTaskScreen> {
  // Leads? selectedLead;
  String? priority;

  DateTime? startDate;
  DateTime? endDate;

  final descriptionController = TextEditingController();
  final nameController = TextEditingController();

  void handle_submit() async {
    if (nameController.text == null || nameController.text.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Title can't be empty")));
      return;
    }

    Task newTask = Task(
      emp_id: Provider.of<UserProvider>(context, listen: false).user?.empId,
      title: nameController.text,
      choose_lead: widget.lead != null ? widget.lead.name : null,
      lead_id: widget.lead != null ? widget.lead.lead_id : null,
      start_date: startDate?.toIso8601String(),
      end_date: endDate?.toIso8601String(),
      priority: priority,
      description: descriptionController.text,
      status: "Initial",
      assigned_by_id:
          Provider.of<UserProvider>(context, listen: false).user?.empId,
      assigned_by_name:
          Provider.of<UserProvider>(context, listen: false).user?.ename,
    );

    Provider.of<TaskProvider>(context, listen: false).addTask(newTask);
    Navigator.pop(context);
    // ScaffoldMessenger.of(
    //   context,
    // ).showSnackBar(SnackBar(content: Text(success ? "Success" : "Error")));
    // if (success) {
    //   Navigator.pop(context);
    // }
  }

  Future<void> _selectDateTime(BuildContext context, bool isStart) async {
    final DateTime? pickedDate = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2023),
      lastDate: DateTime(2030),
    );

    if (pickedDate != null) {
      final TimeOfDay? pickedTime = await showTimePicker(
        context: context,
        initialTime: TimeOfDay.now(),
      );

      if (pickedTime != null) {
        final DateTime fullDateTime = DateTime(
          pickedDate.year,
          pickedDate.month,
          pickedDate.day,
          pickedTime.hour,
          pickedTime.minute,
        );

        setState(() {
          if (isStart) {
            startDate = fullDateTime;
          } else {
            endDate = fullDateTime;
          }
        });
      }
    }
  }

  List<Leads> getFilteredLeads(String? filter, List<Leads> allLeads) {
    if (filter == null || filter.isEmpty) {
      return allLeads.take(10).toList(); // load initial 10
    } else {
      return allLeads
          .where(
            (lead) => lead.name.toLowerCase().contains(filter.toLowerCase()),
          )
          .take(10)
          .toList(); // filtered with limit
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: CustomAppbar(title: "Add Task", leading: const BackButton()),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text("Add Title"),
              const SizedBox(height: 6),
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  hintText: "Name",
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              const Text("Task Start Date"),
              GestureDetector(
                onTap: () => _selectDateTime(context, true),
                child: AbsorbPointer(
                  child: TextFormField(
                    decoration: InputDecoration(
                      hintText:
                          startDate != null
                              ? DateFormat(
                                'dd-MM-yyyy hh:mm a',
                              ).format(startDate!)
                              : 'Select date & time',
                      border: const OutlineInputBorder(),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 16),
              const Text("Task End Date"),
              GestureDetector(
                onTap: () => _selectDateTime(context, false),
                child: AbsorbPointer(
                  child: TextFormField(
                    decoration: InputDecoration(
                      hintText:
                          endDate != null
                              ? DateFormat(
                                'dd-MM-yyyy hh:mm a',
                              ).format(startDate!)
                              : 'Select date & time',
                      border: const OutlineInputBorder(),
                    ),
                  ),
                ),
              ),

              const SizedBox(height: 16),

              const Text("Task Priority"),
              buildDropdown(
                value: priority,
                hint: 'Select Priority',
                items: ["High", "Medium", "Low"],
                onChanged: (val) => setState(() => priority = val),
              ),

              const Text("Description"),
              TextField(
                controller: descriptionController,
                maxLines: 4,
                decoration: const InputDecoration(
                  hintText: "Write about task.",
                  border: OutlineInputBorder(),
                ),
              ),

              const SizedBox(height: 20),
              CustomButton(
                text: "Add Task",
                onPressed: () {
                  // TODO: Add Task Logic Here
                  handle_submit();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget buildDropdown({
    required String? value,
    required String hint,
    required List<String> items,
    required void Function(String?) onChanged,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.black38),
        borderRadius: BorderRadius.circular(5),
      ),
      child: DropdownButtonFormField<String>(
        value: value,
        isExpanded: true,
        dropdownColor: Colors.white,
        decoration: const InputDecoration(border: InputBorder.none),
        hint: Text(hint),
        style: const TextStyle(color: Colors.black87, fontSize: 16),
        items:
            items
                .map(
                  (item) =>
                      DropdownMenuItem<String>(value: item, child: Text(item)),
                )
                .toList(),
        onChanged: onChanged,
      ),
    );
  }
}
