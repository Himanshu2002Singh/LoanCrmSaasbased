import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/app_drawer.dart';
import 'package:capital_care/core/widgets/status_badge.dart';
import 'package:capital_care/core/widgets/empty_state_view.dart';
import 'package:capital_care/features/auth/models/user_model.dart';
import 'package:capital_care/features/auth/providers/auth_provider.dart';
import 'package:capital_care/features/attendance/models/attendance_model.dart';
import 'package:capital_care/features/attendance/providers/attendance_provider.dart';
import 'package:capital_care/features/attendance/widgets/attendance_calendar_widget.dart';
import 'package:capital_care/features/attendance/widgets/attendance_day_detail_sheet.dart';

class AttendanceScreen extends ConsumerStatefulWidget {
  const AttendanceScreen({super.key});

  @override
  ConsumerState<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends ConsumerState<AttendanceScreen> {
  bool _isCalendarView = true;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkLocation();
      ref.read(attendanceStateProvider.notifier).loadAll();
    });
  }

  void _checkLocation() {
    final user = ref.read(currentUserProvider).value;
    final branch = user?.branch;
    ref.read(attendanceStateProvider.notifier).getCurrentLocation(
      branchLat: branch?.officeLat,
      branchLng: branch?.officeLng,
      allowedRadiusMeters: branch?.geoRadiusMeters.toDouble(),
    );
  }

  Future<void> _handlePunchAction(AttendanceState state) async {
    final user = ref.read(currentUserProvider).value;
    final branch = user?.branch;

    try {
      if (!state.isCheckedIn) {
        await ref.read(attendanceStateProvider.notifier).punchIn(
          branchLat: branch?.officeLat,
          branchLng: branch?.officeLng,
          allowedRadius: branch?.geoRadiusMeters.toDouble(),
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Punch-in successful! Have a great day.'), backgroundColor: AppColors.success),
          );
        }
      } else if (!state.isCheckedOut) {
        // Confirmation alert dialog before closing attendance for the day
        final shouldClose = await _showPunchOutConfirmationDialog(state);
        if (shouldClose != true) {
          return; // Cancelled by user - do not punch out
        }

        await ref.read(attendanceStateProvider.notifier).punchOut(
          branchLat: branch?.officeLat,
          branchLng: branch?.officeLng,
          allowedRadius: branch?.geoRadiusMeters.toDouble(),
        );
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Punch-out successful! Attendance closed for the day.'), backgroundColor: AppColors.success),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Attendance error: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<bool?> _showPunchOutConfirmationDialog(AttendanceState state) {
    final checkInFormatted = state.today?.formattedCheckIn ?? '--:--';

    String durationText = '';
    if (state.today?.checkInTime != null) {
      try {
        final checkInDt = DateTime.parse(state.today!.checkInTime!).toLocal();
        final diff = DateTime.now().difference(checkInDt);
        if (!diff.isNegative) {
          final hours = diff.inHours;
          final mins = diff.inMinutes.remainder(60);
          durationText = '${hours}h ${mins}m';
        }
      } catch (_) {}
    }

    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        backgroundColor: AppColors.surface,
        contentPadding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Icon(Icons.logout_rounded, color: AppColors.error, size: 28),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Close Attendance Today?',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Are you sure you want to punch out and close your workday attendance?',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.cardBorder),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  Column(
                    children: [
                      const Text(
                        'PUNCHED IN AT',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        checkInFormatted,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                  if (durationText.isNotEmpty) ...[
                    Container(height: 24, width: 1, color: AppColors.cardBorder),
                    Column(
                      children: [
                        const Text(
                          'DURATION',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textMuted),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          durationText,
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline_rounded, size: 16, color: AppColors.warning),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Once closed, you cannot punch in again for today.',
                      style: TextStyle(fontSize: 11, color: Color(0xFF92400E), fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        actions: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    side: const BorderSide(color: AppColors.cardBorder),
                    foregroundColor: AppColors.textPrimary,
                  ),
                  onPressed: () => Navigator.of(ctx).pop(false),
                  child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    backgroundColor: AppColors.error,
                    foregroundColor: Colors.white,
                    elevation: 0,
                  ),
                  onPressed: () => Navigator.of(ctx).pop(true),
                  child: const Text('Yes, Close', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(attendanceStateProvider);
    final user = ref.watch(currentUserProvider).value;
    final now = DateTime.now();

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
        title: const Text('My Attendance & Punch'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () {
              ref.read(attendanceStateProvider.notifier).loadAll();
              _checkLocation();
            },
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.primary,
        onRefresh: () async {
          await ref.read(attendanceStateProvider.notifier).loadAll();
          _checkLocation();
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Live Date & Greeting Header
              Center(
                child: Column(
                  children: [
                    Text(
                      DateFormat('EEEE, dd MMMM yyyy').format(now),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      user?.branch?.name != null ? 'Branch: ${user!.branch!.name}' : 'Office Headquarters',
                      style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Punch In / Punch Out Interactive Button Card
              _buildPunchButtonCard(state),
              const SizedBox(height: 20),

              // Geofence & Location indicator
              _buildGeofenceCard(state, user),
              const SizedBox(height: 20),

              // Monthly Summary KPI Row
              const Text(
                'This Month Overview',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 10),
              _buildMonthlySummaryRow(state.summary),
              const SizedBox(height: 24),

              // Attendance History / Calendar Header with Segmented Switcher
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Attendance Log',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.cardBorder),
                    ),
                    child: Row(
                      children: [
                        _buildViewTab(
                          icon: Icons.calendar_month_rounded,
                          label: 'Calendar',
                          isActive: _isCalendarView,
                          onTap: () => setState(() => _isCalendarView = true),
                        ),
                        _buildViewTab(
                          icon: Icons.format_list_bulleted_rounded,
                          label: 'List',
                          isActive: !_isCalendarView,
                          onTap: () => setState(() => _isCalendarView = false),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              // Calendar View or List View
              if (_isCalendarView)
                AttendanceCalendarWidget(
                  selectedMonth: state.selectedMonth,
                  selectedDate: state.selectedDate,
                  recordsMap: state.recordsMap,
                  summary: state.summary,
                  isLoading: state.isLoading,
                  onMonthChanged: (newMonth) {
                    ref.read(attendanceStateProvider.notifier).changeMonth(newMonth);
                  },
                  onDateSelected: (newDate) {
                    ref.read(attendanceStateProvider.notifier).selectDate(newDate);
                  },
                )
              else
                _buildHistorySection(state),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPunchButtonCard(AttendanceState state) {
    final isCheckedIn = state.isCheckedIn;
    final isCheckedOut = state.isCheckedOut;

    Color buttonColor;
    String buttonText;
    IconData buttonIcon;

    if (isCheckedOut) {
      buttonColor = AppColors.textMuted;
      buttonText = 'DAY COMPLETED';
      buttonIcon = Icons.verified_user;
    } else if (isCheckedIn) {
      buttonColor = AppColors.error;
      buttonText = 'PUNCH OUT';
      buttonIcon = Icons.logout;
    } else {
      buttonColor = AppColors.success;
      buttonText = 'PUNCH IN';
      buttonIcon = Icons.fingerprint;
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.cardBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          // Big Circular Punch Button
          GestureDetector(
            onTap: (isCheckedOut || state.isPunching) ? null : () => _handlePunchAction(state),
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: LinearGradient(
                  colors: [
                    buttonColor,
                    buttonColor.withValues(alpha: 0.8),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: buttonColor.withValues(alpha: 0.35),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Center(
                child: state.isPunching
                    ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 3)
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(buttonIcon, color: Colors.white, size: 44),
                          const SizedBox(height: 6),
                          Text(
                            buttonText,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Today's check-in / check-out time indicators
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              Expanded(
                child: _buildTimeItem(
                  label: 'Punch In',
                  time: state.today?.formattedCheckIn ?? '--:--',
                  status: state.today?.status,
                  color: AppColors.success,
                ),
              ),
              Container(width: 1, height: 36, color: AppColors.cardBorder),
              Expanded(
                child: _buildTimeItem(
                  label: 'Punch Out',
                  time: state.today?.formattedCheckOut ?? '--:--',
                  color: AppColors.error,
                ),
              ),
              Container(width: 1, height: 36, color: AppColors.cardBorder),
              Expanded(
                child: _buildTimeItem(
                  label: 'Work Hours',
                  time: state.today != null && state.today!.workingHours > 0
                      ? '${state.today!.workingHours.toStringAsFixed(1)}h'
                      : '--',
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTimeItem({required String label, required String time, String? status, required Color color}) {
    return Column(
      children: [
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
        const SizedBox(height: 4),
        Text(
          time,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        if (status != null)
          Text(
            status,
            style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
      ],
    );
  }

  Widget _buildGeofenceCard(AttendanceState state, UserModel? user) {
    final branch = user?.branch;
    final hasBranchGeo = branch?.officeLat != null && branch?.officeLng != null;
    final isInside = state.isInsideGeofence;
    final dist = state.distanceMeters;
    final pos = state.currentPosition;
    final radius = branch?.geoRadiusMeters ?? 200;

    final Color bgColor = hasBranchGeo
        ? (isInside ? AppColors.successSurface : AppColors.errorSurface)
        : AppColors.surface;
    final Color borderColor = hasBranchGeo
        ? (isInside ? AppColors.success.withValues(alpha: 0.3) : AppColors.error.withValues(alpha: 0.3))
        : AppColors.cardBorder;
    final Color iconColor = hasBranchGeo
        ? (isInside ? AppColors.success : AppColors.error)
        : AppColors.primary;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                hasBranchGeo
                    ? (isInside ? Icons.verified_rounded : Icons.fmd_bad_rounded)
                    : Icons.location_on_rounded,
                color: iconColor,
                size: 22,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      hasBranchGeo
                          ? (isInside
                              ? 'Inside Geofence: ${branch!.name}'
                              : 'Outside Geofence: ${branch!.name}')
                          : 'Branch: ${branch?.name ?? "Office"} (No GPS Limit)',
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: hasBranchGeo
                            ? (isInside ? AppColors.success : AppColors.error)
                            : AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      hasBranchGeo && dist != null
                          ? 'Distance: ${dist.toStringAsFixed(0)}m (Allowed: ${radius}m)'
                          : (pos != null
                              ? 'Live GPS: ${pos.latitude.toStringAsFixed(4)}°, ${pos.longitude.toStringAsFixed(4)}°'
                              : 'Acquiring GPS location...'),
                      style: TextStyle(
                        fontSize: 11,
                        color: hasBranchGeo
                            ? (isInside ? AppColors.success : AppColors.error)
                            : AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.my_location_rounded, size: 20, color: AppColors.primary),
                tooltip: 'Refresh GPS Location',
                onPressed: _checkLocation,
              ),
            ],
          ),
          if (state.error != null) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                state.error!,
                style: const TextStyle(fontSize: 11, color: AppColors.error, fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMonthlySummaryRow(AttendanceSummaryModel summary) {
    return Row(
      children: [
        Expanded(child: _buildSummaryCard('Present', '${summary.presentDays}', AppColors.success)),
        const SizedBox(width: 6),
        Expanded(child: _buildSummaryCard('Late', '${summary.lateDays}', AppColors.warning)),
        const SizedBox(width: 6),
        Expanded(child: _buildSummaryCard('Half Day', '${summary.halfDays}', AppColors.secondary)),
        const SizedBox(width: 6),
        Expanded(child: _buildSummaryCard('Absent', '${summary.absentDays}', AppColors.error)),
      ],
    );
  }

  Widget _buildSummaryCard(String label, String count, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        children: [
          Text(count, style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildHistorySection(AttendanceState state) {
    if (state.history.isEmpty) {
      return const Center(
        child: EmptyStateView(
          icon: Icons.history_toggle_off,
          title: 'No attendance records',
          message: 'Your punch records will appear here',
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: state.history.length,
      itemBuilder: (context, index) {
        final item = state.history[index];
        final isLate = item.isLate;

        return InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => AttendanceDayDetailSheet.show(
            context,
            date: item.parsedDate ?? DateTime.now(),
            record: item,
          ),
          child: Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isLate ? const Color(0xFFFDE68A) : AppColors.cardBorder,
              ),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            item.date,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                          ),
                          if (isLate) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFFFBEB),
                                borderRadius: BorderRadius.circular(4),
                                border: Border.all(color: const Color(0xFFFDE68A)),
                              ),
                              child: const Text(
                                'LATE',
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFFB45309),
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'In: ${item.formattedCheckIn} • Out: ${item.formattedCheckOut}',
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                if (item.workingHours > 0) ...[
                  Text(
                    '${item.workingHours.toStringAsFixed(1)}h',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  ),
                  const SizedBox(width: 8),
                ],
                StatusBadge(
                  status: item.status,
                  fontSize: 10,
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right_rounded, size: 16, color: AppColors.textMuted),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildViewTab({
    required IconData icon,
    required String label,
    required bool isActive,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: isActive ? AppColors.surface : Colors.transparent,
          borderRadius: BorderRadius.circular(7),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.06),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ]
              : null,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              size: 13,
              color: isActive ? AppColors.primary : AppColors.textSecondary,
            ),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                color: isActive ? AppColors.primary : AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
