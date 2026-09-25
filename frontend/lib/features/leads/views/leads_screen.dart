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
import 'package:capital_care/features/auth/providers/auth_provider.dart';

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

    final cleanNumber = lead.number.replaceAll(RegExp(r'\D'), '');
    final fullNumber = cleanNumber.length == 10 ? '91$cleanNumber' : cleanNumber;
    final user = ref.read(currentUserProvider).value;
    final companyName = user?.company?.name ?? 'our lending team';
    final message = 'Hello ${lead.name}, regarding your loan inquiry with $companyName.';
    final uri = Uri.parse('https://wa.me/$fullNumber?text=${Uri.encodeComponent(message)}');

    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('WhatsApp is not installed or cannot open link')),
          );
        }
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open WhatsApp: $e')),
        );
      }
    }
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
          IconButton(
            icon: const Icon(Icons.filter_list),
            onPressed: () => _showFilterBottomSheet(context),
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
                if (leadsState.selectedStatus != 'ALL' || leadsState.selectedLoanType != null)
                  TextButton(
                    style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: const Size(50, 20)),
                    onPressed: () {
                      ref.read(leadsNotifierProvider.notifier).setStatusFilter('ALL');
                      ref.read(leadsNotifierProvider.notifier).setLoanTypeFilter(null);
                      ref.read(leadsNotifierProvider.notifier).setPriorityFilter(null);
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
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        final state = ref.watch(leadsNotifierProvider);
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

        return Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Filter by Loan Product', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: loanProducts.map((p) {
                  final isSelected = state.selectedLoanType == p;
                  return ChoiceChip(
                    label: Text(p),
                    selected: isSelected,
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: isSelected ? Colors.white : AppColors.textPrimary,
                      fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                    ),
                    onSelected: (selected) {
                      ref.read(leadsNotifierProvider.notifier).setLoanTypeFilter(selected ? p : null);
                      Navigator.pop(ctx);
                    },
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  TextButton(
                    onPressed: () {
                      ref.read(leadsNotifierProvider.notifier).setLoanTypeFilter(null);
                      Navigator.pop(ctx);
                    },
                    child: const Text('Clear Filter', style: TextStyle(color: AppColors.error)),
                  ),
                  ElevatedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                    child: const Text('Done', style: TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
