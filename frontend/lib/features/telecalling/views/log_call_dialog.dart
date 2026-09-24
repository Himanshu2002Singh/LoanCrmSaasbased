import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/custom_button.dart';
import 'package:capital_care/core/widgets/custom_text_field.dart';
import 'package:capital_care/features/leads/models/lead_model.dart';
import 'package:capital_care/features/leads/providers/leads_provider.dart';
import 'package:capital_care/features/telecalling/providers/telecalling_provider.dart';
import 'package:capital_care/features/dashboard/providers/dashboard_provider.dart';

class LogCallDialog extends ConsumerStatefulWidget {
  final LeadModel lead;

  const LogCallDialog({super.key, required this.lead});

  @override
  ConsumerState<LogCallDialog> createState() => _LogCallDialogState();
}

class _LogCallDialogState extends ConsumerState<LogCallDialog> {
  final _formKey = GlobalKey<FormState>();
  String _selectedStatus = 'CONNECTED';
  final TextEditingController _durationController = TextEditingController(text: '60');
  final TextEditingController _remarksController = TextEditingController();
  DateTime? _nextFollowupDate;
  TimeOfDay? _nextFollowupTime;
  bool _isSubmitting = false;

  final List<Map<String, dynamic>> _callStatuses = [
    {'value': 'CONNECTED', 'label': 'Connected', 'icon': Icons.phone_in_talk, 'color': AppColors.success},
    {'value': 'INTERESTED', 'label': 'Interested', 'icon': Icons.thumb_up_alt_outlined, 'color': AppColors.primary},
    {'value': 'CALL_BACK_LATER', 'label': 'Callback Later', 'icon': Icons.schedule, 'color': AppColors.warning},
    {'value': 'NOT_CONNECTED', 'label': 'Not Connected', 'icon': Icons.phone_missed, 'color': AppColors.error},
    {'value': 'BUSY', 'label': 'Busy', 'icon': Icons.phone_paused, 'color': Colors.orange},
    {'value': 'SWITCHED_OFF', 'label': 'Switched Off', 'icon': Icons.power_settings_new, 'color': Colors.grey},
    {'value': 'NOT_INTERESTED', 'label': 'Not Interested', 'icon': Icons.thumb_down_alt_outlined, 'color': Colors.redAccent},
  ];

  @override
  void dispose() {
    _durationController.dispose();
    _remarksController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final pickedDate = await showDatePicker(
      context: context,
      initialDate: _nextFollowupDate ?? now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (pickedDate != null) {
      setState(() => _nextFollowupDate = pickedDate);
      if (mounted && _nextFollowupTime == null) {
        _pickTime();
      }
    }
  }

  Future<void> _pickTime() async {
    final pickedTime = await showTimePicker(
      context: context,
      initialTime: _nextFollowupTime ?? const TimeOfDay(hour: 11, minute: 0),
    );
    if (pickedTime != null) {
      setState(() => _nextFollowupTime = pickedTime);
    }
  }

  Future<void> _submitCall() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    try {
      final duration = int.tryParse(_durationController.text.trim()) ?? 0;
      String? formattedFollowup;
      if (_nextFollowupDate != null) {
        final time = _nextFollowupTime ?? const TimeOfDay(hour: 10, minute: 0);
        final dt = DateTime(
          _nextFollowupDate!.year,
          _nextFollowupDate!.month,
          _nextFollowupDate!.day,
          time.hour,
          time.minute,
        );
        formattedFollowup = dt.toIso8601String();
      }

      await ref.read(callsNotifierProvider.notifier).logCall({
        'lead_id': widget.lead.id,
        'call_status': _selectedStatus,
        'duration': duration,
        'remarks': _remarksController.text.trim().isNotEmpty ? _remarksController.text.trim() : null,
        'next_meeting': formattedFollowup,
      });

      // Also refresh dashboard and leads
      ref.invalidate(singleLeadProvider(widget.lead.id));
      ref.read(leadsNotifierProvider.notifier).loadLeads(refresh: true);
      ref.invalidate(dashboardDataProvider);

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Call log saved successfully'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to log call: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      backgroundColor: AppColors.surface,
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Log Call Outcome',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            '${widget.lead.name} (${widget.lead.number})',
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: AppColors.textMuted),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
                const Divider(height: 24),

                // Call Outcome Chips
                const Text(
                  'Call Outcome',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _callStatuses.map((st) {
                    final isSelected = _selectedStatus == st['value'];
                    return ChoiceChip(
                      avatar: Icon(st['icon'] as IconData, size: 14, color: isSelected ? Colors.white : st['color'] as Color),
                      label: Text(st['label'] as String),
                      selected: isSelected,
                      selectedColor: st['color'] as Color,
                      labelStyle: TextStyle(
                        color: isSelected ? Colors.white : AppColors.textPrimary,
                        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                        fontSize: 12,
                      ),
                      backgroundColor: AppColors.background,
                      side: BorderSide(
                        color: isSelected ? (st['color'] as Color) : AppColors.cardBorder,
                      ),
                      onSelected: (val) {
                        if (val) setState(() => _selectedStatus = st['value'] as String);
                      },
                    );
                  }).toList(),
                ),
                const SizedBox(height: 16),

                // Duration field
                CustomTextField(
                  label: 'Call Duration (seconds)',
                  controller: _durationController,
                  hint: 'e.g. 45',
                  keyboardType: TextInputType.number,
                  prefixIcon: Icons.timer_outlined,
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Enter duration';
                    if (int.tryParse(v) == null) return 'Enter valid number';
                    return null;
                  },
                ),
                const SizedBox(height: 14),

                // Followup Scheduler
                const Text(
                  'Next Follow-up Date & Time (Optional)',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
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

                // Remarks
                CustomTextField(
                  label: 'Remarks / Notes',
                  controller: _remarksController,
                  hint: 'Enter details of the conversation...',
                  maxLines: 3,
                  prefixIcon: Icons.notes_outlined,
                ),
                const SizedBox(height: 20),

                // Submit Button
                CustomButton(
                  text: 'Save Call Log',
                  isLoading: _isSubmitting,
                  icon: Icons.check_circle_outline,
                  onPressed: _submitCall,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
