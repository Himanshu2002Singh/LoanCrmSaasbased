import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_phone_direct_caller/flutter_phone_direct_caller.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/empty_state_view.dart';
import 'package:capital_care/core/widgets/status_badge.dart';
import 'package:capital_care/core/widgets/custom_button.dart';
import 'package:capital_care/features/leads/models/lead_model.dart';
import 'package:capital_care/features/leads/models/lead_status_model.dart';
import 'package:capital_care/features/leads/providers/leads_provider.dart';
import 'package:capital_care/features/telecalling/views/log_call_dialog.dart';
import 'package:capital_care/features/dashboard/providers/dashboard_provider.dart';
import 'package:capital_care/features/auth/providers/auth_provider.dart';

class LeadDetailsScreen extends ConsumerStatefulWidget {
  final int leadId;

  const LeadDetailsScreen({super.key, required this.leadId});

  @override
  ConsumerState<LeadDetailsScreen> createState() => _LeadDetailsScreenState();
}

class _LeadDetailsScreenState extends ConsumerState<LeadDetailsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _makeCall(LeadModel lead) async {
    if (lead.number.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No phone number available')),
      );
      return;
    }
    await FlutterPhoneDirectCaller.callNumber(lead.number);
    if (mounted) {
      showDialog(
        context: context,
        builder: (ctx) => LogCallDialog(lead: lead),
      );
    }
  }

  Future<void> _openWhatsApp(LeadModel lead) async {
    if (lead.number.isEmpty) return;
    final clean = lead.number.replaceAll(RegExp(r'\D'), '');
    final fullNumber = clean.length == 10 ? '91$clean' : clean;
    final user = ref.read(currentUserProvider).value;
    final companyName = user?.company?.name ?? 'our lending team';
    final message = 'Hello ${lead.name}, from $companyName.';
    final uri = Uri.parse('https://wa.me/$fullNumber?text=${Uri.encodeComponent(message)}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _showStatusUpdateSheet(LeadModel lead) {
    final statusesAsync = ref.read(leadStatusesProvider);
    String selectedStatus = lead.statusValue;
    final remarksController = TextEditingController();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Update Lead Status',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  statusesAsync.when(
                    data: (statuses) {
                      final seenValues = <String>{};
                      final uniqueStatuses = <LeadStatusModel>[];
                      for (final s in statuses) {
                        if (!seenValues.contains(s.value)) {
                          seenValues.add(s.value);
                          uniqueStatuses.add(s);
                        }
                      }
                      return DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: uniqueStatuses.any((s) => s.value == selectedStatus) ? selectedStatus : null,
                        decoration: InputDecoration(
                          labelText: 'Select New Stage',
                          filled: true,
                          fillColor: AppColors.background,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        items: uniqueStatuses.map((s) {
                          return DropdownMenuItem<String>(
                            value: s.value,
                            child: Text(
                              s.name,
                              overflow: TextOverflow.ellipsis,
                              maxLines: 1,
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setModalState(() => selectedStatus = val);
                        },
                      );
                    },
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (err, _) => Text('Error loading statuses: $err'),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: remarksController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      labelText: 'Remarks / Update Notes',
                      hintText: 'Reason for status update...',
                      filled: true,
                      fillColor: AppColors.background,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                  const SizedBox(height: 18),
                  CustomButton(
                    text: 'Confirm Status Change',
                    onPressed: () async {
                      try {
                        await ref.read(leadsNotifierProvider.notifier).updateLeadStatus(
                          lead.id,
                          selectedStatus,
                          remarks: remarksController.text.trim().isNotEmpty ? remarksController.text.trim() : null,
                          nextMeeting: null,
                        );
                        ref.invalidate(singleLeadProvider(widget.leadId));
                        ref.invalidate(dashboardDataProvider);

                        if (ctx.mounted) Navigator.pop(ctx);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Lead status updated successfully!'),
                              backgroundColor: AppColors.success,
                            ),
                          );
                        }
                      } catch (e) {
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
                          );
                        }
                      }
                    },
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final leadAsync = ref.watch(singleLeadProvider(widget.leadId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Lead Overview'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(singleLeadProvider(widget.leadId)),
          ),
        ],
      ),
      body: leadAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.primary)),
        error: (err, _) => Center(
          child: EmptyStateView(
            icon: Icons.error_outline,
            title: 'Lead not found',
            message: err.toString(),
            actionLabel: 'Retry',
            onAction: () => ref.invalidate(singleLeadProvider(widget.leadId)),
          ),
        ),
        data: (lead) => _buildLeadDetails(lead),
      ),
    );
  }

  Widget _buildLeadDetails(LeadModel lead) {
    return Column(
      children: [
        // Top Lead Hero Card
        Container(
          margin: const EdgeInsets.all(16),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.cardBorder),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: AppColors.primarySurface,
                    child: Text(
                      lead.name.isNotEmpty ? lead.name[0].toUpperCase() : 'L',
                      style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.primary),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          lead.name,
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          lead.number.isNotEmpty ? lead.number : 'No number',
                          style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            StatusBadge(status: lead.status),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppColors.primarySurface,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                lead.loanType ?? 'Loan',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primaryDark),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Divider(),
              const SizedBox(height: 8),
              // Action Buttons Row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildLeadActionButton(
                    iconWidget: const Icon(Icons.phone, color: AppColors.primary, size: 18),
                    label: 'Call',
                    color: AppColors.primary,
                    onTap: () => _makeCall(lead),
                  ),
                  _buildLeadActionButton(
                    iconWidget: const FaIcon(FontAwesomeIcons.whatsapp, color: Color(0xFF25D366), size: 18),
                    label: 'WhatsApp',
                    color: const Color(0xFF25D366),
                    onTap: () => _openWhatsApp(lead),
                  ),
                  _buildLeadActionButton(
                    iconWidget: const Icon(Icons.post_add, color: AppColors.warning, size: 18),
                    label: 'Log Call',
                    color: AppColors.warning,
                    onTap: () {
                      showDialog(
                        context: context,
                        builder: (ctx) => LogCallDialog(lead: lead),
                      );
                    },
                  ),
                  _buildLeadActionButton(
                    iconWidget: const Icon(Icons.swap_horiz, color: AppColors.secondary, size: 18),
                    label: 'Stage',
                    color: AppColors.secondary,
                    onTap: () => _showStatusUpdateSheet(lead),
                  ),
                ],
              ),
            ],
          ),
        ),

        // Tabs: Details, Call Logs, Followups
        Container(
          color: AppColors.surface,
          child: TabBar(
            controller: _tabController,
            labelColor: AppColors.primary,
            unselectedLabelColor: AppColors.textSecondary,
            indicatorColor: AppColors.primary,
            tabs: [
              const Tab(text: 'Details'),
              Tab(text: 'Calls (${lead.callLogs.length})'),
              Tab(text: 'Follow-ups (${lead.followUps.length})'),
            ],
          ),
        ),

        // Tab views
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildDetailsTab(lead),
              _buildCallLogsTab(lead),
              _buildFollowUpsTab(lead),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildLeadActionButton({
    required Widget iconWidget,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: iconWidget,
            ),
            const SizedBox(height: 4),
            Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailsTab(LeadModel lead) {
    final customer = lead.customer;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _buildInfoCard(
            title: 'Loan Requirement',
            items: [
              {'label': 'Loan Product', 'value': lead.loanType ?? 'N/A'},
              {'label': 'Estimated Amount', 'value': lead.estBudget != null ? '₹${lead.estBudget!.toStringAsFixed(0)}' : 'N/A'},
              {'label': 'Lead Source', 'value': lead.source ?? 'N/A'},
              {'label': 'Priority', 'value': lead.priority},
              {'label': 'Assigned Owner', 'value': lead.owner ?? 'Unassigned'},
              {'label': 'Assigned Manager', 'value': lead.manager ?? 'N/A'},
              {'label': 'Next Follow-up', 'value': lead.nextMeeting ?? 'None scheduled'},
            ],
          ),
          const SizedBox(height: 16),
          _buildInfoCard(
            title: 'Customer KYC & Personal',
            items: [
              {'label': 'Customer Name', 'value': lead.name},
              {'label': 'Primary Mobile', 'value': lead.number},
              {'label': 'Alternate Mobile', 'value': lead.alternateNumber ?? customer?.alternateMobile ?? 'N/A'},
              {'label': 'Email Address', 'value': lead.email ?? customer?.email ?? 'N/A'},
              {'label': 'City', 'value': lead.city ?? customer?.city ?? 'N/A'},
              {'label': 'Employment', 'value': lead.employmentType ?? customer?.employmentType ?? 'N/A'},
              {
                'label': 'Monthly Income',
                'value': (lead.monthlyIncome ?? customer?.monthlyIncome) != null
                    ? '₹${(lead.monthlyIncome ?? customer?.monthlyIncome)!.toStringAsFixed(0)} / mo'
                    : 'N/A',
              },
              {'label': 'PAN Number', 'value': customer?.panNumber ?? 'N/A'},
            ],
          ),
          if ((lead.initialRemark != null && lead.initialRemark!.isNotEmpty) ||
              (lead.remarks != null && lead.remarks!.isNotEmpty) ||
              (lead.lastRemark != null && lead.lastRemark!.isNotEmpty)) ...[
            const SizedBox(height: 16),
            _buildInfoCard(
              title: 'Lead Notes & Remarks',
              items: [
                if (lead.initialRemark != null && lead.initialRemark!.isNotEmpty)
                  {'label': 'Creation Remark', 'value': lead.initialRemark!},
                if (lead.lastRemark != null &&
                    lead.lastRemark!.isNotEmpty &&
                    lead.lastRemark != lead.initialRemark)
                  {'label': 'Latest Activity Note', 'value': lead.lastRemark!},
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoCard({required String title, required List<Map<String, String>> items}) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const Divider(height: 20),
          ...items.map((item) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    item['label']!,
                    style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                  Flexible(
                    child: Text(
                      item['value']!,
                      textAlign: TextAlign.end,
                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildCallLogsTab(LeadModel lead) {
    if (lead.callLogs.isEmpty) {
      return const Center(
        child: EmptyStateView(
          icon: Icons.phone_disabled_outlined,
          title: 'No calls logged yet',
          message: 'Make a call and record conversation outcome notes',
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: lead.callLogs.length,
      itemBuilder: (context, index) {
        final call = lead.callLogs[index];
        final formattedDate = call.createdAt != null
            ? DateFormat('dd MMM yyyy, hh:mm a').format(call.createdAt!)
            : 'Unknown date';

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    call.callStatus.replaceAll('_', ' '),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.primary),
                  ),
                  Text(
                    '${call.formattedDuration} • $formattedDate',
                    style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),
                ],
              ),
              if (call.remarks != null && call.remarks!.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  call.remarks!,
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildFollowUpsTab(LeadModel lead) {
    if (lead.followUps.isEmpty) {
      return const Center(
        child: EmptyStateView(
          icon: Icons.event_busy_outlined,
          title: 'No follow-ups scheduled',
          message: 'Schedule follow-up reminders to stay on top of this lead',
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: lead.followUps.length,
      itemBuilder: (context, index) {
        final f = lead.followUps[index];
        final formattedDate = f.scheduledAt != null
            ? DateFormat('dd MMM yyyy, hh:mm a').format(f.scheduledAt!)
            : 'Unscheduled';

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.cardBorder),
          ),
          child: Row(
            children: [
              Icon(
                f.status == 'COMPLETED' ? Icons.check_circle : Icons.schedule,
                color: f.status == 'COMPLETED' ? AppColors.success : AppColors.warning,
                size: 20,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      formattedDate,
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                    ),
                    if (f.remarks != null && f.remarks!.isNotEmpty)
                      Text(
                        f.remarks!,
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                  ],
                ),
              ),
              StatusBadge(status: f.status),
            ],
          ),
        );
      },
    );
  }
}
