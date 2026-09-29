import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:flutter_phone_direct_caller/flutter_phone_direct_caller.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/app_drawer.dart';
import 'package:capital_care/core/widgets/empty_state_view.dart';
import 'package:capital_care/core/widgets/status_badge.dart';
import 'package:capital_care/features/leads/models/lead_model.dart';
import 'package:capital_care/features/leads/providers/leads_provider.dart';
import 'package:capital_care/features/telecalling/views/log_call_dialog.dart';
import 'package:capital_care/features/leads/views/widgets/template_dialog.dart';

class LeadsScreen extends ConsumerStatefulWidget {
  const LeadsScreen({super.key});

  @override
  ConsumerState<LeadsScreen> createState() => _LeadsScreenState();
}

class _LeadsScreenState extends ConsumerState<LeadsScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _isSearchOpen = false;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 250) {
      ref.read(leadsNotifierProvider.notifier).loadMore();
    }
  }

  Future<void> _makeCall(BuildContext context, LeadModel lead) async {
    if (lead.number.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No phone number available for this lead')),
      );
      return;
    }

    try {
      await FlutterPhoneDirectCaller.callNumber(lead.number);
      if (context.mounted) {
        // Offer to log the call after dialer is invoked
        showDialog(
          context: context,
          builder: (ctx) => LogCallDialog(lead: lead),
        );
      }
    } catch (e) {
      final uri = Uri.parse('tel:${lead.number}');
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri);
        if (context.mounted) {
          showDialog(
            context: context,
            builder: (ctx) => LogCallDialog(lead: lead),
          );
        }
      } else if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not initiate call: $e')),
        );
      }
    }
  }

  Future<void> _openWhatsApp(BuildContext context, LeadModel lead) async {
    if (lead.number.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No phone number available for this lead')),
      );
      return;
    }
    await TemplateDialog.show(context, phone: lead.number, name: lead.name);
  }

  @override
  Widget build(BuildContext context) {
    final leadsState = ref.watch(leadsNotifierProvider);
    final statusesAsync = ref.watch(leadStatusesProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const AppDrawer(),
      appBar: AppBar(
        leading: _isSearchOpen
            ? null
            : Builder(
                builder: (ctx) => IconButton(
                  icon: const Icon(Icons.menu_rounded),
                  tooltip: 'Open Menu',
                  onPressed: () => Scaffold.of(ctx).openDrawer(),
                ),
              ),
        title: _isSearchOpen
            ? TextField(
                controller: _searchController,
                autofocus: true,
                style: const TextStyle(color: AppColors.textPrimary),
                decoration: const InputDecoration(
                  hintText: 'Search by name or mobile...',
                  border: InputBorder.none,
                  hintStyle: TextStyle(color: AppColors.textMuted),
                ),
                onChanged: (val) {
                  ref.read(leadsNotifierProvider.notifier).setSearchQuery(val);
                },
              )
            : const Text('Leads Pipeline'),
        actions: [
          IconButton(
            icon: Icon(_isSearchOpen ? Icons.close : Icons.search),
            onPressed: () {
              setState(() {
                if (_isSearchOpen) {
                  _searchController.clear();
                  ref.read(leadsNotifierProvider.notifier).setSearchQuery('');
                  _isSearchOpen = false;
                } else {
                  _isSearchOpen = true;
                }
              });
            },
          ),
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.filter_list_rounded),
                tooltip: 'Filter Leads',
                onPressed: () => _showFilterBottomSheet(context),
              ),
              if (leadsState.selectedLoanType != null ||
                  leadsState.selectedPriority != null ||
                  leadsState.unassignedOnly)
                Positioned(
                  top: 10,
                  right: 10,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.person_add, color: Colors.white),
        label: const Text('Add Lead', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () => context.push('/leads/add'),
      ),
      body: Column(
        children: [
          // Dynamic status filter pill row
          statusesAsync.when(
            data: (statuses) => _buildStatusFilterRow(statuses, leadsState.selectedStatus),
            loading: () => const SizedBox(height: 48),
            error: (_, __) => const SizedBox.shrink(),
          ),

          // Total Leads & Summary indicator
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Showing ${leadsState.leads.length} of ${leadsState.totalItems} leads',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                ),
                if (leadsState.selectedStatus != 'ALL' ||
                    leadsState.selectedLoanType != null ||
                    leadsState.selectedPriority != null ||
                    leadsState.unassignedOnly)
                  TextButton(
                    style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(50, 20)),
                    onPressed: () {
                      ref.read(leadsNotifierProvider.notifier).resetAllFilters();
                    },
                    child: const Text('Reset filters', style: TextStyle(fontSize: 12, color: AppColors.primary)),
                  ),
              ],
            ),
          ),

          // Leads List
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () async {
                await ref.read(leadsNotifierProvider.notifier).loadLeads(refresh: true);
              },
              child: _buildLeadsContent(leadsState),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusFilterRow(List<dynamic> statuses, String selectedStatus) {
    final allFilters = [
      {'label': 'All', 'value': 'ALL'},
      ...statuses.map((s) => {'label': s.name, 'value': s.value}),
    ];

    return Container(
      height: 44,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: allFilters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final item = allFilters[index];
          final isSelected = selectedStatus == item['value'];

          return ChoiceChip(
            label: Text(item['label']!),
            selected: isSelected,
            selectedColor: AppColors.primary,
            labelStyle: TextStyle(
              color: isSelected ? Colors.white : AppColors.textPrimary,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
              fontSize: 12,
            ),
            backgroundColor: AppColors.surface,
            side: BorderSide(
              color: isSelected ? AppColors.primary : AppColors.cardBorder,
            ),
            onSelected: (selected) {
              if (selected) {
                ref.read(leadsNotifierProvider.notifier).setStatusFilter(item['value']!);
              }
            },
          );
        },
      ),
    );
  }

  Widget _buildLeadsContent(LeadsState state) {
    if (state.isLoading && state.leads.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    if (state.error != null && state.leads.isEmpty) {
      return Center(
        child: EmptyStateView(
          icon: Icons.error_outline,
          title: 'Error loading leads',
          message: state.error!,
          actionLabel: 'Retry',
          onAction: () => ref.read(leadsNotifierProvider.notifier).loadLeads(refresh: true),
        ),
      );
    }

    if (state.leads.isEmpty) {
      return Center(
        child: EmptyStateView(
          icon: Icons.folder_open_outlined,
          title: 'No leads found',
          message: state.searchQuery.isNotEmpty
              ? 'No leads matching "${state.searchQuery}"'
              : 'Add fresh leads or change filter criteria',
          actionLabel: 'Add Lead',
          onAction: () => context.push('/leads/add'),
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: state.leads.length + (state.isLoadingMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == state.leads.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)),
          );
        }

        final lead = state.leads[index];
        return _buildLeadCard(context, lead);
      },
    );
  }

  Widget _buildLeadCard(BuildContext context, LeadModel lead) {
    final initials = lead.name.isNotEmpty
        ? lead.name.trim().split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join().toUpperCase()
        : 'L';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => context.push('/leads/${lead.id}'),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header row: Avatar, Name, Mobile, Status Badge
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: AppColors.primarySurface,
                      child: Text(
                        initials,
                        style: const TextStyle(
                          color: AppColors.primary,
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            lead.name,
                            style: const TextStyle(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            lead.number.isNotEmpty ? lead.number : 'No phone number',
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    StatusBadge(status: lead.status),
                  ],
                ),
                const SizedBox(height: 12),

                // Loan details: Product & Amount
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppColors.background,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.account_balance_wallet_outlined, size: 14, color: AppColors.textSecondary),
                      const SizedBox(width: 6),
                      Text(
                        lead.loanType ?? 'Loan Inquiry',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                      ),
                      const Spacer(),
                      if (lead.estBudget != null && lead.estBudget! > 0)
                        Text(
                          '₹${lead.estBudget!.toStringAsFixed(0)}',
                          style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primaryDark,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 10),

                // Footer: Owner / Followup date and Action buttons
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (lead.nextMeeting != null && lead.nextMeeting!.isNotEmpty)
                      Row(
                        children: [
                          const Icon(Icons.event_outlined, size: 13, color: AppColors.warning),
                          const SizedBox(width: 4),
                          Text(
                            'Follow-up: ${lead.nextMeeting!.split("T")[0]}',
                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                          ),
                        ],
                      )
                    else
                      Text(
                        lead.owner != null ? 'Assigned: ${lead.owner}' : 'Unassigned',
                        style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                      ),
                    Row(
                      children: [
                        // WhatsApp Button
                        IconButton(
                          icon: const FaIcon(FontAwesomeIcons.whatsapp, color: Color(0xFF25D366), size: 20),
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.all(6),
                          constraints: const BoxConstraints(),
                          onPressed: () => _openWhatsApp(context, lead),
                        ),
                        const SizedBox(width: 12),
                        // Direct Call Button
                        Container(
                          decoration: BoxDecoration(
                            color: AppColors.primarySurface,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: IconButton(
                            icon: const Icon(Icons.phone, color: AppColors.primary, size: 18),
                            visualDensity: VisualDensity.compact,
                            padding: const EdgeInsets.all(6),
                            constraints: const BoxConstraints(),
                            onPressed: () => _makeCall(context, lead),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showFilterBottomSheet(BuildContext context) {
    final currentState = ref.read(leadsNotifierProvider);
    String? tempLoanType = currentState.selectedLoanType;
    String? tempPriority = currentState.selectedPriority;
    bool tempUnassignedOnly = currentState.unassignedOnly;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        final loanProductsAsync = ref.watch(loanProductsProvider);
        final defaultProducts = [
          'Personal Loan',
          'Home Loan',
          'Business Loan',
          'Mortgage Loan',
          'Used Car Loan',
          'CC / OD',
          'Education Loan',
        ];

        final loanProducts = loanProductsAsync.maybeWhen(
          data: (products) => products.isNotEmpty ? products.map((p) => p.label).toList() : defaultProducts,
          orElse: () => defaultProducts,
        );

        final priorities = ['ALL', 'LOW', 'MEDIUM', 'HIGH', 'URGENT'];

        return StatefulBuilder(
          builder: (context, setSheetState) {
            return Container(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 12,
                bottom: MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(context).size.height * 0.85,
              ),
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Handle Bar
                    Center(
                      child: Container(
                        width: 44,
                        height: 4,
                        decoration: BoxDecoration(
                          color: AppColors.textMuted.withValues(alpha: 0.3),
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),

                    // Header Row
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.tune_rounded, color: AppColors.primary, size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Filter Leads Pipeline',
                              style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, color: AppColors.textMuted),
                          visualDensity: VisualDensity.compact,
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                    const Divider(height: 18),

                    // 1. Loan Product Section
                    const Text(
                      'Loan Product',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ChoiceChip(
                          label: const Text('All Products'),
                          selected: tempLoanType == null,
                          selectedColor: AppColors.primary,
                          labelStyle: TextStyle(
                            color: tempLoanType == null ? Colors.white : AppColors.textPrimary,
                            fontWeight: tempLoanType == null ? FontWeight.bold : FontWeight.w500,
                            fontSize: 12,
                          ),
                          backgroundColor: AppColors.background,
                          side: BorderSide(
                            color: tempLoanType == null ? AppColors.primary : AppColors.cardBorder,
                          ),
                          onSelected: (selected) {
                            if (selected) {
                              setSheetState(() => tempLoanType = null);
                            }
                          },
                        ),
                        ...loanProducts.map((p) {
                          final isSelected = tempLoanType == p;
                          return ChoiceChip(
                            label: Text(p),
                            selected: isSelected,
                            selectedColor: AppColors.primary,
                            labelStyle: TextStyle(
                              color: isSelected ? Colors.white : AppColors.textPrimary,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                              fontSize: 12,
                            ),
                            backgroundColor: AppColors.background,
                            side: BorderSide(
                              color: isSelected ? AppColors.primary : AppColors.cardBorder,
                            ),
                            onSelected: (selected) {
                              setSheetState(() => tempLoanType = selected ? p : null);
                            },
                          );
                        }),
                      ],
                    ),
                    const SizedBox(height: 18),

                    // 2. Priority Section
                    const Text(
                      'Priority',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: priorities.map((p) {
                        final isSelected = (p == 'ALL' && tempPriority == null) || (tempPriority == p);
                        return ChoiceChip(
                          label: Text(p),
                          selected: isSelected,
                          selectedColor: AppColors.primary,
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.white : AppColors.textPrimary,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                            fontSize: 12,
                          ),
                          backgroundColor: AppColors.background,
                          side: BorderSide(
                            color: isSelected ? AppColors.primary : AppColors.cardBorder,
                          ),
                          onSelected: (selected) {
                            if (selected) {
                              setSheetState(() => tempPriority = p == 'ALL' ? null : p);
                            }
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 18),

                    // 3. Unassigned Leads Switch
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: AppColors.background,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.cardBorder),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.person_off_outlined, color: AppColors.textSecondary, size: 20),
                          const SizedBox(width: 10),
                          const Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Unassigned Leads Only',
                                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                                ),
                                Text(
                                  'Show leads currently not assigned to any staff',
                                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                                ),
                              ],
                            ),
                          ),
                          Switch.adaptive(
                            value: tempUnassignedOnly,
                            activeColor: AppColors.primary,
                            onChanged: (val) {
                              setSheetState(() => tempUnassignedOnly = val);
                            },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Action Buttons Row
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              side: const BorderSide(color: AppColors.cardBorder),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            onPressed: () {
                              ref.read(leadsNotifierProvider.notifier).resetAllFilters();
                              Navigator.pop(ctx);
                            },
                            child: const Text('Reset All', style: TextStyle(color: AppColors.error, fontWeight: FontWeight.w600)),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              elevation: 0,
                            ),
                            icon: const Icon(Icons.check, color: Colors.white, size: 18),
                            label: const Text('Apply Filters', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                            onPressed: () {
                              ref.read(leadsNotifierProvider.notifier).applyFilters(
                                loanType: tempLoanType,
                                priority: tempPriority,
                                unassignedOnly: tempUnassignedOnly,
                              );
                              Navigator.pop(ctx);
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
        );
      },
    );
  }
}
