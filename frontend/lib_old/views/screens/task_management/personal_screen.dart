import 'package:capital_care/views/widgets/custom_button.dart';
import 'package:flutter/material.dart';
import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/widgets/app_scaffold.dart';
import 'package:capital_care/views/widgets/custom_appbar.dart';

class PersonalScreen extends StatefulWidget {
  PersonalScreen({super.key});

  @override
  State<PersonalScreen> createState() => _PersonalScreenState();
}

class _PersonalScreenState extends State<PersonalScreen> {
  TextEditingController titleController = TextEditingController();
  TextEditingController remindMeController = TextEditingController();
  TextEditingController notesController = TextEditingController();

  bool isAllDay = false;
  DateTime? selectedDateTime;

  Future<void> _selectDateTime() async {
    final DateTime? date = await showDatePicker(
      context: context,
      initialDate: selectedDateTime ?? DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime(2101),
    );

    if (date != null) {
      final TimeOfDay? time = await showTimePicker(
        context: context,
        initialTime: TimeOfDay.fromDateTime(selectedDateTime ?? DateTime.now()),
      );

      if (time != null) {
        setState(() {
          selectedDateTime = DateTime(
            date.year,
            date.month,
            date.day,
            time.hour,
            time.minute,
          );
          remindMeController.text =
              "${selectedDateTime!.day}/${selectedDateTime!.month}/${selectedDateTime!.year} ${time.format(context)}";
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      isFloatingActionButton: true,
      floatingActionButtonIcon: Icon(Icons.add),
      floatingActionButtonOnTap: () {
        _showDialogBox();
      },
      appBar: CustomAppbar(title: "Personal"),
      body: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              AppColors.primaryColor,
              const Color.fromARGB(255, 203, 238, 254),
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Card(
          child: Container(
            height: MediaQuery.of(context).size.height,
            width: MediaQuery.of(context).size.width,
          ),
        ),
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
    );
  }

  Widget _buildTextField(TextEditingController controller, String hint) {
    return TextField(
      controller: controller,
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(color: Colors.grey),
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 12,
          vertical: 10,
        ),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  Future<dynamic> _showDialogBox() {
    return showDialog(
      context: context,
      builder: (context) {
        return Dialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Header
                Container(
                  decoration: BoxDecoration(
                    color: AppColors.primaryColor,
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(12),
                    ),
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 12,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        "Add Task",
                        style: TextStyle(
                          color: AppColors.appBarForegroundColor,
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      GestureDetector(
                        onTap: () => Navigator.of(context).pop(),
                        child: Icon(
                          Icons.close,
                          color: AppColors.appBarForegroundColor,
                        ),
                      ),
                    ],
                  ),
                ),

                // Content
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildLabel("Title"),
                      _buildTextField(titleController, "Enter task title"),

                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Checkbox(
                            value: isAllDay,
                            onChanged: (bool? newValue) {
                              setState(() {
                                isAllDay = newValue!;
                              });
                            },
                          ),
                          const Text("All Day"),
                        ],
                      ),

                      const SizedBox(height: 10),
                      _buildLabel("Remind Me"),
                      GestureDetector(
                        onTap: _selectDateTime,
                        child: AbsorbPointer(
                          child: _buildTextField(
                            remindMeController,
                            "Select date and time",
                          ),
                        ),
                      ),

                      const SizedBox(height: 10),
                      _buildLabel("Notes"),
                      _buildTextField(notesController, "Add notes here"),
                      SizedBox(height: 20),
                      CustomButton(text: "Submit", onPressed: () {}),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
