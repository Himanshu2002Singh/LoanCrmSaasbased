import 'package:capital_care/controllers/providers/calls_provider.dart';
import 'package:capital_care/controllers/providers/history_provider.dart';
import 'package:capital_care/controllers/providers/task_provider.dart';
import 'package:capital_care/controllers/providers/userprovider.dart';
import 'package:capital_care/models/calls_model.dart';
import 'package:capital_care/models/history_model.dart';
import 'package:capital_care/models/task_model.dart';
import 'package:capital_care/services/api_service.dart';
import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/screens/leads/add_lead_screen.dart';
import 'package:capital_care/views/screens/task/add_task_screen.dart';
import 'package:capital_care/views/screens/call_details_screen.dart';
import 'package:capital_care/views/widgets/app_scaffold.dart';
import 'package:capital_care/views/widgets/text_editing_dialog_for_task.dart';
import 'package:flutter/material.dart';
import 'package:flutter_phone_direct_caller/flutter_phone_direct_caller.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

class LeadDetailsScreen extends StatefulWidget {
  final lead;

  const LeadDetailsScreen({super.key, required this.lead});

  @override
  _LeadDetailsScreenState createState() => _LeadDetailsScreenState();
}

class _LeadDetailsScreenState extends State<LeadDetailsScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<History> history = [];
  // List<Task> allTasks = [];
  List<Task> tasks = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    fetchHistory();
    fetchTasks();
  }

  void fetchHistory() async {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<HistoryProvider>(
        context,
        listen: false,
      ).fetchHistory(widget.lead.lead_id);
    });
  }

  void fetchTasks() async {
    final allTasks = Provider.of<TaskProvider>(context, listen: false).tasks;
    if (allTasks.isEmpty) {
      Provider.of<TaskProvider>(context, listen: false).fetchTasks();
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> makeDirectCall(String number, dynamic lead) async {
    var status = await Permission.phone.status;
    if (!status.isGranted) {
      await Permission.phone.request();
    }

    if (await Permission.phone.isGranted) {
      await FlutterPhoneDirectCaller.callNumber(number);
      Future.delayed(const Duration(seconds: 2), () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => CallDetailsScreen(lead: lead),
          ),
        );
      });

      submitCall(lead); // If needed, ensure this function is defined
    } else {
      print("CALL_PHONE permission denied");
    }
  }

  void submitCall(var lead) async {
    final storage = FlutterSecureStorage();
    final userId = await storage.read(key: "userId");
    Calls call = Calls(
      lead_id: lead.lead_id,
      emp_id: userId,
      name: lead.name,
      number: lead.number,
    );
    Provider.of<CallsProvider>(context, listen: false).addCall(call);
    // bool success = await ApiService.addCalls(call);
    // ScaffoldMessenger.of(
    //   context,
    // ).showSnackBar(SnackBar(content: Text(success ? "success" : "Error")));
  }

  Widget build(BuildContext context) {
    final historyProvider = Provider.of<HistoryProvider>(context, listen: true);
    history = historyProvider.history;
    return AppScaffold(
      isFloatingActionButton: true,
      floatingActionButtonIcon: Icon(Icons.add),
      floatingActionButtonOnTap: () {
        // if (_tabController.index == 2) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => AddTaskScreen(lead: widget.lead),
            ),
          );
        // } else {
        //   Navigator.push(
        //     context,
        //     MaterialPageRoute(
        //       builder: (context) => CallDetailsScreen(lead: widget.lead),
        //     ),
        //   );
        // }
      },
      appBar: AppBar(
        elevation: 0,
        title: Text("Lead Details"),
        backgroundColor: AppColors.primaryColor,
        foregroundColor: AppColors.appBarForegroundColor,
        bottom: PreferredSize(
          preferredSize: Size.fromHeight(50),
          child: Container(
            color: const Color.fromARGB(
              255,
              239,
              238,
              238,
            ), // Background for TabBar
            child: TabBar(
              dividerColor: Colors.transparent,
              padding: EdgeInsets.only(top: 10, left: 10, right: 10),
              controller: _tabController,
              tabs: const [
                Tab(text: "DETAILS"),
                Tab(text: "HISTORY"),
                Tab(text: "TASK"),
              ],
              labelColor: Colors.white, // Text color when selected
              unselectedLabelColor:
                  Colors.black, // Text color when not selected
              indicatorSize: TabBarIndicatorSize.tab,
              indicator: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    const Color.fromARGB(255, 168, 223, 248),
                    AppColors.primaryColor,
                  ],
                  begin: Alignment.topRight,
                  end: Alignment.topLeft,
                ),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
        // actions: [
        //   IconButton(
        //     onPressed: () {
        //       // getFilteredTasks();
        //       if (_tabController.index == 2) {
        //         getFilteredTasks();
        //       } else if (_tabController.index == 1) {
        //         fetchHistory();
        //       }
        //     },
        //     icon: Icon(Icons.refresh),
        //   ),
        // ],
      ),

      body: TabBarView(
        controller: _tabController,
        children: [buildDetailsTab(), buildHistory(), buildTaskTab()],
      ),
    );
  }

  Widget buildDetailsTab() {
    int daysDiff = 0;
    bool formatError = false;
    try {
      final nextMeeting = DateTime.parse(widget.lead.next_meeting ?? "");
      final today = DateTime.now();

      // Difference from today
      daysDiff = nextMeeting.difference(today).inDays;

      formatError = false;
    } catch (e) {
      daysDiff = 0;
      formatError = true;
    }

    final user = Provider.of<UserProvider>(context).user;

    return SafeArea(
      child: SingleChildScrollView(
        child: Container(
          color: const Color(0xFFF1F5F9), // Light background
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              children: [
                /// Lead Info Card
                Card(
                  color: Colors.white,
                  elevation: 5,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        /// Name & Edit
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              widget.lead.name ?? 'No Name',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            IconButton(
                              onPressed: () {
                                Navigator.pushReplacement(
                                  context,
                                  MaterialPageRoute(
                                    builder:
                                        (context) => AddLeadScreen(
                                          title: "Edit Lead",
                                          userId: user?.empId ?? "",
                                          userName: user?.ename ?? "",
                                          lead_id: widget.lead.lead_id,
                                          contactName: widget.lead.name ?? '',
                                          contactNumber:
                                              widget.lead.number ?? '',
                                          email: widget.lead.email ?? '',
                                          source: widget.lead.source ?? '',
                                          priority: widget.lead.priority ?? '',
                                          status: widget.lead.status ?? '',
                                          next_meeting:
                                              widget.lead.next_meeting ?? '',
                                          refrence: widget.lead.refrence ?? '',
                                          description:
                                              widget.lead.description ?? '',
                                          address: widget.lead.address ?? '',
                                          loanType: widget.lead.loanType ?? '',
                                          // dob: widget.lead.dob ?? '',
                                          loanAmount:
                                              widget.lead.est_budget ?? '',
                                          // loanTerm: widget.lead.loan_term ?? '',
                                          employmentType:
                                              widget.lead.employment_type ?? '',
                                          // salary: widget.lead.salary ?? '',
                                        ),
                                  ),
                                );
                              },
                              icon: Icon(Icons.edit, color: Colors.blueAccent),
                            ),
                          ],
                        ),

                        const SizedBox(height: 10),

                        /// Budget & Date & Days
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _buildChip(
                              "\u20B9 ${widget.lead.est_budget ?? '0.00'}",
                              Colors.purple.shade100,
                            ),
                            _buildChip(
                              widget.lead.createdAt?.substring(0, 10) ?? '-',
                              Colors.blue.shade100,
                            ),
                            _buildChip("$daysDiff days", Colors.green.shade100),
                          ],
                        ),

                        const SizedBox(height: 16),

                        /// Email
                        _buildIconRow(
                          Icons.email,
                          Colors.orange,
                          widget.lead.email ?? "No email",
                        ),

                        const SizedBox(height: 8),

                        /// Phone
                        GestureDetector(
                          onTap:
                              () => makeDirectCall(
                                widget.lead.number ?? '',
                                widget.lead,
                              ),
                          child: _buildIconRow(
                            Icons.phone,
                            Colors.green,
                            widget.lead.number ?? "No number",
                          ),
                        ),

                        const SizedBox(height: 8),

                        /// Address
                        _buildIconRow(
                          Icons.location_on,
                          Colors.red,
                          widget.lead.address ?? "No address",
                        ),

                        const SizedBox(height: 8),

                        /// Next Meeting
                        _buildIconRow(
                          Icons.calendar_today,
                          Colors.blue,
                          "Follow up: ${formatDateTime(widget.lead.next_meeting ?? '')}",
                        ),

                        const SizedBox(height: 8),

                        /// DOB
                        // _buildIconRow(
                        //   Icons.cake_rounded,
                        //   Colors.pink,
                        //   "DOB: ${widget.lead.dob ?? '-'}",
                        // ),
                        // const SizedBox(height: 8),

                        /// Loan Type
                        _buildIconRow(
                          Icons.monetization_on,
                          Colors.teal,
                          "Loan Type: ${widget.lead.loanType ?? '-'}",
                        ),

                        const SizedBox(height: 8),

                        /// Loan Term
                        // _buildIconRow(
                        //   Icons.timelapse,
                        //   Colors.deepPurple,
                        //   "Loan Term: ${widget.lead.loan_term ?? '-'}",
                        // ),

                        const SizedBox(height: 8),

                        /// Employment Type
                        _buildIconRow(
                          Icons.work,
                          Colors.brown,
                          "Employment: ${widget.lead.employment_type ?? '-'}",
                        ),

                        /// salary
                        // _buildIconRow(
                        //   Icons.money,
                        //   Colors.lightGreen,
                        //   "Salary: ${widget.lead.salary ?? '-'}",
                        // ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 20),

                /// Other Details Section
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.lightBlue.shade50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        "Other Details",
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const Divider(),
                      _buildDetailRow("Assigned To :", widget.lead.owner ?? ''),
                      _buildDetailRow("Added By :", widget.lead.owner ?? ''),
                      _buildDetailRow("Source :", widget.lead.source ?? ''),
                      _buildDetailRow(
                        "Reference :",
                        widget.lead.refrence ?? '',
                      ),
                      _buildDetailRow(
                        "Description :",
                        widget.lead.description ?? '',
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget buildHistory() {
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: () async {
          fetchHistory(); // Fetch latest data
          await Future.delayed(
            Duration(seconds: 1),
          ); // Fix: await should wrap a Future
        },
        child: SingleChildScrollView(
          physics: AlwaysScrollableScrollPhysics(),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children:
                  history.map((entry) {
                    String nextMeeting;
                    try {
                      nextMeeting = formatDateTime(entry.next_meeting ?? '');
                    } catch (e) {
                      nextMeeting = "";
                    }

                    return Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          alignment: Alignment.topLeft,
                          width: 60,
                          child: Text(
                            "${formatDate(entry.createdAt ?? '')} \n${formatTime(entry.createdAt ?? '')}",
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.black87,
                              fontWeight: FontWeight.bold,
                            ),
                            textAlign: TextAlign.start,
                          ),
                        ),
                        Padding(
                          padding: const EdgeInsets.only(left: 10),
                          child: Column(
                            children: [
                              Container(
                                height: 25,
                                width: 25,
                                decoration: BoxDecoration(
                                  color: Colors.green,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: const Color.fromARGB(
                                      255,
                                      203,
                                      202,
                                      202,
                                    ),
                                    width: 3,
                                    style: BorderStyle.solid,
                                  ),
                                ),
                              ),
                              Container(
                                width: 2,
                                height: 100,
                                color: Colors.grey.shade400,
                              ),
                            ],
                          ),
                        ),
                        SizedBox(width: 10),
                        Expanded(
                          child: Container(
                            padding: EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.grey.shade100,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  "Updated by : ${entry.changedBy ?? entry.changedByEmpId ?? ''}",
                                  style: TextStyle(fontWeight: FontWeight.bold),
                                ),
                                SizedBox(height: 4),
                                if ((entry.previousStatus ?? '').isNotEmpty)
                                  Text(
                                    "From: ${entry.previousStatus}",
                                    style: TextStyle(color: Colors.black54),
                                  ),
                                if ((entry.previousStatus ?? '').isNotEmpty)
                                  SizedBox(height: 2),
                                RichText(
                                  text: TextSpan(
                                    children: [
                                      TextSpan(
                                        text: "Status : ",
                                        style: TextStyle(color: Colors.black),
                                      ),
                                      TextSpan(
                                        text: entry.status ?? '',
                                        style: TextStyle(
                                          color: Colors.green,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  "Loan Type : ${entry.loanType ?? ''}",
                                  style: TextStyle(color: Colors.purple),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  "Schedule : $nextMeeting",
                                  style: TextStyle(color: Colors.purple),
                                ),
                                SizedBox(height: 2),
                                Text(
                                  "Remark : ${entry.remark ?? ''}",
                                  style: TextStyle(color: Colors.brown),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    );
                  }).toList(),
            ),
          ),
        ),
      ),
    );
  }

  Widget buildTaskTab() {
    // String formatDateTime(String dateTimeString) {
    //   if (dateTimeString.isEmpty) {
    //     return "";
    //   }
    //   final dateTime = DateTime.parse(dateTimeString);
    //   final formatter = DateFormat('d-MMM-yyyy hh:mm a');
    //   return formatter.format(dateTime);
    // }
    final taskProvider = Provider.of<TaskProvider>(context, listen: true);
    // final allTasks = taskProvider.tasks;
    tasks =
        taskProvider.tasks.where((task) {
          return (task.lead_id).toString() == (widget.lead.lead_id).toString();
        }).toList();
    return SafeArea(
      child:
          tasks.isEmpty
              ? const Center(child: Text("No matching tasks found."))
              : ListView.builder(
                padding: const EdgeInsets.all(10),
                itemCount: tasks.length,
                itemBuilder: (context, index) {
                  final t = tasks[index];
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
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.red,
                                              foregroundColor: Colors.white,
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
                                  style: const TextStyle(color: Colors.grey),
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
                                  style: const TextStyle(color: Colors.grey),
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
                            crossAxisAlignment: CrossAxisAlignment.start,
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
                                style: TextStyle(fontWeight: FontWeight.w500),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                ),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(10),
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
                                      ["Initial", "On Going", "Completed"]
                                          .map(
                                            (status) => DropdownMenuItem(
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
                                                    BorderRadius.circular(16),
                                              ),
                                              title: const Text(
                                                'Change Status',
                                                style: TextStyle(
                                                  fontWeight: FontWeight.bold,
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
                                                    Navigator.pop(context);
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
                                                    taskProvider.updateTask(
                                                      t.task_id,
                                                      {"status": newStatus},
                                                    );
                                                    Navigator.pop(context);
                                                  },
                                                  style:
                                                      ElevatedButton.styleFrom(
                                                        backgroundColor:
                                                            Colors.green,
                                                      ),
                                                  child: const Text('Yes'),
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
    );
  }

  Widget _buildChip(String text, Color color) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
    decoration: BoxDecoration(
      color: color,
      borderRadius: BorderRadius.circular(16),
    ),
    child: Text(text, style: const TextStyle(fontWeight: FontWeight.bold)),
  );

  Widget _buildIconRow(IconData icon, Color iconColor, String text) => Row(
    children: [
      Icon(icon, size: 20, color: iconColor),
      const SizedBox(width: 8),
      Expanded(child: Text(text, style: const TextStyle(fontSize: 16))),
    ],
  );

  Widget _buildDetailRow(String title, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("$title ", style: TextStyle(color: Colors.blue)),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}

String formatDate(String dateTimeString) {
  if (dateTimeString.isEmpty) {
    return "";
  }
  final dateTime = DateTime.parse(dateTimeString);
  final formatter = DateFormat('d MMM');
  return formatter.format(dateTime);
}

String formatTime(String dateTimeString) {
  if (dateTimeString.isEmpty) {
    return "";
  }
  final dateTime = DateTime.parse(dateTimeString).toLocal();
  final formatter = DateFormat('hh:mm a');
  return formatter.format(dateTime);
}

String formatDateTime(String dateTimeString) {
  if (dateTimeString.isEmpty) {
    return "";
  }
  final dateTime = DateTime.parse(dateTimeString).toLocal();
  final formatter = DateFormat('d-MMM-yyyy hh:mm a');
  return formatter.format(dateTime);
}
