import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:intl/intl.dart';
import 'package:capital_care/features/attendance/models/attendance_model.dart';
import 'package:capital_care/features/attendance/services/attendance_service.dart';

final attendanceServiceProvider = Provider<AttendanceService>((ref) {
  return AttendanceService();
});

class AttendanceState {
  final AttendanceModel? today;
  final List<AttendanceModel> history;
  final AttendanceSummaryModel summary;
  final bool isLoading;
  final bool isPunching;
  final String? error;
  final Position? currentPosition;
  final double? distanceMeters;
  final bool isInsideGeofence;
  final DateTime selectedMonth;
  final DateTime selectedDate;

  AttendanceState({
    this.today,
    this.history = const [],
    required this.summary,
    this.isLoading = false,
    this.isPunching = false,
    this.error,
    this.currentPosition,
    this.distanceMeters,
    this.isInsideGeofence = true,
    DateTime? selectedMonth,
    DateTime? selectedDate,
  })  : selectedMonth = selectedMonth ?? DateTime(DateTime.now().year, DateTime.now().month, 1),
        selectedDate = selectedDate ?? DateTime.now();

  bool get isCheckedIn => today != null && today!.checkInTime != null;
  bool get isCheckedOut => today != null && today!.checkOutTime != null;

  Map<String, AttendanceModel> get recordsMap {
    final map = <String, AttendanceModel>{};
    for (final item in history) {
      if (item.date.isNotEmpty) {
        map[item.date] = item;
      }
    }
    if (today != null && today!.date.isNotEmpty) {
      map[today!.date] = today!;
    }
    return map;
  }

  AttendanceModel? get selectedRecord {
    final key = DateFormat('yyyy-MM-dd').format(selectedDate);
    return recordsMap[key];
  }

  AttendanceState copyWith({
    AttendanceModel? today,
    List<AttendanceModel>? history,
    AttendanceSummaryModel? summary,
    bool? isLoading,
    bool? isPunching,
    String? error,
    Position? currentPosition,
    double? distanceMeters,
    bool? isInsideGeofence,
    DateTime? selectedMonth,
    DateTime? selectedDate,
    bool clearToday = false,
  }) {
    return AttendanceState(
      today: clearToday ? null : (today ?? this.today),
      history: history ?? this.history,
      summary: summary ?? this.summary,
      isLoading: isLoading ?? this.isLoading,
      isPunching: isPunching ?? this.isPunching,
      error: error,
      currentPosition: currentPosition ?? this.currentPosition,
      distanceMeters: distanceMeters ?? this.distanceMeters,
      isInsideGeofence: isInsideGeofence ?? this.isInsideGeofence,
      selectedMonth: selectedMonth ?? this.selectedMonth,
      selectedDate: selectedDate ?? this.selectedDate,
    );
  }
}

class AttendanceNotifier extends StateNotifier<AttendanceState> {
  final AttendanceService _service;

  AttendanceNotifier(this._service) : super(AttendanceState(summary: AttendanceSummaryModel())) {
    loadAll();
  }

  Future<void> loadAll({DateTime? month}) async {
    state = state.copyWith(isLoading: true, error: null);
    final targetMonth = month ?? state.selectedMonth;
    final monthStr = DateFormat('yyyy-MM').format(targetMonth);
    try {
      final today = await _service.getTodayStatus();
      final summary = await _service.getAttendanceSummary(month: monthStr);
      final history = await _service.getAttendanceHistory(month: monthStr, limit: 60);
      state = state.copyWith(
        today: today,
        summary: summary,
        history: history,
        selectedMonth: DateTime(targetMonth.year, targetMonth.month, 1),
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void selectDate(DateTime date) {
    state = state.copyWith(selectedDate: date);
  }

  Future<void> changeMonth(DateTime newMonth) async {
    final monthNormalized = DateTime(newMonth.year, newMonth.month, 1);
    state = state.copyWith(
      selectedMonth: monthNormalized,
      isLoading: true,
      error: null,
    );
    final monthStr = DateFormat('yyyy-MM').format(monthNormalized);
    try {
      final summary = await _service.getAttendanceSummary(month: monthStr);
      final history = await _service.getAttendanceHistory(month: monthStr, limit: 60);
      state = state.copyWith(
        summary: summary,
        history: history,
        isLoading: false,
      );
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<Position?> getCurrentLocation({
    double? branchLat,
    double? branchLng,
    double? allowedRadiusMeters,
  }) async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        state = state.copyWith(error: 'Location services (GPS) are disabled on your device. Please turn on GPS in settings.');
        return null;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          state = state.copyWith(error: 'Location permissions are denied. Please allow location access.');
          return null;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        state = state.copyWith(error: 'Location permissions are permanently denied. Please enable them in app settings.');
        return null;
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );

      double? dist;
      bool inside = true;
      if (branchLat != null && branchLng != null) {
        dist = Geolocator.distanceBetween(
          position.latitude,
          position.longitude,
          branchLat,
          branchLng,
        );
        final radius = allowedRadiusMeters ?? 200;
        inside = dist <= radius;
      }

      state = state.copyWith(
        currentPosition: position,
        distanceMeters: dist,
        isInsideGeofence: inside,
        error: null,
      );

      return position;
    } catch (e) {
      state = state.copyWith(error: 'Failed to obtain GPS location: $e');
      return null;
    }
  }

  Future<void> punchIn({double? branchLat, double? branchLng, double? allowedRadius}) async {
    state = state.copyWith(isPunching: true, error: null);
    try {
      final pos = await getCurrentLocation(
        branchLat: branchLat,
        branchLng: branchLng,
        allowedRadiusMeters: allowedRadius,
      );

      if (pos == null) {
        throw Exception(state.error ?? 'Could not acquire GPS position. Please turn on GPS and grant location permission.');
      }

      final lat = pos.latitude;
      final lng = pos.longitude;

      if (branchLat != null && branchLng != null) {
        final dist = Geolocator.distanceBetween(lat, lng, branchLat, branchLng);
        final radius = allowedRadius ?? 200;
        if (dist > radius) {
          throw Exception('You are ${dist.toStringAsFixed(0)}m away from branch premises. Allowed radius is ${radius.toStringAsFixed(0)}m.');
        }
      }

      final updatedToday = await _service.checkIn(lat: lat, lng: lng);
      state = state.copyWith(today: updatedToday, isPunching: false);
      loadAll();
    } catch (e) {
      state = state.copyWith(isPunching: false, error: e.toString());
      rethrow;
    }
  }

  Future<void> punchOut({double? branchLat, double? branchLng, double? allowedRadius}) async {
    state = state.copyWith(isPunching: true, error: null);
    try {
      final pos = await getCurrentLocation(
        branchLat: branchLat,
        branchLng: branchLng,
        allowedRadiusMeters: allowedRadius,
      );

      if (pos == null) {
        throw Exception(state.error ?? 'Could not acquire GPS position. Please turn on GPS and grant location permission.');
      }

      final lat = pos.latitude;
      final lng = pos.longitude;

      final updatedToday = await _service.checkOut(lat: lat, lng: lng);
      state = state.copyWith(today: updatedToday, isPunching: false);
      loadAll();
    } catch (e) {
      state = state.copyWith(isPunching: false, error: e.toString());
      rethrow;
    }
  }
}

final attendanceStateProvider = StateNotifierProvider<AttendanceNotifier, AttendanceState>((ref) {
  final service = ref.watch(attendanceServiceProvider);
  return AttendanceNotifier(service);
});
