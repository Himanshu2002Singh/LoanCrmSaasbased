import 'package:capital_care/core/constants/api_constants.dart';
import 'package:capital_care/core/networking/api_client.dart';
import 'package:capital_care/features/notes/models/note_model.dart';

class NoteService {
  Future<List<NoteModel>> getNotes({
    String? search,
    String? priority,
    bool? isPinned,
    int? leadId,
    String? date,
  }) async {
    final query = <String, dynamic>{};

    if (search != null && search.trim().isNotEmpty) {
      query['search'] = search.trim();
    }
    if (priority != null && priority != 'ALL') {
      query['priority'] = priority.toUpperCase();
    }
    if (isPinned != null) {
      query['isPinned'] = isPinned.toString();
    }
    if (leadId != null && leadId > 0) {
      query['leadId'] = leadId.toString();
    }
    if (date != null && date.trim().isNotEmpty) {
      query['date'] = date.trim();
    }

    final response = await ApiClient.get(
      ApiConstants.notes,
      queryParameters: query,
    );

    final rawList = response['data'] ?? (response is List ? response : []);
    if (rawList is List) {
      return rawList
          .map((e) => NoteModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  Future<List<AssignableLeadModel>> getMyAssignableLeads({String? search}) async {
    final query = <String, dynamic>{'limit': '150'};
    if (search != null && search.trim().isNotEmpty) {
      query['search'] = search.trim();
    }

    final response = await ApiClient.get(
      ApiConstants.noteAssignableLeads,
      queryParameters: query,
    );

    final rawList = response['data'] ?? (response is List ? response : []);
    if (rawList is List) {
      return rawList
          .map((e) => AssignableLeadModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
    return [];
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
    final payload = {
      'title': title.trim(),
      'content': content.trim(),
      'color': color,
      'priority': priority.toUpperCase(),
      'isPinned': isPinned,
      'noteDate': noteDate ?? DateTime.now().toIso8601String().split('T')[0],
      if (leadId != null && leadId > 0) 'leadId': leadId,
    };

    final response = await ApiClient.post(
      ApiConstants.notes,
      body: payload,
    );

    final data = response['data'] ?? response;
    return NoteModel.fromJson(data as Map<String, dynamic>);
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
    final payload = <String, dynamic>{};
    if (title != null) payload['title'] = title.trim();
    if (content != null) payload['content'] = content.trim();
    if (color != null) payload['color'] = color;
    if (priority != null) payload['priority'] = priority.toUpperCase();
    if (isPinned != null) payload['isPinned'] = isPinned;
    if (noteDate != null) payload['noteDate'] = noteDate;
    if (clearLead) {
      payload['leadId'] = null;
    } else if (leadId != null) {
      payload['leadId'] = leadId;
    }

    final response = await ApiClient.put(
      '${ApiConstants.notes}/$id',
      body: payload,
    );

    final data = response['data'] ?? response;
    return NoteModel.fromJson(data as Map<String, dynamic>);
  }

  Future<void> deleteNote(int id) async {
    await ApiClient.delete('${ApiConstants.notes}/$id');
  }

  Future<NoteModel> togglePin(int id, bool currentPin) async {
    return updateNote(id, isPinned: !currentPin);
  }
}
