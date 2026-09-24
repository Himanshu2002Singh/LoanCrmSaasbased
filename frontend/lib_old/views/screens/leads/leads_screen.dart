import 'package:capital_care/controllers/providers/lead_provider.dart';
import 'package:capital_care/controllers/providers/userprovider.dart';
import 'package:capital_care/controllers/providers/status_provider.dart';
import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/screens/leads/add_lead_screen.dart';
import 'package:capital_care/views/screens/leads/lead_details_screen.dart';
import 'package:capital_care/views/widgets/app_scaffold.dart';
import 'package:capital_care/views/widgets/custom_appbar.dart';
import 'package:capital_care/views/widgets/lead_card.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

class LeadsScreen extends StatefulWidget {
  const LeadsScreen({super.key});

  @override
  State<LeadsScreen> createState() => _LeadsScreenState();
}

class _LeadsScreenState extends State<LeadsScreen> {
  String loanSelectedItem = "All";
  String selectedStatusItem = "All";
  String searchQuery = "";
  bool showSearchBar = false;
  final ScrollController _scrollController = ScrollController();

  DateTime today = DateTime.now();
  DateTime? startDate = DateTime.now().subtract(
    Duration(days: 30),
  ); // Changed to reasonable default
  DateTime? endDate = DateTime.now();

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
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchLeads();
      
      Provider.of<StatusProvider>(
        context,
        listen: false,
      ).fetchStatuses();
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 200) {
      final provider = Provider.of<LeadProvider>(context, listen: false);
      if (provider.hasMore && !provider.isLoading) {
        provider.fetchLeads(
          loadMore: true,
          search: searchQuery,
          status: selectedStatusItem,
          loanType: loanSelectedItem,
        );
      }
    }
  }

  void _fetchLeads() {
    Provider.of<LeadProvider>(context, listen: false).fetchLeads(
      start: startDate,
      end: endDate,
      search: searchQuery,
      status: selectedStatusItem,
      loanType: loanSelectedItem,
    );
  }

  @override
  Widget build(BuildContext context) {
    final leadProvider = Provider.of<LeadProvider>(context, listen: true);
    final statusProvider = Provider.of<StatusProvider>(context);
    final leads = leadProvider.leads;
    final isLoading = leadProvider.isLoading;
    final user = Provider.of<UserProvider>(context).user;

    final statusOptions = statusProvider.statusNamesWithAll;

    return AppScaffold(
      isFloatingActionButton: true,
      appBar: CustomAppbar(
        title: "Leads",
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
            onChanged: (value) {
              setState(() => loanSelectedItem = value!);
              _fetchLeads();
            },
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Filters and search section (always visible)
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
                  onSubmitted: (value) {
                    setState(() => searchQuery = value);
                    _fetchLeads();
                  },
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
                    "Total Leads: ${leadProvider.currentViewTotalLeads}",
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
                      _fetchLeads();
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

            // Main content with RefreshIndicator
            Expanded(
              child: RefreshIndicator(
                onRefresh: () async => _fetchLeads(),
                child:
                    isLoading && leads.isEmpty
                        ? const Center(child: CircularProgressIndicator())
                        : leads.isEmpty
                        ? const Center(child: Text("No leads found"))
                        : ListView.builder(
                          controller: _scrollController,
                          itemCount: leads.length + (leadProvider.hasMore ? 1 : 0),
                          itemBuilder: (context, index) {
                            if (index == leads.length) {
                              return const Padding(
                                padding: EdgeInsets.all(16.0),
                                child: Center(child: CircularProgressIndicator()),
                              );
                            }
                            final lead = leads[index];
                            return GestureDetector(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder:
                                        (context) =>
                                            LeadDetailsScreen(lead: lead),
                                  ),
                                );
                              },
                              child: LeadCard(lead: lead),
                            );
                          },
                        ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButtonIcon: const Icon(Icons.add),
      floatingActionButtonOnTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder:
                (context) => AddLeadScreen(
                  title: "Add Lead",
                  userId: user?.empId ?? "",
                  userName: user?.ename ?? "",
                ),
          ),
        );
      },
    );
  }

  Future<void> _selectStartDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: startDate ?? DateTime.now(),
      firstDate: DateTime(2023),
      lastDate: endDate ?? DateTime.now(), // Don't allow start after end
    );
    if (picked != null) {
      setState(() => startDate = picked);
      _fetchLeads();
    }
  }

  Future<void> _selectEndDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: endDate ?? DateTime.now(),
      firstDate: startDate ?? DateTime(2023), // Don't allow end before start
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() => endDate = picked);
      _fetchLeads();
    }
  }
}
