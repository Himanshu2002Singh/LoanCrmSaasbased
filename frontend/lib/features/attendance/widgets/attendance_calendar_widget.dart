import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/status_badge.dart';
import 'package:capital_care/features/attendance/models/attendance_model.dart';
import 'package:capital_care/features/attendance/widgets/attendance_day_detail_sheet.dart';

class AttendanceCalendarWidget extends StatelessWidget {
  final DateTime selectedMonth;
  final DateTime selectedDate;
  final Map<String, AttendanceModel> recordsMap;
  final AttendanceSummaryModel summary;
  final bool isLoading;
  final ValueChanged<DateTime> onMonthChanged;
  final ValueChanged<DateTime> onDateSelected;

  const AttendanceCalendarWidget({
    super.key,
    required this.selectedMonth,
    required this.selectedDate,
    required this.recordsMap,
    required this.summary,
    this.isLoading = false,
    required this.onMonthChanged,
    required this.onDateSelected,
  });

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final isCurrentMonth = selectedMonth.year == now.year && selectedMonth.month == now.month;

    return Container(
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
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 1. Month Switcher Header
          _buildMonthHeader(isCurrentMonth, now),
          const SizedBox(height: 12),

          // 2. Monthly Summary Pill Strip
          _buildSummaryStrip(),
          const SizedBox(height: 16),

          // 3. Calendar Grid (Weekdays + Days)
          if (isLoading)
            const SizedBox(
              height: 240,
              child: Center(
                child: CircularProgressIndicator(color: AppColors.primary, strokeWidth: 2.5),
              ),
            )
          else ...[
            _buildWeekdaysHeader(),
            const SizedBox(height: 8),
            _buildDaysGrid(now),
          ],

          const SizedBox(height: 18),
          const Divider(height: 1, color: AppColors.cardBorder),
          const SizedBox(height: 16),

          // 4. Selected Day Interactive Detail Preview
          _buildSelectedDayDetail(context),
        ],
      ),
    );
  }

  Widget _buildMonthHeader(bool isCurrentMonth, DateTime now) {
    return Row(
      children: [
        // Previous Month Button
        IconButton(
          icon: const Icon(Icons.chevron_left_rounded, size: 28),
          color: AppColors.textPrimary,
          tooltip: 'Previous Month',
          onPressed: () {
            final prev = DateTime(selectedMonth.year, selectedMonth.month - 1, 1);
            onMonthChanged(prev);
          },
        ),

        // Month Title & Quick Return to Today
        Expanded(
          child: InkWell(
            borderRadius: BorderRadius.circular(8),
            onTap: isCurrentMonth
                ? null
                : () => onMonthChanged(DateTime(now.year, now.month, 1)),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.calendar_month_rounded, size: 18, color: AppColors.primary),
                const SizedBox(width: 8),
                Text(
                  DateFormat('MMMM yyyy').format(selectedMonth),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
                if (!isCurrentMonth) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'Today',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),

        // Next Month Button
        IconButton(
          icon: const Icon(Icons.chevron_right_rounded, size: 28),
          color: isCurrentMonth ? AppColors.textMuted : AppColors.textPrimary,
          tooltip: 'Next Month',
          onPressed: isCurrentMonth
              ? null
              : () {
                  final next = DateTime(selectedMonth.year, selectedMonth.month + 1, 1);
                  onMonthChanged(next);
                },
        ),
      ],
    );
  }

  Widget _buildSummaryStrip() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildMiniStat('Present', '${summary.presentDays}', AppColors.success),
          _buildMiniDivider(),
          _buildMiniStat('Late', '${summary.lateDays}', AppColors.warning),
          _buildMiniDivider(),
          _buildMiniStat('Half Day', '${summary.halfDays}', AppColors.secondary),
          _buildMiniDivider(),
          _buildMiniStat('Absent', '${summary.absentDays}', AppColors.error),
          if (summary.totalWorkingHours > 0) ...[
            _buildMiniDivider(),
            _buildMiniStat('Hours', '${summary.totalWorkingHours.toStringAsFixed(0)}h', AppColors.primary),
          ],
        ],
      ),
    );
  }

  Widget _buildMiniStat(String label, String value, Color color) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color),
        ),
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
        ),
      ],
    );
  }

  Widget _buildMiniDivider() {
    return Container(
      height: 18,
      width: 1,
      color: AppColors.cardBorder,
    );
  }

  Widget _buildWeekdaysHeader() {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return Row(
      children: days.map((day) {
        final isSunday = day == 'Sun';
        return Expanded(
          child: Center(
            child: Text(
              day,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: isSunday ? AppColors.error.withValues(alpha: 0.8) : AppColors.textMuted,
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildDaysGrid(DateTime now) {
    final year = selectedMonth.year;
    final month = selectedMonth.month;

    final firstDayOfMonth = DateTime(year, month, 1);
    final daysInMonth = DateTime(year, month + 1, 0).day;

    // Monday is 1, Sunday is 7 in Dart DateTime
    final startingWeekday = firstDayOfMonth.weekday; // 1 to 7

    final totalCells = ((startingWeekday - 1 + daysInMonth) / 7).ceil() * 7;
    final prevMonthDays = DateTime(year, month, 0).day;

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: totalCells,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 7,
        childAspectRatio: 1.0,
        mainAxisSpacing: 4,
        crossAxisSpacing: 4,
      ),
      itemBuilder: (context, index) {
        DateTime cellDate;
        bool isCurrentMonthDay = true;

        if (index < startingWeekday - 1) {
          // Preceding month trailing days
          final dayNum = prevMonthDays - (startingWeekday - 2 - index);
          cellDate = DateTime(year, month - 1, dayNum);
          isCurrentMonthDay = false;
        } else if (index >= startingWeekday - 1 + daysInMonth) {
          // Succeeding month leading days
          final dayNum = index - (startingWeekday - 1 + daysInMonth) + 1;
          cellDate = DateTime(year, month + 1, dayNum);
          isCurrentMonthDay = false;
        } else {
          // Current month days
          final dayNum = index - (startingWeekday - 1) + 1;
          cellDate = DateTime(year, month, dayNum);
        }

        final isSelected = cellDate.year == selectedDate.year &&
            cellDate.month == selectedDate.month &&
            cellDate.day == selectedDate.day;

        final isToday = cellDate.year == now.year &&
            cellDate.month == now.month &&
            cellDate.day == now.day;

        final isSunday = cellDate.weekday == DateTime.sunday;
        final isFuture = cellDate.isAfter(now);

        final dateKey = DateFormat('yyyy-MM-dd').format(cellDate);
        final record = recordsMap[dateKey];

        return _buildDateCell(
          cellDate: cellDate,
          isCurrentMonthDay: isCurrentMonthDay,
          isSelected: isSelected,
          isToday: isToday,
          isSunday: isSunday,
          isFuture: isFuture,
          record: record,
        );
      },
    );
  }

  Widget _buildDateCell({
    required DateTime cellDate,
    required bool isCurrentMonthDay,
    required bool isSelected,
    required bool isToday,
    required bool isSunday,
    required bool isFuture,
    AttendanceModel? record,
  }) {
    Color? dotColor;
    if (record != null) {
      if (record.isLate) {
        dotColor = AppColors.warning;
      } else if (record.isHalfDay) {
        dotColor = AppColors.secondary;
      } else if (record.isAbsent) {
        dotColor = AppColors.error;
      } else {
        dotColor = AppColors.success;
      }
    } else if (isCurrentMonthDay && !isFuture && !isSunday) {
      // Past workday with no check-in record
      dotColor = AppColors.error.withValues(alpha: 0.35);
    }

    Color cellTextColor;
    if (!isCurrentMonthDay) {
      cellTextColor = AppColors.textMuted.withValues(alpha: 0.4);
    } else if (isSelected) {
      cellTextColor = Colors.white;
    } else if (isToday) {
      cellTextColor = AppColors.primary;
    } else if (isSunday) {
      cellTextColor = AppColors.error.withValues(alpha: 0.65);
    } else {
      cellTextColor = AppColors.textPrimary;
    }

    return GestureDetector(
      onTap: () => onDateSelected(cellDate),
      child: Container(
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary
              : (isToday ? AppColors.primary.withValues(alpha: 0.08) : Colors.transparent),
          borderRadius: BorderRadius.circular(10),
          border: isToday && !isSelected
              ? Border.all(color: AppColors.primary, width: 1.5)
              : (record?.isLate == true && !isSelected
                  ? Border.all(color: AppColors.warning.withValues(alpha: 0.5), width: 1)
                  : null),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '${cellDate.day}',
              style: TextStyle(
                fontSize: 13,
                fontWeight: isSelected || isToday ? FontWeight.bold : FontWeight.w500,
                color: cellTextColor,
              ),
            ),
            const SizedBox(height: 2),
            if (dotColor != null)
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: isSelected ? Colors.white : dotColor,
                  shape: BoxShape.circle,
                ),
              )
            else
              const SizedBox(height: 6),
          ],
        ),
      ),
    );
  }

  Widget _buildSelectedDayDetail(BuildContext context) {
    final dateKey = DateFormat('yyyy-MM-dd').format(selectedDate);
    final record = recordsMap[dateKey];
    final isSunday = selectedDate.weekday == DateTime.sunday;
    final isFuture = selectedDate.isAfter(DateTime.now());
    final isLate = record?.isLate ?? false;

    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => AttendanceDayDetailSheet.show(context, date: selectedDate, record: record),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.cardBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Top Row: Date & Status Badge
            Row(
              children: [
                const Icon(Icons.event_note_rounded, size: 18, color: AppColors.primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    DateFormat('EEEE, dd MMM yyyy').format(selectedDate),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                ),
                if (record != null)
                  StatusBadge(status: record.status, fontSize: 11)
                else if (isSunday)
                  const Text('Weekly Off', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary))
                else if (isFuture)
                  const Text('Upcoming', style: TextStyle(fontSize: 12, color: AppColors.textMuted))
                else
                  const Text('Absent / No Punch', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.error)),
                const SizedBox(width: 4),
                const Icon(Icons.chevron_right_rounded, size: 18, color: AppColors.textMuted),
              ],
            ),

            // Late Warning Banner (if Late)
            if (isLate) ...[
              const SizedBox(height: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning_amber_rounded, size: 16, color: AppColors.warning),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Marked Late: Checked in at ${record!.formattedCheckIn}',
                        style: const TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF92400E),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],

            const SizedBox(height: 12),

            // Timings & Working Hours Row
            if (record != null)
              Row(
                children: [
                  Expanded(
                    child: _buildPunchChip(
                      icon: Icons.login_rounded,
                      label: 'Punch In',
                      time: record.formattedCheckIn,
                      color: isLate ? AppColors.warning : AppColors.success,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildPunchChip(
                      icon: Icons.logout_rounded,
                      label: 'Punch Out',
                      time: record.formattedCheckOut,
                      color: record.checkOutTime != null ? AppColors.error : AppColors.textMuted,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildPunchChip(
                      icon: Icons.timer_outlined,
                      label: 'Duration',
                      time: record.formattedWorkingDuration,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              )
            else
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Text(
                  isSunday
                      ? 'No attendance required on Sunday (Weekly Off).'
                      : (isFuture
                          ? 'This date is in the future.'
                          : 'No check-in or check-out recorded for this date.'),
                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildPunchChip({
    required IconData icon,
    required String label,
    required String time,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 12, color: color),
              const SizedBox(width: 4),
              Text(
                label,
                style: const TextStyle(fontSize: 9, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            time,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
