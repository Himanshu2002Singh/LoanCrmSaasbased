import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/app_drawer.dart';
import 'package:capital_care/core/widgets/empty_state_view.dart';
import 'package:capital_care/features/notes/models/note_model.dart';
import 'package:capital_care/features/notes/providers/note_provider.dart';
import 'package:capital_care/features/notes/views/widgets/add_edit_note_dialog.dart';
import 'package:capital_care/features/notes/views/widgets/note_card.dart';

class NotesScreen extends ConsumerStatefulWidget {
  const NotesScreen({super.key});

  @override
  ConsumerState<NotesScreen> createState() => _NotesScreenState();
}

class _NotesScreenState extends ConsumerState<NotesScreen> {
  final TextEditingController _searchController = TextEditingController();
  bool _isSearchOpen = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final notesAsync = ref.watch(notesProvider);
    final filteredNotes = ref.watch(filteredNotesProvider);
    final filterState = ref.watch(notesFilterProvider);

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
            const Text(
              'Quick Notes',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
              ),
            ),
            Row(
              children: [
                Icon(
                  Icons.lock_rounded,
                  size: 11,
                  color: AppColors.textSecondary.withValues(alpha: 0.8),
                ),
                const SizedBox(width: 4),
                Text(
                  'Private Scratchpad • Only you can see',
                  style: TextStyle(
                    fontSize: 11,
                    color: AppColors.textSecondary.withValues(alpha: 0.8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Icon(_isSearchOpen ? Icons.search_off_rounded : Icons.search_rounded),
            tooltip: _isSearchOpen ? 'Close Search' : 'Search Notes',
            onPressed: () {
              setState(() {
                _isSearchOpen = !_isSearchOpen;
                if (!_isSearchOpen) {
                  _searchController.clear();
                  ref.read(notesFilterProvider.notifier).setSearch('');
                }
              });
            },
          ),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh',
            onPressed: () => ref.read(notesProvider.notifier).refresh(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        elevation: 4,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text(
          'New Note',
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
        ),
        onPressed: () => _openAddNoteDialog(context),
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () => ref.read(notesProvider.notifier).refresh(),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            // Search Bar (expandable)
            if (_isSearchOpen)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.border),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.03),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: TextField(
                      controller: _searchController,
                      autofocus: true,
                      decoration: InputDecoration(
                        hintText: 'Search notes, customer name, mobile...',
                        hintStyle: TextStyle(
                          color: AppColors.textMuted.withValues(alpha: 0.8),
                          fontSize: 14,
                        ),
                        prefixIcon: const Icon(Icons.search_rounded, color: AppColors.primary, size: 20),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear_rounded, size: 18),
                                onPressed: () {
                                  _searchController.clear();
                                  ref.read(notesFilterProvider.notifier).setSearch('');
                                  setState(() {});
                                },
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      ),
                      onChanged: (val) {
                        ref.read(notesFilterProvider.notifier).setSearch(val);
                        setState(() {});
                      },
                    ),
                  ),
                ),
              ),

            // Top Privacy Info Banner & Stats
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildPrivacyNotice(),
                    const SizedBox(height: 12),
                    notesAsync.maybeWhen(
                      data: (allNotes) => _buildStatsRow(allNotes),
                      orElse: () => const SizedBox.shrink(),
                    ),
                    const SizedBox(height: 12),
                    _buildFilterChips(filterState),
                  ],
                ),
              ),
            ),

            // Notes List or Empty State
            notesAsync.when(
              loading: () => const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.primary),
                ),
              ),
              error: (err, stack) => SliverFillRemaining(
                hasScrollBody: false,
                child: Center(
                  child: EmptyStateView(
                    icon: Icons.error_outline_rounded,
                    title: 'Failed to load notes',
                    message: err.toString(),
                    actionLabel: 'Retry',
                    onAction: () => ref.read(notesProvider.notifier).refresh(),
                  ),
                ),
              ),
              data: (allNotes) {
                if (allNotes.isEmpty) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              width: 80,
                              height: 80,
                              decoration: BoxDecoration(
                                color: const Color(0xFFFEF3C7),
                                shape: BoxShape.circle,
                                border: Border.all(color: const Color(0xFFFDE68A), width: 2),
                              ),
                              child: const Icon(
                                Icons.sticky_note_2_rounded,
                                size: 40,
                                color: Color(0xFFD97706),
                              ),
                            ),
                            const SizedBox(height: 16),
                            const Text(
                              'No Notes Yet',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Jot down meeting points, customer follow-up notes, or personal reminders. All notes are 100% private to you.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13,
                                color: AppColors.textSecondary,
                                height: 1.4,
                              ),
                            ),
                            const SizedBox(height: 20),
                            ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                              ),
                              icon: const Icon(Icons.add_rounded, color: Colors.white, size: 18),
                              label: const Text(
                                'Create Your First Note',
                                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                              ),
                              onPressed: () => _openAddNoteDialog(context),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }

                if (filteredNotes.isEmpty) {
                  return SliverFillRemaining(
                    hasScrollBody: false,
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.filter_alt_off_rounded,
                              size: 48,
                              color: AppColors.textMuted.withValues(alpha: 0.6),
                            ),
                            const SizedBox(height: 12),
                            const Text(
                              'No matching notes',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Try adjusting your search or filters.',
                              style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                            ),
                            const SizedBox(height: 14),
                            TextButton.icon(
                              icon: const Icon(Icons.refresh_rounded, size: 16),
                              label: const Text('Reset Filters'),
                              onPressed: () {
                                _searchController.clear();
                                ref.read(notesFilterProvider.notifier).reset();
                                setState(() {
                                  _isSearchOpen = false;
                                });
                              },
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }

                return SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 80),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final note = filteredNotes[index];
                        return NoteCard(
                          note: note,
                          onEdit: () => _openEditNoteDialog(context, note),
                        );
                      },
                      childCount: filteredNotes.length,
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPrivacyNotice() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFBBF7D0)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: const BoxDecoration(
              color: Color(0xFFDCFCE7),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.lock_outline_rounded,
              size: 16,
              color: Color(0xFF16A34A),
            ),
          ),
          const SizedBox(width: 10),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Confidential & Private Space',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF15803D),
                  ),
                ),
                Text(
                  'These notes are strictly visible to your account only.',
                  style: TextStyle(
                    fontSize: 11,
                    color: Color(0xFF166534),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow(List<NoteModel> notes) {
    final total = notes.length;
    final pinned = notes.where((n) => n.isPinned).length;
    final urgentOrHigh = notes.where((n) => n.priority == 'URGENT' || n.priority == 'HIGH').length;
    final connectedLeads = notes.where((n) => n.hasLead).length;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _buildStatCard(
            title: 'Total Notes',
            count: '$total',
            icon: Icons.notes_rounded,
            color: const Color(0xFF3B82F6),
            bgColor: const Color(0xFFEFF6FF),
          ),
          const SizedBox(width: 8),
          _buildStatCard(
            title: 'Pinned',
            count: '$pinned',
            icon: Icons.push_pin_rounded,
            color: const Color(0xFFD97706),
            bgColor: const Color(0xFFFEF3C7),
          ),
          const SizedBox(width: 8),
          _buildStatCard(
            title: 'Urgent / High',
            count: '$urgentOrHigh',
            icon: Icons.priority_high_rounded,
            color: const Color(0xFFDC2626),
            bgColor: const Color(0xFFFEE2E2),
          ),
          const SizedBox(width: 8),
          _buildStatCard(
            title: 'With Leads',
            count: '$connectedLeads',
            icon: Icons.link_rounded,
            color: const Color(0xFF10B981),
            bgColor: const Color(0xFFECFDF5),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard({
    required String title,
    required String count,
    required IconData icon,
    required Color color,
    required Color bgColor,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Icon(icon, size: 14, color: color),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                count,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: AppColors.textPrimary,
                ),
              ),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChips(NotesFilterState filter) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _buildChip(
            label: 'All Notes',
            isSelected: !filter.pinnedOnly &&
                filter.priority == 'ALL' &&
                filter.leadConnection == 'ALL',
            onTap: () => ref.read(notesFilterProvider.notifier).reset(),
          ),
          const SizedBox(width: 8),
          _buildChip(
            label: '📌 Pinned',
            isSelected: filter.pinnedOnly,
            onTap: () => ref.read(notesFilterProvider.notifier).togglePinnedOnly(),
          ),
          const SizedBox(width: 8),
          _buildChip(
            label: '🔥 High / Urgent',
            isSelected: filter.priority == 'HIGH' || filter.priority == 'URGENT',
            onTap: () {
              if (filter.priority == 'HIGH' || filter.priority == 'URGENT') {
                ref.read(notesFilterProvider.notifier).setPriority('ALL');
              } else {
                ref.read(notesFilterProvider.notifier).setPriority('HIGH');
              }
            },
          ),
          const SizedBox(width: 8),
          _buildChip(
            label: '🔗 Attached to Lead',
            isSelected: filter.leadConnection == 'WITH_LEAD',
            onTap: () {
              if (filter.leadConnection == 'WITH_LEAD') {
                ref.read(notesFilterProvider.notifier).setLeadConnection('ALL');
              } else {
                ref.read(notesFilterProvider.notifier).setLeadConnection('WITH_LEAD');
              }
            },
          ),
          const SizedBox(width: 8),
          _buildChip(
            label: '📝 Standalone',
            isSelected: filter.leadConnection == 'WITHOUT_LEAD',
            onTap: () {
              if (filter.leadConnection == 'WITHOUT_LEAD') {
                ref.read(notesFilterProvider.notifier).setLeadConnection('ALL');
              } else {
                ref.read(notesFilterProvider.notifier).setLeadConnection('WITHOUT_LEAD');
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildChip({
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.border,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.25),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? Colors.white : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }

  void _openAddNoteDialog(BuildContext context) {
    AddEditNoteDialog.show(context);
  }

  void _openEditNoteDialog(BuildContext context, NoteModel note) {
    AddEditNoteDialog.show(context, existingNote: note);
  }
}
