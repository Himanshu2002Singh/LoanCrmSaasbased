import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/custom_button.dart';
import 'package:capital_care/core/widgets/custom_text_field.dart';
import 'package:capital_care/features/notes/models/note_model.dart';
import 'package:capital_care/features/notes/providers/note_provider.dart';
import 'package:intl/intl.dart';

class AddEditNoteDialog extends ConsumerStatefulWidget {
  final NoteModel? existingNote;
  final int? preselectedLeadId;
  final String? preselectedLeadName;

  const AddEditNoteDialog({
    super.key,
    this.existingNote,
    this.preselectedLeadId,
    this.preselectedLeadName,
  });

  static Future<bool?> show(
    BuildContext context, {
    NoteModel? existingNote,
    int? preselectedLeadId,
    String? preselectedLeadName,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => AddEditNoteDialog(
        existingNote: existingNote,
        preselectedLeadId: preselectedLeadId,
        preselectedLeadName: preselectedLeadName,
      ),
    );
  }

  @override
  ConsumerState<AddEditNoteDialog> createState() => _AddEditNoteDialogState();
}

class _AddEditNoteDialogState extends ConsumerState<AddEditNoteDialog> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _contentController = TextEditingController();

  String _selectedColor = 'amber';
  String _selectedPriority = 'NORMAL';
  bool _isPinned = false;
  DateTime _selectedDate = DateTime.now();

  int? _attachedLeadId;
  String? _attachedLeadTitle;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    if (widget.existingNote != null) {
      final n = widget.existingNote!;
      _titleController.text = n.title;
      _contentController.text = n.content;
      _selectedColor = n.color;
      _selectedPriority = n.priority;
      _isPinned = n.isPinned;
      try {
        _selectedDate = DateTime.parse(n.noteDate);
      } catch (_) {
        _selectedDate = DateTime.now();
      }
      _attachedLeadId = n.leadId;
      if (n.lead != null) {
        _attachedLeadTitle = '${n.lead!.customerName} (${n.lead!.loanType})';
      }
    } else {
      if (widget.preselectedLeadId != null) {
        _attachedLeadId = widget.preselectedLeadId;
        _attachedLeadTitle = widget.preselectedLeadName ?? 'Lead #${widget.preselectedLeadId}';
      }
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(
            primary: AppColors.primary,
            onPrimary: Colors.white,
            onSurface: AppColors.textPrimary,
          ),
        ),
        child: child!,
      ),
    );

    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  void _openLeadPicker() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _LeadPickerSheet(
        selectedLeadId: _attachedLeadId,
        onSelect: (lead) {
          setState(() {
            _attachedLeadId = lead.id;
            _attachedLeadTitle = '${lead.customerName} (${lead.loanType}) - ₹${NumberFormat('#,##,###').format(lead.loanAmount)}';
          });
          Navigator.of(ctx).pop();
        },
      ),
    );
  }

  Future<void> _saveNote() async {
    final title = _titleController.text.trim();
    final content = _contentController.text.trim();

    if (title.isEmpty && content.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a note title or content'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);

      if (widget.existingNote != null) {
        await ref.read(notesProvider.notifier).updateNote(
          widget.existingNote!.id,
          title: title.isNotEmpty ? title : 'Untitled Note',
          content: content,
          color: _selectedColor,
          priority: _selectedPriority,
          isPinned: _isPinned,
          noteDate: dateStr,
          leadId: _attachedLeadId,
          clearLead: _attachedLeadId == null,
        );
      } else {
        await ref.read(notesProvider.notifier).createNote(
          title: title.isNotEmpty ? title : 'Untitled Note',
          content: content,
          color: _selectedColor,
          priority: _selectedPriority,
          isPinned: _isPinned,
          noteDate: dateStr,
          leadId: _attachedLeadId,
        );
      }

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to save note: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = NoteColorTheme.fromId(_selectedColor);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.9,
      ),
      margin: EdgeInsets.only(bottom: bottomInset),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header Bar
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: theme.accent.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.sticky_note_2_rounded, color: theme.accent, size: 20),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      widget.existingNote != null ? 'Edit Quick Note' : 'New Quick Note',
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: AppColors.textMuted),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Scrollable Content
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              physics: const BouncingScrollPhysics(),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Title Field
                    CustomTextField(
                      label: 'Note Title',
                      controller: _titleController,
                      hint: 'e.g. Follow-up reminder, Client meeting points...',
                      prefixIcon: Icons.title_rounded,
                    ),
                    const SizedBox(height: 16),

                    // Content Field
                    CustomTextField(
                      label: 'Note Content / Scratchpad',
                      controller: _contentController,
                      hint: 'Write your private thoughts, reminders, document checklists...',
                      maxLines: 4,
                      prefixIcon: Icons.notes_rounded,
                    ),
                    const SizedBox(height: 18),

                    // Color Palette
                    const Text(
                      'Note Theme Color',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: NoteColorTheme.themes.map((t) {
                        final isSelected = _selectedColor == t.id;
                        return GestureDetector(
                          onTap: () => setState(() => _selectedColor = t.id),
                          child: Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: t.bg,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: isSelected ? t.accent : t.border,
                                width: isSelected ? 2.5 : 1.2,
                              ),
                              boxShadow: isSelected
                                  ? [
                                      BoxShadow(
                                        color: t.accent.withValues(alpha: 0.3),
                                        blurRadius: 6,
                                        offset: const Offset(0, 2),
                                      ),
                                    ]
                                  : null,
                            ),
                            child: Center(
                              child: isSelected
                                  ? Icon(Icons.check_rounded, color: t.accent, size: 20)
                                  : Container(
                                      width: 10,
                                      height: 10,
                                      decoration: BoxDecoration(
                                        color: t.dot,
                                        shape: BoxShape.circle,
                                      ),
                                    ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 18),

                    // Priority Selector
                    const Text(
                      'Priority',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: ['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) {
                        final isSelected = _selectedPriority == p;
                        Color pColor;
                        switch (p) {
                          case 'URGENT':
                            pColor = const Color(0xFFDC2626);
                            break;
                          case 'HIGH':
                            pColor = const Color(0xFFEA580C);
                            break;
                          case 'LOW':
                            pColor = const Color(0xFF64748B);
                            break;
                          default:
                            pColor = const Color(0xFF2563EB);
                        }

                        return Expanded(
                          child: GestureDetector(
                            onTap: () => setState(() => _selectedPriority = p),
                            child: Container(
                              margin: const EdgeInsets.only(right: 6),
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: BoxDecoration(
                                color: isSelected ? pColor.withValues(alpha: 0.15) : AppColors.background,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: isSelected ? pColor : AppColors.cardBorder,
                                  width: isSelected ? 1.5 : 1,
                                ),
                              ),
                              child: Center(
                                child: Text(
                                  p,
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                    color: isSelected ? pColor : AppColors.textSecondary,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 18),

                    // Date & Pin Row
                    Row(
                      children: [
                        // Date Picker Button
                        Expanded(
                          child: GestureDetector(
                            onTap: _pickDate,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                              decoration: BoxDecoration(
                                color: AppColors.background,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: AppColors.cardBorder),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.calendar_today_rounded, size: 16, color: AppColors.primary),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      DateFormat('dd MMM yyyy').format(_selectedDate),
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),

                        // Pin Switch Container
                        GestureDetector(
                          onTap: () => setState(() => _isPinned = !_isPinned),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: _isPinned ? theme.accent.withValues(alpha: 0.15) : AppColors.background,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: _isPinned ? theme.accent : AppColors.cardBorder,
                                width: _isPinned ? 1.5 : 1,
                              ),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  _isPinned ? Icons.push_pin_rounded : Icons.push_pin_outlined,
                                  size: 18,
                                  color: _isPinned ? theme.accent : AppColors.textMuted,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'Pin Note',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: _isPinned ? FontWeight.bold : FontWeight.w600,
                                    color: _isPinned ? theme.accent : AppColors.textPrimary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 18),

                    // Connected Lead Selector
                    const Text(
                      'Attach to Lead (Optional)',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 8),

                    if (_attachedLeadId != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.06),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.link_rounded, color: AppColors.primary, size: 20),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _attachedLeadTitle ?? 'Lead #$_attachedLeadId',
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.close_rounded, size: 18, color: AppColors.error),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                              onPressed: () {
                                setState(() {
                                  _attachedLeadId = null;
                                  _attachedLeadTitle = null;
                                });
                              },
                            ),
                          ],
                        ),
                      )
                    else
                      OutlinedButton.icon(
                        icon: const Icon(Icons.add_link_rounded, size: 18),
                        label: const Text('Connect a Lead to this Note'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primary,
                          side: const BorderSide(color: AppColors.primary),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          minimumSize: const Size(double.infinity, 44),
                        ),
                        onPressed: _openLeadPicker,
                      ),
                    const SizedBox(height: 24),

                    // Save Button
                    CustomButton(
                      text: widget.existingNote != null ? 'Save Changes' : 'Create Quick Note',
                      isLoading: _isSubmitting,
                      icon: Icons.check_circle_rounded,
                      backgroundColor: theme.accent,
                      textColor: Colors.white,
                      onPressed: _saveNote,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _LeadPickerSheet extends ConsumerStatefulWidget {
  final int? selectedLeadId;
  final ValueChanged<AssignableLeadModel> onSelect;

  const _LeadPickerSheet({
    required this.selectedLeadId,
    required this.onSelect,
  });

  @override
  ConsumerState<_LeadPickerSheet> createState() => _LeadPickerSheetState();
}

class _LeadPickerSheetState extends ConsumerState<_LeadPickerSheet> {
  final _searchController = TextEditingController();
  String _searchTerm = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final leadsAsync = ref.watch(assignableLeadsProvider(_searchTerm));

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.link_rounded, color: AppColors.primary),
                    SizedBox(width: 8),
                    Text(
                      'Select Lead to Attach',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Search Field
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search by Customer Name, Mobile, Loan Type...',
                prefixIcon: const Icon(Icons.search, color: AppColors.textMuted),
                filled: true,
                fillColor: AppColors.background,
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: const BorderSide(color: AppColors.inputBorder),
                ),
                suffixIcon: _searchTerm.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, size: 18),
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _searchTerm = '');
                        },
                      )
                    : null,
              ),
              onChanged: (val) {
                setState(() => _searchTerm = val.trim());
              },
            ),
          ),

          // List of Leads
          Expanded(
            child: leadsAsync.when(
              data: (leads) {
                if (leads.isEmpty) {
                  return const Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: Text(
                        'No assigned leads found matching your search.',
                        style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                      ),
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: leads.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (ctx, idx) {
                    final ld = leads[idx];
                    final isSelected = ld.id == widget.selectedLeadId;

                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      tileColor: isSelected ? AppColors.primary.withValues(alpha: 0.08) : null,
                      leading: CircleAvatar(
                        backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                        child: Text(
                          ld.customerName.isNotEmpty ? ld.customerName[0].toUpperCase() : 'C',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
                        ),
                      ),
                      title: Text(
                        ld.customerName,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                      ),
                      subtitle: Text(
                        '${ld.loanType} • ₹${NumberFormat('#,##,###').format(ld.loanAmount)} • ${ld.customerMobile}',
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                      trailing: isSelected
                          ? const Icon(Icons.check_circle_rounded, color: AppColors.primary)
                          : const Icon(Icons.add_circle_outline_rounded, color: AppColors.textMuted),
                      onTap: () => widget.onSelect(ld),
                    );
                  },
                );
              },
              loading: () => const Center(
                child: CircularProgressIndicator(color: AppColors.primary),
              ),
              error: (err, _) => Center(
                child: Text('Failed to load leads: $err', style: const TextStyle(color: AppColors.error, fontSize: 12)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
