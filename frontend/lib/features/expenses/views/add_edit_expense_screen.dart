import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/custom_button.dart';
import 'package:capital_care/core/widgets/custom_text_field.dart';
import 'package:capital_care/features/expenses/models/expense_model.dart';
import 'package:capital_care/features/expenses/providers/expense_provider.dart';

class AddEditExpenseScreen extends ConsumerStatefulWidget {
  final ExpenseModel? initialExpense;

  const AddEditExpenseScreen({super.key, this.initialExpense});

  @override
  ConsumerState<AddEditExpenseScreen> createState() => _AddEditExpenseScreenState();
}

class _AddEditExpenseScreenState extends ConsumerState<AddEditExpenseScreen> {
  final _formKey = GlobalKey<FormState>();

  late DateTime _selectedDate;
  late String _selectedCategory;
  late String _paymentMode;
  late String _status;

  late TextEditingController _amountController;
  late TextEditingController _vendorController;
  late TextEditingController _descriptionController;
  late TextEditingController _remarksController;

  final List<String> _paymentModes = ['UPI', 'CASH', 'BANK_TRANSFER', 'CARD', 'NET_BANKING'];
  final List<String> _statusOptions = ['PAID', 'PENDING'];

  @override
  void initState() {
    super.initState();
    final exp = widget.initialExpense;

    if (exp != null && exp.expenseDate.isNotEmpty) {
      _selectedDate = DateTime.tryParse(exp.expenseDate) ?? DateTime.now();
    } else {
      _selectedDate = DateTime.now();
    }

    final categories = ref.read(expenseStateProvider).categories;
    _selectedCategory = exp?.category ?? (categories.isNotEmpty ? categories.first : 'Travel & Fuel');
    _paymentMode = exp?.paymentMode ?? 'UPI';
    _status = exp?.status ?? 'PAID';

    _amountController = TextEditingController(
      text: exp != null && exp.totalAmount > 0 ? exp.totalAmount.toStringAsFixed(2) : '',
    );
    _vendorController = TextEditingController(text: exp?.vendorName ?? '');
    _descriptionController = TextEditingController(text: exp?.description ?? '');
    _remarksController = TextEditingController(text: exp?.remarks ?? '');
  }

  @override
  void dispose() {
    _amountController.dispose();
    _vendorController.dispose();
    _descriptionController.dispose();
    _remarksController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.secondary,
              onPrimary: Colors.white,
              onSurface: AppColors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    final amount = double.tryParse(_amountController.text.trim()) ?? 0.0;
    if (amount <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a valid expense amount greater than 0'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final monthStr = DateFormat('yyyy-MM').format(_selectedDate);

    final payload = {
      'expenseDate': dateStr,
      'expenseMonth': monthStr,
      'category': _selectedCategory,
      'amount': amount,
      'baseAmount': amount,
      'paymentMode': _paymentMode,
      'status': _status,
      'vendorName': _vendorController.text.trim(),
      'description': _descriptionController.text.trim(),
      'remarks': _remarksController.text.trim(),
      'expenseType': 'EMPLOYEE',
    };

    try {
      if (widget.initialExpense != null) {
        await ref.read(expenseStateProvider.notifier).updateExpense(widget.initialExpense!.id, payload);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Expense claim updated successfully!'),
              backgroundColor: AppColors.success,
            ),
          );
          context.pop();
        }
      } else {
        await ref.read(expenseStateProvider.notifier).createExpense(payload);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Expense claim submitted successfully!'),
              backgroundColor: AppColors.success,
            ),
          );
          context.pop();
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save expense: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(expenseStateProvider);
    final isEditing = widget.initialExpense != null;
    final categories = state.categories.isNotEmpty
        ? state.categories
        : [
            'Travel & Fuel',
            'Client Meeting & Food',
            'Tea, Coffee & Pantry',
            'Mobile Recharge',
            'Stationery & Printing',
            'Courier & Postage',
            'Software & Subscriptions',
            'Miscellaneous',
          ];

    if (!categories.contains(_selectedCategory)) {
      _selectedCategory = categories.first;
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(isEditing ? 'Edit Expense Claim' : 'Claim New Expense'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => context.pop(),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.primaryLight],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.receipt_long_rounded, color: Colors.white, size: 26),
                    ),
                    const SizedBox(width: 14),
                    const Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Employee Expense Claim',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Submit expenses incurred during work, meetings, or travel for admin approval.',
                            style: TextStyle(
                              color: Colors.white70,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Form Section Card
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.cardBorder),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.02),
                      blurRadius: 10,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Date Field
                    const Text(
                      'Expense Date *',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    InkWell(
                      onTap: _pickDate,
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.inputBorder),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.calendar_today_rounded, size: 18, color: AppColors.secondary),
                            const SizedBox(width: 10),
                            Text(
                              DateFormat('dd MMMM yyyy').format(_selectedDate),
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                            ),
                            const Spacer(),
                            const Icon(Icons.arrow_drop_down, color: AppColors.textSecondary),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Category Dropdown
                    const Text(
                      'Category *',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: _selectedCategory,
                      decoration: InputDecoration(
                        prefixIcon: const Icon(Icons.category_rounded, size: 18, color: AppColors.secondary),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppColors.inputBorder),
                        ),
                      ),
                      items: categories.map((cat) {
                        return DropdownMenuItem<String>(
                          value: cat,
                          child: Text(cat, style: const TextStyle(fontSize: 14)),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setState(() {
                            _selectedCategory = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 16),

                    // Amount Field
                    CustomTextField(
                      controller: _amountController,
                      label: 'Amount (₹) *',
                      hint: 'e.g. 450.00',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      prefixIcon: Icons.currency_rupee_rounded,
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Amount is required';
                        }
                        final num = double.tryParse(val.trim());
                        if (num == null || num <= 0) {
                          return 'Enter a valid positive number';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Payment Mode Selector
                    const Text(
                      'Payment Mode *',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _paymentModes.map((mode) {
                        final isSelected = _paymentMode == mode;
                        return ChoiceChip(
                          label: Text(
                            mode.replaceAll('_', ' '),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                              color: isSelected ? Colors.white : AppColors.textPrimary,
                            ),
                          ),
                          selected: isSelected,
                          selectedColor: AppColors.secondary,
                          backgroundColor: AppColors.background,
                          side: BorderSide(
                            color: isSelected ? AppColors.secondary : AppColors.cardBorder,
                          ),
                          onSelected: (selected) {
                            if (selected) {
                              setState(() {
                                _paymentMode = mode;
                              });
                            }
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),

                    // Status (Paid vs Pending)
                    const Text(
                      'Expense Status *',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: _statusOptions.map((statusOpt) {
                        final isSelected = _status == statusOpt;
                        final isPaidOpt = statusOpt == 'PAID';
                        return Expanded(
                          child: Padding(
                            padding: EdgeInsets.only(right: isPaidOpt ? 8 : 0, left: !isPaidOpt ? 8 : 0),
                            child: InkWell(
                              onTap: () {
                                setState(() {
                                  _status = statusOpt;
                                });
                              },
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? (isPaidOpt ? AppColors.success.withValues(alpha: 0.12) : AppColors.warning.withValues(alpha: 0.12))
                                      : AppColors.background,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isSelected
                                        ? (isPaidOpt ? AppColors.success : AppColors.warning)
                                        : AppColors.cardBorder,
                                    width: isSelected ? 1.5 : 1,
                                  ),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      isPaidOpt ? Icons.check_circle_rounded : Icons.hourglass_top_rounded,
                                      size: 16,
                                      color: isPaidOpt ? AppColors.success : AppColors.warning,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      isPaidOpt ? 'Paid by Me' : 'Pending Payment',
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                                        color: isSelected
                                            ? (isPaidOpt ? AppColors.success : AppColors.warning)
                                            : AppColors.textPrimary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),

                    // Vendor / Payee Name
                    CustomTextField(
                      controller: _vendorController,
                      label: 'Vendor / Payee Name',
                      hint: 'e.g. Uber, Fuel Station, Chai Stall, Local Print Shop',
                      prefixIcon: Icons.storefront_rounded,
                    ),
                    const SizedBox(height: 16),

                    // Description / Purpose
                    CustomTextField(
                      controller: _descriptionController,
                      label: 'Description / Purpose *',
                      hint: 'e.g. Travel for customer loan file login meeting',
                      prefixIcon: Icons.notes_rounded,
                      maxLines: 2,
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'Please enter purpose or description';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Remarks
                    CustomTextField(
                      controller: _remarksController,
                      label: 'Additional Remarks',
                      hint: 'Optional notes for admin or accounts',
                      prefixIcon: Icons.chat_bubble_outline_rounded,
                      maxLines: 2,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Submit Button
              CustomButton(
                text: isEditing ? 'Update Expense Claim' : 'Submit Expense Claim',
                icon: isEditing ? Icons.save_rounded : Icons.send_rounded,
                isLoading: state.isSubmitting,
                onPressed: state.isSubmitting ? null : _handleSubmit,
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }
}
