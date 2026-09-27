import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/app_drawer.dart';
import 'package:capital_care/core/widgets/empty_state_view.dart';
import 'package:capital_care/core/widgets/status_badge.dart';
import 'package:capital_care/features/expenses/models/expense_model.dart';
import 'package:capital_care/features/expenses/providers/expense_provider.dart';
import 'package:capital_care/features/expenses/views/add_edit_expense_screen.dart';

class ExpensesScreen extends ConsumerStatefulWidget {
  const ExpensesScreen({super.key});

  @override
  ConsumerState<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends ConsumerState<ExpensesScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _isSearching = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _changeMonth(int deltaMonths) {
    final currentStr = ref.read(expenseStateProvider).selectedMonth;
    DateTime currentDt;
    try {
      final parts = currentStr.split('-');
      currentDt = DateTime(int.parse(parts[0]), int.parse(parts[1]), 1);
    } catch (_) {
      currentDt = DateTime.now();
    }

    final newDt = DateTime(currentDt.year, currentDt.month + deltaMonths, 1);
    final newMonthStr = DateFormat('yyyy-MM').format(newDt);
    ref.read(expenseStateProvider.notifier).setMonth(newMonthStr);
  }

  Future<void> _handleDeleteExpense(ExpenseModel exp) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.delete_outline_rounded, color: AppColors.error, size: 24),
            SizedBox(width: 8),
            Text('Delete Claim', style: TextStyle(fontWeight: FontWeight.w700)),
          ],
        ),
        content: Text('Are you sure you want to delete expense "${exp.expenseCode.isNotEmpty ? exp.expenseCode : exp.category}" for ₹${exp.totalAmount.toStringAsFixed(2)}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await ref.read(expenseStateProvider.notifier).deleteExpense(exp.id);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Expense deleted successfully'), backgroundColor: AppColors.success),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to delete expense: $e'), backgroundColor: AppColors.error),
          );
        }
      }
    }
  }

  void _showExpenseDetailsModal(ExpenseModel exp) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.cardBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.secondary.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(exp.categoryIcon, color: AppColors.secondary, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          exp.category,
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                        if (exp.expenseCode.isNotEmpty)
                          Text(
                            exp.expenseCode,
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary, fontWeight: FontWeight.w500),
                          ),
                      ],
                    ),
                  ],
                ),
                StatusBadge(status: exp.status),
              ],
            ),
            const Divider(height: 24),
            _buildDetailRow('Amount', '₹${exp.totalAmount.toStringAsFixed(2)}', isBold: true, isAmount: true),
            _buildDetailRow('Expense Date', exp.formattedDate),
            _buildDetailRow('Payment Mode', exp.paymentMode.replaceAll('_', ' ')),
            if (exp.vendorName.isNotEmpty) _buildDetailRow('Vendor / Payee', exp.vendorName),
            if (exp.description.isNotEmpty) _buildDetailRow('Description', exp.description),
            if (exp.remarks.isNotEmpty) _buildDetailRow('Remarks', exp.remarks),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                      side: const BorderSide(color: AppColors.error),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    icon: const Icon(Icons.delete_outline, size: 18),
                    label: const Text('Delete'),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _handleDeleteExpense(exp);
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.secondary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    label: const Text('Edit Claim'),
                    onPressed: () {
                      Navigator.pop(ctx);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => AddEditExpenseScreen(initialExpense: exp),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
            SizedBox(height: MediaQuery.of(context).padding.bottom + 10),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {bool isBold = false, bool isAmount = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: AppColors.textSecondary)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontSize: isAmount ? 16 : 13,
                fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
                color: isAmount ? AppColors.secondary : AppColors.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(expenseStateProvider);
    final currentMonthStr = state.selectedMonth;

    String displayMonth = currentMonthStr;
    try {
      final parts = currentMonthStr.split('-');
      final dt = DateTime(int.parse(parts[0]), int.parse(parts[1]), 1);
      displayMonth = DateFormat('MMMM yyyy').format(dt);
    } catch (_) {}

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
        title: _isSearching
            ? TextField(
                controller: _searchController,
                autofocus: true,
                style: const TextStyle(color: Colors.white, fontSize: 16),
                decoration: InputDecoration(
                  hintText: 'Search vendor, category, remarks...',
                  hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.6)),
                  border: InputBorder.none,
                ),
                onChanged: (val) => ref.read(expenseStateProvider.notifier).setSearch(val),
              )
            : const Text('My Expenses & Claims'),
        actions: [
          IconButton(
            icon: Icon(_isSearching ? Icons.close : Icons.search_rounded),
            onPressed: () {
              setState(() {
                if (_isSearching) {
                  _searchController.clear();
                  ref.read(expenseStateProvider.notifier).setSearch('');
                }
                _isSearching = !_isSearching;
              });
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            onPressed: () => ref.read(expenseStateProvider.notifier).loadAll(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.secondary,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Claim Expense', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const AddEditExpenseScreen(),
            ),
          );
        },
      ),
      body: RefreshIndicator(
        color: AppColors.secondary,
        onRefresh: () async => ref.read(expenseStateProvider.notifier).loadAll(),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Month Selector Strip
              _buildMonthSelector(displayMonth),
              const SizedBox(height: 16),

              // KPI Summary Banner Cards
              _buildKpiSummary(state),
              const SizedBox(height: 16),

              // Filter Chips (Status & Category)
              _buildFilterChips(state),
              const SizedBox(height: 16),

              // Expense List Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Claims History (${state.expenses.length})',
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  InkWell(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const AddEditExpenseScreen(),
                        ),
                      );
                    },
                    borderRadius: BorderRadius.circular(8),
                    child: const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      child: Row(
                        children: [
                          Icon(Icons.add_circle_outline_rounded, size: 16, color: AppColors.secondary),
                          SizedBox(width: 4),
                          Text(
                            'New Claim',
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: AppColors.secondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Expenses List Body
              if (state.isLoading) ...[
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(
                    child: CircularProgressIndicator(color: AppColors.secondary),
                  ),
                ),
              ] else if (state.expenses.isEmpty) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 30),
                  child: EmptyStateView(
                    icon: Icons.receipt_long_outlined,
                    title: 'No Expense Claims Found',
                    message: state.searchQuery.isNotEmpty
                        ? 'No expenses matched your search "${state.searchQuery}".'
                        : 'You haven\'t recorded any expense claims for $displayMonth.',
                    actionLabel: 'Claim New Expense',
                    onAction: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const AddEditExpenseScreen(),
                        ),
                      );
                    },
                  ),
                ),
              ] else ...[
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: state.expenses.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 10),
                  itemBuilder: (context, index) {
                    final exp = state.expenses[index];
                    return _buildExpenseCard(exp);
                  },
                ),
              ],
              const SizedBox(height: 80), // space for FAB
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMonthSelector(String displayMonth) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left_rounded, color: AppColors.textPrimary),
            tooltip: 'Previous Month',
            onPressed: () => _changeMonth(-1),
          ),
          Row(
            children: [
              const Icon(Icons.calendar_month_rounded, size: 18, color: AppColors.secondary),
              const SizedBox(width: 8),
              Text(
                displayMonth,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right_rounded, color: AppColors.textPrimary),
            tooltip: 'Next Month',
            onPressed: () => _changeMonth(1),
          ),
        ],
      ),
    );
  }

  Widget _buildKpiSummary(ExpenseState state) {
    final total = state.calculatedTotal;
    final paid = state.calculatedPaid;
    final pending = state.calculatedPending;

    return Row(
      children: [
        Expanded(
          child: _buildSummaryCard(
            title: 'Total Claimed',
            amount: total,
            icon: Icons.account_balance_wallet_rounded,
            color: AppColors.primary,
            bgColor: AppColors.primary.withValues(alpha: 0.08),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildSummaryCard(
            title: 'Paid / Approved',
            amount: paid,
            icon: Icons.check_circle_rounded,
            color: AppColors.success,
            bgColor: AppColors.success.withValues(alpha: 0.08),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _buildSummaryCard(
            title: 'Pending',
            amount: pending,
            icon: Icons.hourglass_top_rounded,
            color: AppColors.warning,
            bgColor: AppColors.warning.withValues(alpha: 0.08),
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryCard({
    required String title,
    required double amount,
    required IconData icon,
    required Color color,
    required Color bgColor,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: bgColor, borderRadius: BorderRadius.circular(8)),
                child: Icon(icon, size: 16, color: color),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            '₹${amount.toStringAsFixed(0)}',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: color,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w500,
              color: AppColors.textSecondary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips(ExpenseState state) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          // Status Chips
          _buildFilterChip(
            label: 'All Status',
            isSelected: state.selectedStatus == 'ALL',
            onSelected: () => ref.read(expenseStateProvider.notifier).setStatus('ALL'),
          ),
          const SizedBox(width: 8),
          _buildFilterChip(
            label: 'Paid',
            isSelected: state.selectedStatus == 'PAID',
            color: AppColors.success,
            onSelected: () => ref.read(expenseStateProvider.notifier).setStatus('PAID'),
          ),
          const SizedBox(width: 8),
          _buildFilterChip(
            label: 'Pending',
            isSelected: state.selectedStatus == 'PENDING',
            color: AppColors.warning,
            onSelected: () => ref.read(expenseStateProvider.notifier).setStatus('PENDING'),
          ),
          const SizedBox(width: 14),
          Container(width: 1, height: 24, color: AppColors.cardBorder),
          const SizedBox(width: 14),
          // Category Chips
          _buildFilterChip(
            label: 'All Categories',
            isSelected: state.selectedCategory == 'ALL',
            onSelected: () => ref.read(expenseStateProvider.notifier).setCategory('ALL'),
          ),
          ...state.categories.take(5).map((cat) {
            return Padding(
              padding: const EdgeInsets.only(left: 8),
              child: _buildFilterChip(
                label: cat,
                isSelected: state.selectedCategory == cat,
                onSelected: () => ref.read(expenseStateProvider.notifier).setCategory(cat),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildFilterChip({
    required String label,
    required bool isSelected,
    required VoidCallback onSelected,
    Color? color,
  }) {
    final activeColor = color ?? AppColors.secondary;
    return ChoiceChip(
      label: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
          color: isSelected ? Colors.white : AppColors.textPrimary,
        ),
      ),
      selected: isSelected,
      selectedColor: activeColor,
      backgroundColor: AppColors.surface,
      side: BorderSide(color: isSelected ? activeColor : AppColors.cardBorder),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
      onSelected: (_) => onSelected(),
    );
  }

  Widget _buildExpenseCard(ExpenseModel exp) {
    return InkWell(
      onTap: () => _showExpenseDetailsModal(exp),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.cardBorder),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Row: Category Icon + Title + Amount
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.secondary.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(exp.categoryIcon, color: AppColors.secondary, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        exp.category,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Text(
                            exp.formattedDate,
                            style: const TextStyle(
                              fontSize: 11,
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          if (exp.expenseCode.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Text(
                              '• ${exp.expenseCode}',
                              style: const TextStyle(
                                fontSize: 11,
                                color: AppColors.textMuted,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '₹${exp.totalAmount.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 4),
                    StatusBadge(
                      status: exp.status,
                      fontSize: 10,
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    ),
                  ],
                ),
              ],
            ),

            // Description / Vendor Row
            if (exp.description.isNotEmpty || exp.vendorName.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.background,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (exp.vendorName.isNotEmpty)
                      Row(
                        children: [
                          const Icon(Icons.storefront_rounded, size: 13, color: AppColors.textSecondary),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              exp.vendorName,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    if (exp.description.isNotEmpty) ...[
                      if (exp.vendorName.isNotEmpty) const SizedBox(height: 4),
                      Text(
                        exp.description,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ],

            // Bottom Footer Row
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.secondary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    exp.paymentMode.replaceAll('_', ' '),
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: AppColors.secondary,
                    ),
                  ),
                ),
                Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit_outlined, size: 18, color: AppColors.textSecondary),
                      visualDensity: VisualDensity.compact,
                      tooltip: 'Edit Claim',
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => AddEditExpenseScreen(initialExpense: exp),
                          ),
                        );
                      },
                    ),
                    IconButton(
                      icon: const Icon(Icons.delete_outline_rounded, size: 18, color: AppColors.error),
                      visualDensity: VisualDensity.compact,
                      tooltip: 'Delete Claim',
                      onPressed: () => _handleDeleteExpense(exp),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
