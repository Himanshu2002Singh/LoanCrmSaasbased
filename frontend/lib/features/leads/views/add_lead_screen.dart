import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/custom_button.dart';
import 'package:capital_care/core/widgets/custom_text_field.dart';
import 'package:capital_care/features/leads/models/lead_status_model.dart';
import 'package:capital_care/features/leads/providers/leads_provider.dart';
import 'package:capital_care/features/dashboard/providers/dashboard_provider.dart';

class AddLeadScreen extends ConsumerStatefulWidget {
  final String? initialMobile;

  const AddLeadScreen({super.key, this.initialMobile});

  @override
  ConsumerState<AddLeadScreen> createState() => _AddLeadScreenState();
}

class _AddLeadScreenState extends ConsumerState<AddLeadScreen> {
  final _formKey = GlobalKey<FormState>();

  // Customer Controllers
  final _nameController = TextEditingController();
  final _mobileController = TextEditingController();
  final _altMobileController = TextEditingController();
  final _emailController = TextEditingController();
  final _cityController = TextEditingController();
  final _panController = TextEditingController();
  final _incomeController = TextEditingController();

  // Lead Controllers
  final _amountController = TextEditingController();
  final _remarksController = TextEditingController();

  // Dropdown states
  String _selectedEmployment = 'Salaried';
  String _selectedLoanProduct = 'Personal Loan';
  String _selectedSource = 'Telecalling';
  String _selectedPriority = 'MEDIUM';
  String? _selectedStatus;
  DateTime? _nextFollowupDate;
  TimeOfDay? _nextFollowupTime;

  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    if (widget.initialMobile != null && widget.initialMobile!.isNotEmpty) {
      _mobileController.text = widget.initialMobile!;
    }
  }

  final List<String> _employmentTypes = [
    'Salaried',
    'Self-Employed',
    'Business Owner',
    'Professional',
    'Other',
  ];

  final List<String> _loanProducts = [
    'Personal Loan',
    'Home Loan',
    'Business Loan',
    'Mortgage Loan',
    'Used Car Loan',
    'CC / OD',
    'Education Loan',
    'Mutual Fund',
    'Insurance',
    'Other',
  ];

  final List<String> _leadSources = [
    'Telecalling',
    'Direct',
    'Website',
    'Social Media',
    'Google Ads',
    'Referral',
    'Walk-in',
    'Partner DSA',
  ];

  final List<String> _priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

  @override
  void dispose() {
    _nameController.dispose();
    _mobileController.dispose();
    _altMobileController.dispose();
    _emailController.dispose();
    _cityController.dispose();
    _panController.dispose();
    _incomeController.dispose();
    _amountController.dispose();
    _remarksController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _nextFollowupDate ?? now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() => _nextFollowupDate = picked);
      if (mounted && _nextFollowupTime == null) {
        _pickTime();
      }
    }
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _nextFollowupTime ?? const TimeOfDay(hour: 11, minute: 0),
    );
    if (picked != null) {
      setState(() => _nextFollowupTime = picked);
    }
  }

  Future<void> _saveLead() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSaving = true);

    try {
      String? nextMeeting;
      if (_nextFollowupDate != null) {
        final time = _nextFollowupTime ?? const TimeOfDay(hour: 11, minute: 0);
        final dt = DateTime(
          _nextFollowupDate!.year,
          _nextFollowupDate!.month,
          _nextFollowupDate!.day,
          time.hour,
          time.minute,
        );
        nextMeeting = dt.toIso8601String();
      }

      final payload = <String, dynamic>{
        'name': _nameController.text.trim(),
        'number': _mobileController.text.trim(),
        'alternate_number': _altMobileController.text.trim().isNotEmpty ? _altMobileController.text.trim() : null,
        'email': _emailController.text.trim().isNotEmpty ? _emailController.text.trim() : null,
        'city': _cityController.text.trim().isNotEmpty ? _cityController.text.trim() : null,
        'employment_type': _selectedEmployment,
        'monthly_income': _incomeController.text.trim().isNotEmpty ? double.tryParse(_incomeController.text.trim()) : null,
        'income': _incomeController.text.trim().isNotEmpty ? double.tryParse(_incomeController.text.trim()) : null,
        'pan_number': _panController.text.trim().isNotEmpty ? _panController.text.trim().toUpperCase() : null,
        'loan_type': _selectedLoanProduct,
        'est_budget': double.tryParse(_amountController.text.trim()) ?? 0,
        'source': _selectedSource,
        'priority': _selectedPriority,
        'status': _selectedStatus,
        'next_meeting': nextMeeting,
        'remarks': _remarksController.text.trim().isNotEmpty ? _remarksController.text.trim() : null,
      };

      await ref.read(leadsNotifierProvider.notifier).createLead(payload);
      ref.invalidate(dashboardDataProvider);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Lead created successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to create lead: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusesAsync = ref.watch(leadStatusesProvider);
    final loanProductsAsync = ref.watch(loanProductsProvider);
    final leadSourcesAsync = ref.watch(leadSourcesProvider);

    final loanProductItems = loanProductsAsync.maybeWhen(
      data: (products) => products.isNotEmpty
          ? products.map((p) => p.label).where((s) => s.trim().isNotEmpty).toSet().toList()
          : _loanProducts.toSet().toList(),
      orElse: () => _loanProducts.toSet().toList(),
    );
    if (!loanProductItems.contains(_selectedLoanProduct) && loanProductItems.isNotEmpty) {
      _selectedLoanProduct = loanProductItems.first;
    }

    final leadSourceItems = leadSourcesAsync.maybeWhen(
      data: (sources) => sources.isNotEmpty
          ? sources.map((s) => s.label).where((s) => s.trim().isNotEmpty).toSet().toList()
          : _leadSources.toSet().toList(),
      orElse: () => _leadSources.toSet().toList(),
    );
    if (!leadSourceItems.contains(_selectedSource) && leadSourceItems.isNotEmpty) {
      _selectedSource = leadSourceItems.first;
    }

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Add New Lead'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Section 1: Customer Personal Details
              _buildSectionHeader('Customer Information', Icons.person_outline),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.cardBorder),
                ),
                child: Column(
                  children: [
                    CustomTextField(
                      label: 'Full Name *',
                      controller: _nameController,
                      hint: 'Enter customer name',
                      prefixIcon: Icons.person,
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Please enter customer name' : null,
                    ),
                    const SizedBox(height: 12),
                    CustomTextField(
                      label: 'Mobile Number *',
                      controller: _mobileController,
                      hint: '10-digit mobile number',
                      keyboardType: TextInputType.phone,
                      prefixIcon: Icons.phone_android,
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) return 'Mobile number is required';
                        final cleaned = v.replaceAll(RegExp(r'\D'), '');
                        if (cleaned.length < 10) return 'Enter a valid 10-digit number';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: CustomTextField(
                            label: 'Alternate Number',
                            controller: _altMobileController,
                            hint: 'Optional mobile',
                            keyboardType: TextInputType.phone,
                            prefixIcon: Icons.phone,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: CustomTextField(
                            label: 'City',
                            controller: _cityController,
                            hint: 'e.g. Mumbai',
                            prefixIcon: Icons.location_city,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: CustomTextField(
                            label: 'Email',
                            controller: _emailController,
                            hint: 'name@email.com',
                            keyboardType: TextInputType.emailAddress,
                            prefixIcon: Icons.email_outlined,
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: CustomTextField(
                            label: 'PAN Number',
                            controller: _panController,
                            hint: 'ABCDE1234F',
                            textCapitalization: TextCapitalization.characters,
                            prefixIcon: Icons.badge_outlined,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _buildDropdownField(
                            label: 'Employment Type',
                            value: _selectedEmployment,
                            items: _employmentTypes,
                            onChanged: (val) {
                              if (val != null) setState(() => _selectedEmployment = val);
                            },
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: CustomTextField(
                            label: 'Monthly Income (₹)',
                            controller: _incomeController,
                            hint: 'e.g. 50000',
                            keyboardType: TextInputType.number,
                            prefixIcon: Icons.currency_rupee,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Section 2: Loan & Requirement Details
              _buildSectionHeader('Loan Requirement', Icons.account_balance_wallet_outlined),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.cardBorder),
                ),
                child: Column(
                  children: [
                    _buildDropdownField(
                      label: 'Loan Product *',
                      value: _selectedLoanProduct,
                      items: loanProductItems,
                      onChanged: (val) {
                        if (val != null) setState(() => _selectedLoanProduct = val);
                      },
                    ),
                    const SizedBox(height: 12),
                    CustomTextField(
                      label: 'Required Amount (₹) *',
                      controller: _amountController,
                      hint: 'e.g. 500000',
                      keyboardType: TextInputType.number,
                      prefixIcon: Icons.currency_rupee,
                      validator: (v) {
                        if (v == null || v.trim().isEmpty) return 'Loan amount is required';
                        if (double.tryParse(v) == null) return 'Enter valid loan amount';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _buildDropdownField(
                            label: 'Lead Source',
                            value: _selectedSource,
                            items: leadSourceItems,
                            onChanged: (val) {
                              if (val != null) setState(() => _selectedSource = val);
                            },
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: _buildDropdownField(
                            label: 'Priority',
                            value: _selectedPriority,
                            items: _priorities,
                            onChanged: (val) {
                              if (val != null) setState(() => _selectedPriority = val);
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Dynamic Status Dropdown
                    statusesAsync.when(
                      data: (statuses) {
                        final seenValues = <String>{};
                        final availableStatuses = <LeadStatusModel>[];
                        for (final s in statuses) {
                          if ((s.team == null || s.team == 'calling' || s.team == 'both') && !seenValues.contains(s.value)) {
                            seenValues.add(s.value);
                            availableStatuses.add(s);
                          }
                        }
                        if (availableStatuses.isEmpty) return const SizedBox.shrink();

                        if (_selectedStatus == null || !availableStatuses.any((s) => s.value == _selectedStatus)) {
                          _selectedStatus = availableStatuses.first.value;
                        }
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Initial Pipeline Status',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 6),
                            DropdownButtonFormField<String>(
                              isExpanded: true,
                              value: _selectedStatus,
                              decoration: InputDecoration(
                                filled: true,
                                fillColor: AppColors.background,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: AppColors.inputBorder),
                                ),
                              ),
                              items: availableStatuses.map((s) {
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
                                setState(() => _selectedStatus = val);
                              },
                            ),
                          ],
                        );
                      },
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Section 3: Follow-up & Remarks
              _buildSectionHeader('Follow-up & Notes', Icons.schedule),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.cardBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Next Follow-up Date & Time (Optional)',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: InkWell(
                            onTap: _pickDate,
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              decoration: BoxDecoration(
                                color: AppColors.background,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.inputBorder),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.calendar_today, size: 16, color: AppColors.primary),
                                  const SizedBox(width: 8),
                                  Text(
                                    _nextFollowupDate != null
                                        ? DateFormat('dd MMM yyyy').format(_nextFollowupDate!)
                                        : 'Pick Date',
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: _nextFollowupDate != null ? AppColors.textPrimary : AppColors.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: InkWell(
                            onTap: _pickTime,
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              decoration: BoxDecoration(
                                color: AppColors.background,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: AppColors.inputBorder),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.access_time, size: 16, color: AppColors.primary),
                                  const SizedBox(width: 8),
                                  Text(
                                    _nextFollowupTime != null ? _nextFollowupTime!.format(context) : 'Pick Time',
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: _nextFollowupTime != null ? AppColors.textPrimary : AppColors.textMuted,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    CustomTextField(
                      label: 'Initial Remarks / Notes',
                      controller: _remarksController,
                      hint: 'Any customer background or special loan condition...',
                      maxLines: 3,
                      prefixIcon: Icons.notes_outlined,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Save Button
              CustomButton(
                text: 'Create Lead',
                isLoading: _isSaving,
                icon: Icons.check,
                onPressed: _saveLead,
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 18, color: AppColors.primary),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
      ],
    );
  }

  Widget _buildDropdownField({
    required String label,
    required String value,
    required List<String> items,
    required ValueChanged<String?> onChanged,
  }) {
    final uniqueItems = items.toSet().toList();
    final effectiveValue = uniqueItems.contains(value)
        ? value
        : (uniqueItems.isNotEmpty ? uniqueItems.first : null);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 6),
        DropdownButtonFormField<String>(
          isExpanded: true,
          value: effectiveValue,
          decoration: InputDecoration(
            filled: true,
            fillColor: AppColors.background,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.inputBorder),
            ),
          ),
          items: uniqueItems.map((item) {
            return DropdownMenuItem<String>(
              value: item,
              child: Text(
                item,
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
              ),
            );
          }).toList(),
          onChanged: onChanged,
        ),
      ],
    );
  }
}
