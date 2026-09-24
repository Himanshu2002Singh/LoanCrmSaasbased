import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_phone_direct_caller/flutter_phone_direct_caller.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/app_drawer.dart';
import 'package:capital_care/core/widgets/empty_state_view.dart';
import 'package:capital_care/features/telecalling/models/call_log_model.dart';
import 'package:capital_care/features/telecalling/providers/telecalling_provider.dart';

class CallLogsScreen extends ConsumerStatefulWidget {
  const CallLogsScreen({super.key});

  @override
  ConsumerState<CallLogsScreen> createState() => _CallLogsScreenState();
}

class _CallLogsScreenState extends ConsumerState<CallLogsScreen> {
  final ScrollController _scrollController = ScrollController();

  final List<Map<String, String>> _statusFilters = [
    {'label': 'All Calls', 'value': 'ALL'},
    {'label': 'Connected', 'value': 'CONNECTED'},
    {'label': 'Interested', 'value': 'INTERESTED'},
    {'label': 'Callback', 'value': 'CALL_BACK_LATER'},
    {'label': 'Not Connected', 'value': 'NOT_CONNECTED'},
    {'label': 'Busy', 'value': 'BUSY'},
    {'label': 'Switched Off', 'value': 'SWITCHED_OFF'},
  ];

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 250) {
      ref.read(callsNotifierProvider.notifier).loadMore();
    }
  }

  Future<void> _redial(String? number) async {
    if (number == null || number.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No number available for redial')),
      );
      return;
    }
    await FlutterPhoneDirectCaller.callNumber(number);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(callsNotifierProvider);

    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const AppDrawer(),
      appBar: AppBar(
        leading: Builder(
          builder: (ctx) => IconButton(
            icon: const Icon(Icons.menu_rounded),
            tooltip: 'Open Menu',
            onPressed: () => Scaffold.of(ctx).openDrawer(),
          ),
        ),
        title: const Text('Call Logs History'),
        actions: [
          IconButton(
            icon: const Icon(Icons.dialpad_rounded),
            tooltip: 'Open Dialer',
            onPressed: () => context.push('/dialer'),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.read(callsNotifierProvider.notifier).loadCalls(refresh: true),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.dialpad_rounded, color: Colors.white),
        label: const Text('Dialer', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () => context.push('/dialer'),
      ),
      body: Column(
        children: [
          // Filter Chips Row
          Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: _statusFilters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final item = _statusFilters[index];
                final isSelected = state.selectedStatus == item['value'];
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
                      ref.read(callsNotifierProvider.notifier).setStatusFilter(item['value']!);
                    }
                  },
                );
              },
            ),
          ),

          // Total Count
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              children: [
                Text(
                  'Showing ${state.calls.length} of ${state.totalItems} logged calls',
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),

          // Calls List
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () async {
                await ref.read(callsNotifierProvider.notifier).loadCalls(refresh: true);
              },
              child: _buildCallsContent(state),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCallsContent(CallsState state) {
    if (state.isLoading && state.calls.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    if (state.error != null && state.calls.isEmpty) {
      return Center(
        child: EmptyStateView(
          icon: Icons.error_outline,
          title: 'Error loading calls',
          message: state.error!,
          actionLabel: 'Retry',
          onAction: () => ref.read(callsNotifierProvider.notifier).loadCalls(refresh: true),
        ),
      );
    }

    if (state.calls.isEmpty) {
      return const Center(
        child: EmptyStateView(
          icon: Icons.phone_disabled_outlined,
          title: 'No call logs found',
          message: 'Initiate calls from the leads list to track conversation logs',
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: state.calls.length + (state.isLoadingMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == state.calls.length) {
          return const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)),
          );
        }

        final call = state.calls[index];
        return _buildCallCard(call);
      },
    );
  }

  Widget _buildCallCard(CallLogModel call) {
    final statusColor = _getCallStatusColor(call.callStatus);
    final formattedDate = call.createdAt != null
        ? DateFormat('dd MMM, hh:mm a').format(call.createdAt!)
        : 'Unknown date';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
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
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _getCallStatusIcon(call.callStatus),
                  color: statusColor,
                  size: 18,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      call.customerName ?? 'Customer',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Text(
                      call.customerNumber ?? 'No number',
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  call.callStatus.replaceAll('_', ' '),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.timer_outlined, size: 14, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  Text(
                    'Duration: ${call.formattedDuration}',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ],
              ),
              Row(
                children: [
                  const Icon(Icons.access_time, size: 14, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  Text(
                    formattedDate,
                    style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                  ),
                ],
              ),
              if (call.customerNumber != null)
                InkWell(
                  onTap: () => _redial(call.customerNumber),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primarySurface,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.call, size: 12, color: AppColors.primary),
                        SizedBox(width: 4),
                        Text('Redial', style: TextStyle(fontSize: 11, color: AppColors.primary, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          if (call.remarks != null && call.remarks!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppColors.background,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                'Notes: ${call.remarks}',
                style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: AppColors.textSecondary),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Color _getCallStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'CONNECTED':
        return AppColors.success;
      case 'INTERESTED':
        return AppColors.primary;
      case 'CALL_BACK_LATER':
        return AppColors.warning;
      case 'NOT_CONNECTED':
      case 'BUSY':
      case 'SWITCHED_OFF':
        return AppColors.error;
      default:
        return AppColors.textSecondary;
    }
  }

  IconData _getCallStatusIcon(String status) {
    switch (status.toUpperCase()) {
      case 'CONNECTED':
        return Icons.phone_in_talk;
      case 'INTERESTED':
        return Icons.thumb_up_alt_outlined;
      case 'CALL_BACK_LATER':
        return Icons.schedule;
      case 'NOT_CONNECTED':
        return Icons.phone_missed;
      case 'BUSY':
        return Icons.phone_paused;
      case 'SWITCHED_OFF':
        return Icons.power_settings_new;
      default:
        return Icons.phone;
    }
  }
}
