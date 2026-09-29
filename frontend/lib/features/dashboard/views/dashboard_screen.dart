import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/app_drawer.dart';
import 'package:capital_care/features/auth/providers/auth_provider.dart';
import 'package:capital_care/features/dashboard/providers/dashboard_provider.dart';
import 'package:capital_care/features/dashboard/models/dashboard_stats_model.dart';
import 'package:capital_care/core/widgets/empty_state_view.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(currentUserProvider);
    final user = authState.value;
    final dashboardAsync = ref.watch(dashboardDataProvider);

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
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              user?.name != null ? 'Hi, ${user!.name}' : 'Dashboard',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            ),
            if (user?.role != null)
              Text(
                '${user!.role} • ${user.company?.name ?? "CRM"}',
                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
              ),
          ],
        ),
        actions: [
          // IconButton(
          //   icon: const Icon(Icons.notifications_outlined),
          //   onPressed: () {
          //     ScaffoldMessenger.of(context).showSnackBar(
          //       const SnackBar(content: Text('No new notifications')),
          //     );
          //   },
          // ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.refresh(dashboardDataProvider),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.dialpad_rounded, color: Colors.white),
        label: const Text('Dialer', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () => context.push('/dialer'),
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async => ref.refresh(dashboardDataProvider.future),
        child: dashboardAsync.when(
          loading: () => const Center(
            child: CircularProgressIndicator(color: AppColors.primary),
          ),
          error: (err, stack) => Center(
            child: EmptyStateView(
              icon: Icons.error_outline,
              title: 'Failed to load dashboard',
              message: err.toString(),
              actionLabel: 'Retry',
              onAction: () => ref.refresh(dashboardDataProvider),
            ),
          ),
          data: (data) => _buildDashboardContent(context, data),
        ),
      ),
    );
  }

  Widget _buildDashboardContent(BuildContext context, DashboardData data) {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Quick Action Hub
          _buildQuickActionHub(context),
          const SizedBox(height: 24),

          // Overview KPI Grid
          const Text(
            'Performance Overview',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          _buildKpiGrid(context, data.counts),
          const SizedBox(height: 24),

          // Lead Pipeline Breakdown
          const Text(
            'Lead Pipeline Status',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          _buildLeadStatusSection(data.leadStatusCounts),
          const SizedBox(height: 24),

          // Loan Types Breakdown (if any)
          if (data.loanTypeCounts.isNotEmpty) ...[
            const Text(
              'Loan Demand by Product',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            _buildLoanTypeSection(data.loanTypeCounts),
            const SizedBox(height: 24),
          ],
        ],
      ),
    );
  }

  Widget _buildQuickActionHub(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Quick Actions',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Icon(Icons.bolt, color: Colors.amber, size: 20),
            ],
          ),
          const SizedBox(height: 14),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildActionItem(
                  icon: Icons.dialpad_rounded,
                  label: 'Dialer',
                  onTap: () => context.push('/dialer'),
                ),
                const SizedBox(width: 12),
                _buildActionItem(
                  icon: Icons.person_add_alt_1,
                  label: 'Add Lead',
                  onTap: () => context.push('/leads/add'),
                ),
                const SizedBox(width: 12),
                _buildActionItem(
                  icon: Icons.receipt_long_rounded,
                  label: 'Expenses',
                  onTap: () => context.push('/expenses'),
                ),
                const SizedBox(width: 12),
                _buildActionItem(
                  icon: Icons.sticky_note_2_rounded,
                  label: 'Notes',
                  onTap: () => context.push('/notes'),
                ),
                const SizedBox(width: 12),
                _buildActionItem(
                  icon: Icons.phone_in_talk,
                  label: 'Calls',
                  onTap: () => context.push('/calls'),
                ),
                const SizedBox(width: 12),
                _buildActionItem(
                  icon: Icons.alarm_rounded,
                  label: 'Followups',
                  onTap: () => context.push('/followups'),
                ),
                const SizedBox(width: 12),
                _buildActionItem(
                  icon: Icons.fingerprint,
                  label: 'Punch In',
                  onTap: () => context.push('/attendance'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionItem({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: Colors.white, size: 22),
            ),
            const SizedBox(height: 6),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiGrid(BuildContext context, DashboardCounts counts) {
    return GridView.count(
      crossAxisCount: 2,
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.45,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        _buildStatCard(
          title: 'Total Leads',
          value: '${counts.totalLeads}',
          iconWidget: const FaIcon(FontAwesomeIcons.users, color: AppColors.primary, size: 16),
          color: AppColors.primary,
          onTap: () => context.push('/leads'),
        ),
        _buildStatCard(
          title: 'Calls Made',
          value: '${counts.totalCalls}',
          iconWidget: const FaIcon(FontAwesomeIcons.phoneVolume, color: AppColors.success, size: 16),
          color: AppColors.success,
          onTap: () => context.push('/calls'),
        ),
        _buildStatCard(
          title: "Today's Follow-ups",
          value: '${counts.todayFollowups}',
          iconWidget: const FaIcon(FontAwesomeIcons.calendarDay, color: AppColors.warning, size: 16),
          color: AppColors.warning,
          onTap: () => context.push('/followups?window=today'),
        ),
        _buildStatCard(
          title: 'Upcoming Follow-ups',
          value: '${counts.upcomingFollowups}',
          iconWidget: const FaIcon(FontAwesomeIcons.calendarPlus, color: Color(0xFF0284C7), size: 16),
          color: const Color(0xFF0284C7),
          onTap: () => context.push('/followups?window=upcoming'),
        ),
        _buildStatCard(
          title: 'Overdue Follow-ups',
          value: '${counts.pendingFollowups}',
          iconWidget: const FaIcon(FontAwesomeIcons.clockRotateLeft, color: AppColors.error, size: 16),
          color: AppColors.error,
          onTap: () => context.push('/followups?window=overdue'),
        ),
        _buildStatCard(
          title: 'Unassigned Leads',
          value: '${counts.unassignedLeads}',
          iconWidget: const FaIcon(FontAwesomeIcons.userClock, color: Color(0xFF8B5CF6), size: 16),
          color: const Color(0xFF8B5CF6),
          onTap: () => context.push('/leads'),
        ),
      ],
    );
  }

  Widget _buildStatCard({
    required String title,
    required String value,
    required Widget iconWidget,
    required Color color,
    VoidCallback? onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.cardBorder),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: iconWidget,
                ),
                const Icon(Icons.arrow_forward_ios, size: 12, color: AppColors.textMuted),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                  ),
                ),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLeadStatusSection(Map<String, int> statusCounts) {
    if (statusCounts.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: const Center(
          child: Text('No lead status distribution available'),
        ),
      );
    }

    final total = statusCounts.values.fold<int>(0, (sum, count) => sum + count);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        children: statusCounts.entries.map((entry) {
          final percentage = total > 0 ? (entry.value / total) : 0.0;
          return Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      entry.key,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    Text(
                      '${entry.value} (${(percentage * 100).toStringAsFixed(0)}%)',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: percentage,
                    minHeight: 6,
                    backgroundColor: AppColors.background,
                    valueColor: AlwaysStoppedAnimation<Color>(_getColorForStatus(entry.key)),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildLoanTypeSection(Map<String, int> loanCounts) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Wrap(
        spacing: 10,
        runSpacing: 10,
        children: loanCounts.entries.map((entry) {
          return Chip(
            backgroundColor: AppColors.primarySurface,
            side: BorderSide.none,
            avatar: const Icon(Icons.account_balance, size: 16, color: AppColors.primary),
            label: Text(
              '${entry.key}: ${entry.value}',
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                color: AppColors.primaryDark,
                fontSize: 12,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Color _getColorForStatus(String status) {
    final lower = status.toLowerCase();
    if (lower.contains('fresh') || lower.contains('new')) return AppColors.info;
    if (lower.contains('interested')) return AppColors.success;
    if (lower.contains('callback') || lower.contains('follow')) return AppColors.warning;
    if (lower.contains('reject') || lower.contains('not')) return AppColors.error;
    if (lower.contains('disburs') || lower.contains('login') || lower.contains('qualif')) {
      return AppColors.secondary;
    }
    return AppColors.primary;
  }
}
