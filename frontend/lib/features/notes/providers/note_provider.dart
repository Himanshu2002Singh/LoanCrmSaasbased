import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:capital_care/features/notes/models/note_model.dart';
import 'package:capital_care/features/notes/services/note_service.dart';

final noteServiceProvider = Provider<NoteService>((ref) => NoteService());

class NotesFilterState {
  final String search;
  final String priority; // ALL, LOW, NORMAL, HIGH, URGENT
  final String leadConnection; // ALL, WITH_LEAD, WITHOUT_LEAD
  final bool pinnedOnly;

  const NotesFilterState({
    this.search = '',
    this.priority = 'ALL',
    this.leadConnection = 'ALL',
    this.pinnedOnly = false,
  });

  NotesFilterState copyWith({
    String? search,
    String? priority,
    String? leadConnection,
    bool? pinnedOnly,
  }) {
    return NotesFilterState(
      search: search ?? this.search,
      priority: priority ?? this.priority,
      leadConnection: leadConnection ?? this.leadConnection,
      pinnedOnly: pinnedOnly ?? this.pinnedOnly,
    );
  }
}

class NotesFilterNotifier extends StateNotifier<NotesFilterState> {
  NotesFilterNotifier() : super(const NotesFilterState());

  void setSearch(String query) {
    state = state.copyWith(search: query);
  }

  void setPriority(String priority) {
    state = state.copyWith(priority: priority);
  }

  void setLeadConnection(String connection) {
    state = state.copyWith(leadConnection: connection);
  }

  void togglePinnedOnly() {
    state = state.copyWith(pinnedOnly: !state.pinnedOnly);
  }

  void reset() {
    state = const NotesFilterState();
  }
}

final notesFilterProvider =
    StateNotifierProvider<NotesFilterNotifier, NotesFilterState>(
  (ref) => NotesFilterNotifier(),
);

class NotesNotifier extends AsyncNotifier<List<NoteModel>> {
  @override
  Future<List<NoteModel>> build() async {
    return _fetchNotes();
  }

  Future<List<NoteModel>> _fetchNotes() async {
    final service = ref.read(noteServiceProvider);
    return service.getNotes();
  }

  Future<void> refresh() async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() => _fetchNotes());
  }

  Future<NoteModel> createNote({
    required String title,
    required String content,
    String color = 'amber',
    String priority = 'NORMAL',
    bool isPinned = false,
    String? noteDate,
    int? leadId,
  }) async {
    final service = ref.read(noteServiceProvider);
    final newNote = await service.createNote(
      title: title,
      content: content,
      color: color,
      priority: priority,
      isPinned: isPinned,
      noteDate: noteDate,
      leadId: leadId,
    );

    final currentList = state.value ?? [];
    state = AsyncValue.data([newNote, ...currentList]..sort((a, b) {
      if (a.isPinned != b.isPinned) return b.isPinned ? 1 : -1;
      return b.noteDate.compareTo(a.noteDate);
    }));

    return newNote;
  }

  Future<NoteModel> updateNote(
    int id, {
    String? title,
    String? content,
    String? color,
    String? priority,
    bool? isPinned,
    String? noteDate,
    int? leadId,
    bool clearLead = false,
  }) async {
    final service = ref.read(noteServiceProvider);
    final updated = await service.updateNote(
      id,
      title: title,
      content: content,
      color: color,
      priority: priority,
      isPinned: isPinned,
      noteDate: noteDate,
      leadId: leadId,
      clearLead: clearLead,
    );

    final currentList = state.value ?? [];
    final updatedList = currentList.map((n) => n.id == id ? updated : n).toList()
      ..sort((a, b) {
        if (a.isPinned != b.isPinned) return b.isPinned ? 1 : -1;
        return b.noteDate.compareTo(a.noteDate);
      });

    state = AsyncValue.data(updatedList);
    return updated;
  }

  Future<void> togglePin(int id, bool currentPinState) async {
    // Optimistic UI update
    final currentList = state.value ?? [];
    final optimisticList = currentList.map((n) {
      if (n.id == id) {
        return n.copyWith(isPinned: !currentPinState);
      }
      return n;
    }).toList()..sort((a, b) {
      if (a.isPinned != b.isPinned) return b.isPinned ? 1 : -1;
      return b.noteDate.compareTo(a.noteDate);
    });

    state = AsyncValue.data(optimisticList);

    try {
      final service = ref.read(noteServiceProvider);
      final updated = await service.togglePin(id, currentPinState);
      final finalList = (state.value ?? []).map((n) => n.id == id ? updated : n).toList();
      state = AsyncValue.data(finalList);
    } catch (e, st) {
      // Revert if failed
      state = AsyncValue.data(currentList);
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> deleteNote(int id) async {
    final currentList = state.value ?? [];
    state = AsyncValue.data(currentList.where((n) => n.id != id).toList());

    try {
      final service = ref.read(noteServiceProvider);
      await service.deleteNote(id);
    } catch (e, st) {
      // Revert if failed
      state = AsyncValue.data(currentList);
      state = AsyncValue.error(e, st);
    }
  }
}

final notesProvider = AsyncNotifierProvider<NotesNotifier, List<NoteModel>>(
  () => NotesNotifier(),
);

final filteredNotesProvider = Provider<List<NoteModel>>((ref) {
  final notesAsync = ref.watch(notesProvider);
  final filter = ref.watch(notesFilterProvider);

  return notesAsync.maybeWhen(
    data: (notes) {
      return notes.where((n) {
        // 1. Pinned filter
        if (filter.pinnedOnly && !n.isPinned) return false;

        // 2. Priority filter
        if (filter.priority != 'ALL' && n.priority != filter.priority) return false;

        // 3. Lead connection filter
        if (filter.leadConnection == 'WITH_LEAD' && !n.hasLead) return false;
        if (filter.leadConnection == 'WITHOUT_LEAD' && n.hasLead) return false;

        // 4. Search query
        if (filter.search.trim().isNotEmpty) {
          final q = filter.search.toLowerCase().trim();
          final matchTitle = n.title.toLowerCase().contains(q);
          final matchContent = n.content.toLowerCase().contains(q);
          final matchCustomer = n.lead?.customerName.toLowerCase().contains(q) ?? false;
          final matchMobile = n.lead?.customerMobile.contains(q) ?? false;
          final matchLoanType = n.lead?.loanType.toLowerCase().contains(q) ?? false;

          if (!matchTitle && !matchContent && !matchCustomer && !matchMobile && !matchLoanType) {
            return false;
          }
        }

        return true;
      }).toList();
    },
    orElse: () => [],
  );
});

final assignableLeadsProvider =
    FutureProvider.family<List<AssignableLeadModel>, String>((ref, search) async {
  final service = ref.read(noteServiceProvider);
  return service.getMyAssignableLeads(search: search);
});
