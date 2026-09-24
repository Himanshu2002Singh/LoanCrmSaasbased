import 'dart:ffi';

import 'package:capital_care/controllers/providers/calls_provider.dart';
import 'package:capital_care/controllers/providers/history_provider.dart';
import 'package:capital_care/controllers/providers/lead_provider.dart';
import 'package:capital_care/controllers/providers/userprovider.dart';
import 'package:capital_care/controllers/providers/status_provider.dart';
import 'package:capital_care/models/calls_model.dart';
import 'package:capital_care/models/employee_model.dart';
import 'package:capital_care/models/history_model.dart';
import 'package:capital_care/models/leads_model.dart';

import 'package:capital_care/services/api_service.dart';
import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/widgets/custom_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';

class CallDetailsScreen extends StatefulWidget {
  final lead;
  final number;
  CallDetailsScreen({super.key, this.lead, this.number});

  @override
  State<CallDetailsScreen> createState() => _CallDetailsScreenState();
}

class _CallDetailsScreenState extends State<CallDetailsScreen> {
  bool isSubmitting = false;
  String? feedbackStatus;

  String? priority;

  String? source;

  String? loanType;

  final TextEditingController nextMeetingController = TextEditingController();

  final TextEditingController budgetController = TextEditingController();

  final TextEditingController remarkController = TextEditingController();
  final TextEditingController contactNameController = TextEditingController();

  final TextEditingController descriptionController = TextEditingController();

  void handleSubmission() async {
    if (isSubmitting) return;
    setState(() {
      isSubmitting = true;
    });
    updateCall();
    if (feedbackStatus == null) {
      feedbackStatus = (widget.lead.status == null || widget.lead.status.toString().isEmpty) ? null : widget.lead.status;
    }
    if (loanType == null) {
      loanType = (widget.lead.loanType == null || widget.lead.loanType.toString().isEmpty) ? null : widget.lead.loanType;
    }
    if (priority == null) {
      priority = (widget.lead.priority == null || widget.lead.priority.toString().isEmpty) ? null : widget.lead.priority;
    }

    if (feedbackStatus == null || priority == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Feedback Status and Priority are required *"),
          backgroundColor: Colors.red,
        ),
      );
      setState(() {
        isSubmitting = false;
      });
      return;
    }

    try {
      Leads updateLead = Leads(
        status: feedbackStatus!,
        loanType: loanType,
        priority: priority!,
        next_meeting: nextMeetingController.text,
        est_budget: budgetController.text,
        remark: remarkController.text,
      );

      History newHistory = History(
        lead_id: widget.lead.lead_id,
        owner: widget.lead.owner,
        next_meeting: nextMeetingController.text,
        status: feedbackStatus,
        loanType: loanType,
        remark: remarkController.text,
      );

      bool success = await Provider.of<LeadProvider>(
        context,
        listen: false,
      ).updateLead(updateLead, widget.lead.lead_id);

      if (success) {
        Provider.of<HistoryProvider>(context, listen: false).addHistory(newHistory);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Call details submitted successfully!"),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Failed to submit call details. Please try again."),
            backgroundColor: Colors.red,
          ),
        );
        setState(() {
          isSubmitting = false;
        });
      }
    } catch (e) {
      print("Error submitting call details: $e");
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Error: $e"),
          backgroundColor: Colors.red,
        ),
      );
      setState(() {
        isSubmitting = false;
      });
    }
  }

  void updateCall() async {
    // print("==================================> update call called");
    final storage = FlutterSecureStorage();
    final userId = await storage.read(key: "userId");

    if (userId == null) {
      print("User ID not found");
      return;
    }
    // final callProvider = Provider.of<CallsProvider>(context, listen: false);
    // List<Calls> callList = callProvider.calls;

    // if (callList.isEmpty) {
    //   print("No calls found for this user");
    //   return;
    // }

    Provider.of<CallsProvider>(
      context,
      listen: false,
    ).updateLastCallRemark(remarkController.text);

    // bool success = await ApiService.updateCall(newCall, callList[0].call_id);

    // print(
    //   success
    //       ? "=================> Call updated successfully"
    //       : "Failed to update call",
    // );
  }

  void addLeadSubmission() async {
    if (isSubmitting) return;
    setState(() {
      isSubmitting = true;
    });

    int idOfLead;
    // updateCall();
    if (contactNameController.text.isEmpty) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("fill contact name")));
      setState(() {
        isSubmitting = false;
      });
      return;
    }
    try {
      final user = Provider.of<UserProvider>(context, listen: false).user;
      Leads newLead = Leads(
        name: contactNameController.text,
        number: widget.number,
        person_id: user?.empId,
        owner: user?.ename,
        source: source,
        description: descriptionController.text,
        status: feedbackStatus,
        next_meeting: nextMeetingController.text,
        remark: remarkController.text,
        est_budget: budgetController.text,
        loanType: loanType,
        priority: priority,
      );
      // bool success = await ApiService.addLead(newLead);
      int newLeadId = await Provider.of<LeadProvider>(
        context,
        listen: false,
      ).addLead(newLead);
      idOfLead = newLeadId;
      if (idOfLead != -1) {
        updateHistory(user?.ename, user?.empId, idOfLead);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("New lead added successfully!"),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("Failed to add new lead. Please try again."),
            backgroundColor: Colors.red,
          ),
        );
        setState(() {
          isSubmitting = false;
        });
      }
    } catch (e) {
      print("Error submitting new lead: $e");
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Error: $e"),
          backgroundColor: Colors.red,
        ),
      );
      setState(() {
        isSubmitting = false;
      });
    }
  }

  void updateHistory(ename, emp_id, idOfLead) async {
    // List<Leads> leads = Provider.of<LeadProvider>(context, listen: false).leads;

    History newHistory = History(
      lead_id: idOfLead ?? widget.lead.lead_id,
      owner: ename,
      next_meeting: nextMeetingController.text,
      status: feedbackStatus,
      remark: remarkController.text,
      loanType: loanType,
    );
    // await ApiService.addHistory(newHistory);
    Provider.of<HistoryProvider>(context, listen: false).addHistory(newHistory);

    Calls call = Calls(
      lead_id: idOfLead ?? widget.lead.lead_id,
      emp_id: emp_id,
      name: contactNameController.text,
      number: widget.number,
      remark: remarkController.text,
    );
    // await ApiService.addCalls(call);
    Provider.of<CallsProvider>(context, listen: false).addCall(call);
  }

  @override
  void initState() {
    super.initState();
    nextMeetingController.text = (widget.lead != null && widget.lead.next_meeting != null)
        ? widget.lead.next_meeting.toString()
        : "";
    budgetController.text = (widget.lead != null && widget.lead.est_budget != null)
        ? widget.lead.est_budget.toString()
        : "";
    remarkController.text = (widget.lead != null && widget.lead.remark != null)
        ? widget.lead.remark.toString()
        : "";
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final user = Provider.of<UserProvider>(context, listen: false).user;
      final role = user?.role;
      String? team;
      if (role == 'calling' || role == 'operations') {
        team = role;
      }
      Provider.of<StatusProvider>(context, listen: false).fetchStatuses(team: team);
    });
  }

  @override
  Widget build(BuildContext context) {
    final statusProvider = Provider.of<StatusProvider>(context);
    final statusList = statusProvider.statusNames;
    final dropdownItems = List<String>.from(statusList);
    if (feedbackStatus != null && !dropdownItems.contains(feedbackStatus)) {
      dropdownItems.add(feedbackStatus!);
    }
    if (widget.lead != null && widget.lead.status != null && widget.lead.status.toString().isNotEmpty) {
      if (!dropdownItems.contains(widget.lead.status.toString())) {
        dropdownItems.add(widget.lead.status.toString());
      }
    }

    final priorityItems = ["High", "Medium", "Low"];
    if (priority != null && !priorityItems.contains(priority)) {
      priorityItems.add(priority!);
    }
    if (widget.lead != null && widget.lead.priority != null && widget.lead.priority.toString().isNotEmpty) {
      if (!priorityItems.contains(widget.lead.priority.toString())) {
        priorityItems.add(widget.lead.priority.toString());
      }
    }

    final loanTypeItems = [
      "Home Loan",
      "Mortgage Loan",
      "User Car Loan",
      "Business Loan",
      "Personal Loan",
      "DOD",
      "CC/OD",
      "CGTMSME",
      "Mutual Fund",
      "Insurance",
      "Other",
    ];
    if (loanType != null && !loanTypeItems.contains(loanType)) {
      loanTypeItems.add(loanType!);
    }
    if (widget.lead != null && widget.lead.loanType != null && widget.lead.loanType.toString().isNotEmpty) {
      if (!loanTypeItems.contains(widget.lead.loanType.toString())) {
        loanTypeItems.add(widget.lead.loanType.toString());
      }
    }

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: AppColors.primaryColor,
        title: const Text('You just called.....'),
        automaticallyImplyLeading: false,
        foregroundColor: AppColors.appBarForegroundColor,
        actions: [
          IconButton(
            onPressed: () {
              Navigator.pop(context);
            },
            icon: Icon(Icons.close),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.check_circle,
                      size: 70,
                      color: Color(0xFF03A9F4),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.lead == null
                              ? widget.number
                              : widget.lead.number,
                          style: TextStyle(fontSize: 20, color: Colors.black54),
                        ),
                        Text(
                          widget.lead == null ? "" : widget.lead.name,
                          style: TextStyle(fontSize: 16, color: Colors.black54),
                        ),
                        // const Text(
                        //   '01:31:46',
                        //   style: TextStyle(fontSize: 16, color: Colors.black54),
                        // ),
                      ],
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                /// Feedback Status Dropdown
                buildDropdown(
                  value: feedbackStatus,
                  hint: widget.lead != null ? 'Select Feedback Status *' : 'Select Feedback Status',
                  items: dropdownItems,
                  onChanged: (val) => setState(() => feedbackStatus = val!),
                ),

                //select loan type
                buildDropdown(
                  value: loanType,
                  hint: 'Select Loan Type',
                  items: loanTypeItems,
                  onChanged:
                      (val) => setState(() {
                        loanType = val!;
                      }),
                ),

                /// Priority Dropdown
                buildDropdown(
                  value: priority,
                  hint: widget.lead != null ? 'Select Priority *' : 'Select Priority',
                  items: priorityItems,
                  onChanged: (val) => setState(() => priority = val!),
                ),

                 TextFormField(
                  controller: nextMeetingController,
                  readOnly: true,
                  onTap: () async {
                    DateTime? pickedDate = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now(),
                      firstDate: DateTime.now(),
                      lastDate: DateTime(DateTime.now().year + 1),
                    );
                    if (pickedDate != null) {
                      TimeOfDay? pickedTime = await showTimePicker(
                        context: context,
                        initialTime: TimeOfDay.now(),
                      );
                      if (pickedTime != null) {
                        // Combine date and time into one DateTime
                        DateTime finalDateTime = DateTime(
                          pickedDate.year,
                          pickedDate.month,
                          pickedDate.day,
                          pickedTime.hour,
                          pickedTime.minute,
                        );
                        setState(() {
                          nextMeetingController.text = finalDateTime.toString();
                        });
                      }
                    }
                  },
                  decoration: InputDecoration(
                    hintText: 'Select Next Meeting Date',
                    border: const OutlineInputBorder(),
                    suffixIcon: nextMeetingController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              setState(() {
                                nextMeetingController.clear();
                              });
                            },
                          )
                        : null,
                  ),
                ),

                /// Next Meeting DateTime Dropdown (Dummy)
                // buildDropdown(
                //   value: nextMeeting,
                //   hint: 'Select Next Meeting DateTime',
                //   items: ['Today 4 PM', 'Tomorrow 11 AM', 'Next Monday'],
                //   onChanged: (val) => setState(() => nextMeeting = val),
                // ),

                /// Estimation Date Dropdown (Dummy)
                // buildDropdown(
                //   value: estimationDate,
                //   hint: 'Select Estimation Date',
                //   items: ['10 May 2025', '12 May 2025', '15 May 2025'],
                //   onChanged: (val) => setState(() => estimationDate = val),
                // ),

                /// Budget
                buildTextField(
                  controller: budgetController,
                  hint: 'EstimationBudget',
                  keyboardType: TextInputType.number,
                ),

                /// Remark
                buildTextField(controller: remarkController, hint: 'Remark'),
                SizedBox(height: 10),

                if (widget.lead == null)
                  Container(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Contact Details",
                          style: TextStyle(
                            fontSize: 20,
                            fontStyle: FontStyle.italic,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: 10),
                        buildTextField(
                          controller: contactNameController,
                          hint: "Contact Name *",
                        ),
                        buildDropdown(
                          value: source,
                          hint: "--Select Source--",
                          items: [
                            // "Internet",
                            // "Newspaper",
                            // "Website",
                            "Self",
                            "Refrence",
                            "Bulk excel",
                          ],
                          onChanged: (value) {
                            source = value;
                            setState(() {});
                          },
                        ),
                        buildTextField(
                          controller: descriptionController,
                          hint: "Description",
                        ),
                      ],
                    ),
                  ),

                SizedBox(height: 20),

                /// Submit Button
                CustomButton(
                  text: isSubmitting ? "SUBMITTING..." : "SUBMIT",
                  onPressed: isSubmitting
                      ? null
                      : () {
                          if (widget.lead == null) {
                            addLeadSubmission();
                          } else {
                            handleSubmission();
                          }
                        },
                ),

                // const SizedBox(height: 20),
                // const Text(
                //   'fetching Recording file ...Please Wait',
                //   style: TextStyle(color: Colors.black54),
                // ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget buildDropdown({
    // required BuildContext context,
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
                  (item) => DropdownMenuItem<String>(
                    value: item,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 14,
                      ),
                      decoration: const BoxDecoration(
                        border: Border(
                          bottom: BorderSide(color: Colors.grey, width: 0.8),
                        ),
                      ),
                      width: double.infinity,
                      child: Text(item),
                    ),
                  ),
                )
                .toList(),
        onChanged: onChanged,
        selectedItemBuilder: (context) {
          return items.map((item) {
            return Align(alignment: Alignment.centerLeft, child: Text(item));
          }).toList();
        },
      ),
    );
  }

  Widget buildTextField({
    required TextEditingController controller,
    required String hint,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      child: TextField(
        keyboardType: keyboardType,
        controller: controller,
        decoration: InputDecoration(
          hintText: hint,
          border: const OutlineInputBorder(),
        ),
      ),
    );
  }
}
