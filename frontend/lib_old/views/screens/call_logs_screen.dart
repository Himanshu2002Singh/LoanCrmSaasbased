import 'package:capital_care/controllers/providers/calls_provider.dart';
import 'package:capital_care/controllers/providers/lead_provider.dart';
import 'package:capital_care/controllers/providers/status_provider.dart';
import 'package:capital_care/models/calls_model.dart';
import 'package:capital_care/services/api_service.dart';
import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/screens/call_details_screen.dart';
import 'package:capital_care/views/screens/leads/lead_details_screen.dart';
import 'package:capital_care/views/widgets/app_scaffold.dart';
import 'package:capital_care/views/widgets/custom_appbar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_phone_direct_caller/flutter_phone_direct_caller.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

class CallLogsScreen extends StatefulWidget {
  final String? title;

  const CallLogsScreen({super.key, this.title});

  @override
  State<CallLogsScreen> createState() => _CallLogsScreenState();
}

class _CallLogsScreenState extends State<CallLogsScreen> {
  List<Calls> callLogs = [];
  DateTime? startDate;
  DateTime? endDate;
  bool isLoading = false;
  var loanSelectedItem = "All";
  String selectedStatusItem = "All";
  bool showSearchBar = false;
  String searchQuery = "";
  final ScrollController _scrollController = ScrollController();

  final List<String> loanTypeOptions = [
    "All",
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
  // statusOptions removed, fetching dynamically via StatusProvider

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
    // Provider.of<CallsProvider>(context, listen: false).clearFilteredCalls();
  }

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_scrollListener);
    final today = DateTime.now();
    startDate =
        widget.title != "Today Calls"
            ? DateTime.now().subtract(const Duration(days: 30))
            : DateTime(today.year, today.month, today.day);
    endDate = DateTime(today.year, today.month, today.day);
    fetchCallLogs();
  }

  Future<void> fetchCallLogs() async {
    setState(() => isLoading = true);
    try {
      // if (startDate != null && endDate != null) {
      await Provider.of<CallsProvider>(context, listen: false).filterCallsByDateRange(
        startDate!,
        endDate!,
        selectedStatusItem,
        loanSelectedItem,
      );
      // }
    } catch (e) {
      print("Error fetching call logs: $e");
    } finally {
      setState(() => isLoading = false);
    }
  }

  void _scrollListener() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      Provider.of<CallsProvider>(context, listen: false).fetchMoreFilteredCalls();
    }
  }

  Future<void> _selectStartDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: startDate ?? DateTime.now(),
      firstDate: DateTime(2023),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => startDate = picked);
      if (endDate != null) fetchCallLogs();
    }
  }

  Future<void> _selectEndDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: endDate ?? DateTime.now(),
      firstDate: DateTime(2023),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => endDate = picked);
      if (startDate != null) fetchCallLogs();
    }
  }

  @override
  Widget build(BuildContext context) {
    final callProvider = Provider.of<CallsProvider>(context, listen: true);
    final statusProvider = Provider.of<StatusProvider>(context);
    callLogs = callProvider.filteredCalls;
    final statusOptions = statusProvider.statusNamesWithAll;
    final filteredCallLogs =
        callLogs.where((call) {
          final matchesSearch =
              searchQuery.isEmpty ||
              call.name.toLowerCase().contains(searchQuery.toLowerCase());
          return matchesSearch;
        }).toList();

    final totalCountDisplay = searchQuery.isEmpty 
        ? callProvider.totalFilteredCallsCount 
        : filteredCallLogs.length;

    return AppScaffold(
      isFloatingActionButton: false,
      appBar: CustomAppbar(
        title: "Call Logs",
        action: [
          const SizedBox(width: 10),
          DropdownButton<String>(
            value: loanSelectedItem,
            underline: const SizedBox(),
            items:
                loanTypeOptions.map((type) {
                  return DropdownMenuItem(
                    value: type,
                    child: Text(type, style: const TextStyle(fontSize: 14)),
                  );
                }).toList(),
            onChanged:
                (value) => setState(() {
                  loanSelectedItem = value!;
                  fetchCallLogs();
                }),
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.lightBlue.shade100,
                            Colors.lightBlue.shade50,
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.grey.withOpacity(0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          Flexible(
                            child: ElevatedButton(
                              onPressed: _selectStartDate,
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 0,
                                ),
                                backgroundColor: Colors.teal,
                              ),
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  maxLines: 1,
                                  startDate != null
                                      ? "Start: ${DateFormat('d MMM yyyy').format(startDate!)}"
                                      : "Pick Start Date",
                                  style: TextStyle(color: Colors.white),
                                ),
                              ),
                            ),
                          ),
                          Flexible(
                            child: ElevatedButton(
                              onPressed: _selectEndDate,
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 0,
                                ),
                                backgroundColor: Colors.deepPurple,
                              ),
                              child: FittedBox(
                                fit: BoxFit.scaleDown,
                                child: Text(
                                  endDate != null
                                      ? "End: ${DateFormat('d MMM yyyy').format(endDate!)}"
                                      : "Pick End Date",
                                  style: TextStyle(color: Colors.white),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.search, color: Colors.black),
                    onPressed:
                        () => setState(() => showSearchBar = !showSearchBar),
                  ),
                ],
              ),
            ),
            if (showSearchBar)
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 4,
                ),
                child: TextField(
                  onChanged: (value) => setState(() => searchQuery = value),
                  decoration: InputDecoration(
                    hintText: "Search by name...",
                    prefixIcon: const Icon(Icons.search),
                    contentPadding: const EdgeInsets.symmetric(
                      vertical: 10,
                      horizontal: 10,
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  Text(
                    "Total Calls: $totalCountDisplay",
                    style: const TextStyle(fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ),
            Container(
              height: 50,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                itemCount: statusOptions.length,
                itemBuilder: (context, index) {
                  final option = statusOptions[index];
                  return GestureDetector(
                    onTap: () {
                      setState(() => selectedStatusItem = option);
                      fetchCallLogs();
                    },
                    child: Container(
                      margin: const EdgeInsets.symmetric(
                        horizontal: 4,
                        vertical: 8,
                      ),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        border: Border.all(
                          color: AppColors.primaryColor,
                          width: 2,
                        ),
                        borderRadius: BorderRadius.circular(20),
                        color:
                            selectedStatusItem == option
                                ? const Color.fromARGB(255, 219, 219, 219)
                                : Colors.white,
                      ),
                      child: Text(option, style: const TextStyle(fontSize: 14)),
                    ),
                  );
                },
              ),
            ),
            Expanded(
              child:
                  isLoading
                      ? const Center(child: CircularProgressIndicator())
                      : callLogs.isEmpty
                      ? const Center(child: Text("No call logs found"))
                      : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        itemCount: filteredCallLogs.length + (callProvider.isFetchingMore ? 1 : 0),
                        itemBuilder: (context, index) {
                          if (index == filteredCallLogs.length) {
                            return const Padding(
                              padding: EdgeInsets.all(16.0),
                              child: Center(child: CircularProgressIndicator()),
                            );
                          }
                          final call = filteredCallLogs[index];
                          return InkWell(
                            onTap: () async {
                              final lead =
                                  await Provider.of<LeadProvider>(
                                    context,
                                    listen: false,
                                  ).getLeadIfAvailable(call.lead_id) ??
                                  await ApiService.getLeadByLeadId(
                                    call.lead_id,
                                  );
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder:
                                      (context) =>
                                          LeadDetailsScreen(lead: lead),
                                ),
                              );
                            },
                            child: Card(
                              elevation: 4,
                              margin: const EdgeInsets.symmetric(vertical: 8),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                  vertical: 8.0,
                                ),
                                child: ListTile(
                                  trailing: IconButton(
                                    onPressed: () {
                                      makeDirectCall(call.number, call);
                                    },
                                    icon: Icon(Icons.call),
                                  ),
                                  contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                  ),
                                  leading: CircleAvatar(
                                    backgroundColor: Colors.indigo,
                                    child: Text(
                                      call.name.isNotEmpty
                                          ? call.name[0].toUpperCase()
                                          : '?',
                                      style: const TextStyle(
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                  title: Text(
                                    call.name,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16,
                                    ),
                                  ),
                                  subtitle: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const SizedBox(height: 4),
                                      Text("Number: ${call.number}"),
                                      Text(
                                        "Time: ${formatDateTime(call.createdAt)}",
                                      ),
                                      const SizedBox(height: 6),

                                      // 👇 Responsive Remark Row
                                      Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          // Expanded to prevent overflow
                                          Expanded(
                                            child: Text(
                                              call.remark != null &&
                                                      call.remark!
                                                          .trim()
                                                          .isNotEmpty
                                                  ? "Remark: ${call.remark}"
                                                  : "Remark: No remark available",
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                fontSize: 14,
                                              ),
                                            ),
                                          ),

                                          const SizedBox(width: 4),

                                          // View button (tap to show full remark)
                                          InkWell(
                                            onTap: () {
                                              showDialog(
                                                context: context,
                                                builder:
                                                    (context) => AlertDialog(
                                                      title: const Text(
                                                        "Call Remark",
                                                      ),
                                                      content: Text(
                                                        call.remark != null &&
                                                                call.remark !=
                                                                    ""
                                                            ? call.remark
                                                            : 'No remark available.',
                                                        style: const TextStyle(
                                                          fontSize: 16,
                                                        ),
                                                      ),
                                                      actions: [
                                                        TextButton(
                                                          onPressed:
                                                              () =>
                                                                  Navigator.of(
                                                                    context,
                                                                  ).pop(),
                                                          child: const Text(
                                                            "Close",
                                                          ),
                                                        ),
                                                      ],
                                                      shape: RoundedRectangleBorder(
                                                        borderRadius:
                                                            BorderRadius.circular(
                                                              12,
                                                            ),
                                                      ),
                                                    ),
                                              );
                                            },
                                            child: Text(
                                              " (view)",
                                              style: TextStyle(
                                                fontWeight: FontWeight.bold,
                                                color: AppColors.primaryColor,
                                                fontSize: 14,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
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

  Future<void> makeDirectCall(String number, Calls call) async {
    var status = await Permission.phone.status;
    if (!status.isGranted) {
      await Permission.phone.request();
    }

    if (await Permission.phone.isGranted) {
      await FlutterPhoneDirectCaller.callNumber(number);
      // print("==================> ye method yha tk aaya");
      final lead =
          await Provider.of<LeadProvider>(
            context,
            listen: false,
          ).getLeadIfAvailable(call.lead_id) ??
          await ApiService.getLeadByLeadId(call.lead_id);

      Future.delayed(Duration(seconds: 2), () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => CallDetailsScreen(lead: lead),
          ),
        );
      });

      submitCall(call);
    } else {
      print("CALL_PHONE permission denied");
    }
  }

  void submitCall(Calls calling) async {
    final storage = FlutterSecureStorage();
    final userId = await storage.read(key: "userId") ?? "";
    Calls call = Calls(
      lead_id: calling.lead_id ?? "",
      emp_id: userId,
      name: calling.name ?? "",
      number: calling.number ?? "",
    );
    Provider.of<CallsProvider>(context, listen: false).addCall(call);
  }
}

String formatDateTime(String dateTimeString) {
  if (dateTimeString.isEmpty) return "";
  final dateTime = DateTime.parse(dateTimeString).toLocal();
  return DateFormat('d MMM yyyy, hh:mm a').format(dateTime);
}
