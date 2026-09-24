import 'package:capital_care/controllers/providers/lead_provider.dart';
import 'package:capital_care/models/leads_model.dart';
import 'package:capital_care/views/widgets/app_scaffold.dart';
import 'package:capital_care/views/widgets/custom_appbar.dart';
import 'package:capital_care/theme/appcolors.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class FreshLeads extends StatefulWidget {
  const FreshLeads({super.key});

  @override
  State<FreshLeads> createState() => _FreshLeadsState();
}

class _FreshLeadsState extends State<FreshLeads> {
  late Future<Map<String, dynamic>> _poolFuture;
  final TextEditingController _countController = TextEditingController(text: "10");
  bool _isAssigning = false;

  @override
  void initState() {
    super.initState();
    _poolFuture = Provider.of<LeadProvider>(
      context,
      listen: false,
    ).unassignedFreshLeadPool;
  }

  @override
  void dispose() {
    _countController.dispose();
    super.dispose();
  }

  void _refreshPool() {
    setState(() {
      _poolFuture = Provider.of<LeadProvider>(
        context,
        listen: false,
      ).unassignedFreshLeadPool;
    });
  }

  Future<void> _confirmAndAssignLeads(
    int availableCount,
    int maxAssignable,
  ) async {
    final requestedCount = int.tryParse(_countController.text.trim()) ?? 0;

    if (requestedCount < 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Enter at least 1 lead")),
      );
      return;
    }

    if (requestedCount > maxAssignable) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("You can import max $maxAssignable leads at once")),
      );
      return;
    }

    if (requestedCount > availableCount) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Only $availableCount unassigned leads available")),
      );
      return;
    }

    final shouldImport = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15),
          ),
          title: const Text("Confirm Import"),
          content: Text(
            "Are you sure you want to import $requestedCount fresh lead${requestedCount == 1 ? "" : "s"} to your account?",
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text("Cancel"),
            ),
            ElevatedButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryColor,
                foregroundColor: Colors.white,
              ),
              child: const Text("Import"),
            ),
          ],
        );
      },
    );

    if (shouldImport == true) {
      await _assignLeads(availableCount, maxAssignable);
    }
  }

  Future<void> _assignLeads(int availableCount, int maxAssignable) async {
    final requestedCount = int.tryParse(_countController.text.trim()) ?? 0;

    if (requestedCount < 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Enter at least 1 lead")),
      );
      return;
    }

    if (requestedCount > maxAssignable) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("You can import max $maxAssignable leads at once")),
      );
      return;
    }

    if (requestedCount > availableCount) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Only $availableCount unassigned leads available")),
      );
      return;
    }

    setState(() {
      _isAssigning = true;
    });

    try {
      final result = await Provider.of<LeadProvider>(
        context,
        listen: false,
      ).assignUnassignedFreshLeads(requestedCount);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(result["message"] ?? "Leads assigned")),
      );
      _refreshPool();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.toString().replaceFirst("Exception: ", ""))),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isAssigning = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      appBar: CustomAppbar(title: "Unassigned Fresh Leads"),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _poolFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text("Error: ${snapshot.error}"));
          }

          final data = snapshot.data ?? {};
          final List<Leads> leads = data["leads"] ?? [];
          final int availableCount = data["availableCount"] ?? leads.length;
          final int maxAssignable = data["maxAssignable"] ?? 50;
          final int safeMax =
              availableCount < maxAssignable ? availableCount : maxAssignable;

          return RefreshIndicator(
            onRefresh: () async => _refreshPool(),
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        AppColors.primaryColor,
                        AppColors.primaryColor.withValues(alpha: 0.7),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primaryColor.withValues(alpha: 0.3),
                        blurRadius: 15,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      const Icon(
                        Icons.group_add_rounded,
                        size: 48,
                        color: Colors.white,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        "$availableCount",
                        style: const TextStyle(
                          fontSize: 48,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        "Fresh Leads Available",
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w500,
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
                Card(
                  elevation: 4,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Import Leads",
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          "Enter the number of leads you want to assign to yourself.",
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Colors.grey[600],
                          ),
                        ),
                        const SizedBox(height: 20),
                        TextField(
                          controller: _countController,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: "Number of Leads",
                            helperText: "Max $maxAssignable at once",
                            prefixIcon: const Icon(Icons.download_rounded),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            filled: true,
                            fillColor: Colors.grey[50],
                          ),
                        ),
                        const SizedBox(height: 24),
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primaryColor,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              elevation: 2,
                            ),
                            onPressed:
                                _isAssigning || safeMax < 1
                                    ? null
                                    : () => _confirmAndAssignLeads(
                                      availableCount,
                                      maxAssignable,
                                    ),
                            icon: _isAssigning
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Icon(Icons.add_task_rounded),
                            label: Text(
                              _isAssigning
                                  ? "Importing..."
                                  : "Import to My Account",
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
      isFloatingActionButton: false,
    );
  }
}
