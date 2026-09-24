import 'dart:convert';
import 'package:capital_care/constants/server_url.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:table_calendar/table_calendar.dart';

class MyAttendanceScreen extends StatefulWidget {
  const MyAttendanceScreen({super.key});

  @override
  State<MyAttendanceScreen> createState() => _MyAttendanceScreenState();
}

class _MyAttendanceScreenState extends State<MyAttendanceScreen> {
  Map<DateTime, String> attendanceData = {};
  Map<DateTime, AttendanceEntry> attendanceEntries = {};
  DateTime _focusedDay = DateTime.now();
  DateTime? _selectedDay;
  int fullDayCount = 0;
  int lateDayCount = 0;
  String? fetchError;

  @override
  void initState() {
    super.initState();
    fetchAndSetAttendance();
  }

  void fetchAndSetAttendance() async {
    final fetchedData = await fetchAttendanceData();

    setState(() {
      attendanceData = fetchedData;
    });

    _updateCountsForMonth(_focusedDay); // Update counts for initial month
  }

  Future<Map<DateTime, String>> fetchAttendanceData() async {
    try {
      final storage = FlutterSecureStorage();
      final token = await storage.read(key: "auth_token");

      final response = await http.get(
        Uri.parse('${ServerUrl}/myattendance'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['success'] == true) {
          final attendance = data['data'];
          Map<DateTime, String> processedData = {};

          for (var item in attendance) {
            DateTime date = DateTime.parse(item['date']);
            if (date.isUtc) date = date.toLocal();
            date = DateTime(date.year, date.month, date.day);
            processedData[date] =
                item['isLate'] == true
                    ? 'Late'
                    : 'Full Day'; // Normalize status to 'Late' or 'Full Day'
            attendanceEntries[date] = AttendanceEntry(
              startTime: item['startTime'],
              endTime: item['endTime'],
            );
          }

          return processedData;
        } else {
          throw Exception('Attendance data not successful');
        }
      } else {
        throw Exception(
          'Failed to fetch attendance with status ${response.statusCode}',
        );
      }
    } catch (e) {
      print('Error fetching attendance: $e');
      setState(() {
        fetchError = 'Failed to load attendance data.';
      });
      return {};
    }
  }

  void _updateCountsForMonth(DateTime month) {
    int full = 0;
    int late = 0;

    attendanceData.forEach((date, status) {
      if (date.year == month.year && date.month == month.month) {
        final statusNormalized = status.trim().toLowerCase();
        if (statusNormalized == 'full day') {
          full++;
        } else if (statusNormalized == 'late') {
          late++;
        }
      }
    });

    setState(() {
      fullDayCount = full;
      lateDayCount = late;
    });
  }

  Color _getStatusColor(String status) {
    switch (status.trim().toLowerCase()) {
      case 'full day':
        return Colors.green.withOpacity(0.7);
      case 'late':
        return Colors.yellow.withOpacity(0.7);
      default:
        return Colors.transparent;
    }
  }

  List<String> _getEventsForDay(DateTime day) {
    final normalized = DateTime(day.year, day.month, day.day);
    return attendanceData[normalized] != null
        ? [attendanceData[normalized]!]
        : [];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Attendance')),
      body:
          fetchError != null
              ? Center(
                child: Text(
                  fetchError!,
                  style: const TextStyle(color: Colors.red),
                ),
              )
              : SafeArea(
                child: Column(
                  children: [
                    TableCalendar(
                      firstDay: DateTime(2024),
                      lastDay: DateTime(2030),
                      focusedDay: _focusedDay,
                      headerStyle: const HeaderStyle(
                        formatButtonVisible: false,
                        titleCentered: true,
                      ),
                      selectedDayPredicate:
                          (day) => isSameDay(_selectedDay, day),
                      onDaySelected: (selectedDay, focusedDay) {
                        setState(() {
                          _selectedDay = selectedDay;
                          _focusedDay = focusedDay;
                        });
                        _showAttendanceDetailsModal(selectedDay);
                      },
                      onPageChanged: (focusedDay) {
                        setState(() {
                          _focusedDay = focusedDay;
                        });
                        _updateCountsForMonth(focusedDay);
                      },
                      calendarStyle: const CalendarStyle(
                        todayDecoration: BoxDecoration(
                          color: Colors.blue,
                          shape: BoxShape.circle,
                        ),
                        weekendTextStyle: TextStyle(color: Colors.red),
                      ),
                      eventLoader: _getEventsForDay,
                      calendarBuilders: CalendarBuilders(
                        defaultBuilder: (context, day, focusedDay) {
                          List<String> events = _getEventsForDay(day);
                          if (events.isNotEmpty) {
                            return _buildEventDay(day, events.first);
                          }
                          return null;
                        },
                        todayBuilder: (context, day, focusedDay) {
                          List<String> events = _getEventsForDay(day);
                          return _buildEventDay(
                            day,
                            events.isNotEmpty ? events.first : 'today',
                            overrideColor: Colors.blue.withOpacity(0.7),
                            border: true,
                          );
                        },
                        selectedBuilder: (context, day, focusedDay) {
                          List<String> events = _getEventsForDay(day);
                          return _buildEventDay(
                            day,
                            events.isNotEmpty ? events.first : '',
                            overrideColor: Colors.blue.withOpacity(0.3),
                            border: true,
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 16),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16.0),
                      child: Card(
                        elevation: 3,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Column(
                            children: [
                              _buildSummaryRow(
                                "Total Attendance",
                                fullDayCount + lateDayCount,
                              ),
                              _buildSummaryRow("Full Attendance", fullDayCount),
                              _buildSummaryRow("Late Attendance", lateDayCount),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const Spacer(),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16.0,
                        vertical: 20,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: const [
                          InfoRow(color: Colors.yellow, label: 'Late'),
                          InfoRow(color: Colors.green, label: 'Full day'),
                          InfoRow(color: Colors.blue, label: 'Current Day'),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
    );
  }

  Widget _buildEventDay(
    DateTime day,
    String status, {
    Color? overrideColor,
    bool border = false,
  }) {
    return Container(
      margin: const EdgeInsets.all(4.0),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: overrideColor ?? _getStatusColor(status),
        shape: BoxShape.circle,
        border: border ? Border.all(color: Colors.blue, width: 2) : null,
      ),
      child: Text(
        '${day.day}',
        style: const TextStyle(
          color: Colors.black,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String title, int value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: const TextStyle(fontSize: 16)),
          Text('$value', style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  void _showAttendanceDetailsModal(DateTime selectedDate) {
    final status =
        attendanceData[DateTime(
          selectedDate.year,
          selectedDate.month,
          selectedDate.day,
        )];
    final entry =
        attendanceEntries[DateTime(
          selectedDate.year,
          selectedDate.month,
          selectedDate.day,
        )];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.4,
          minChildSize: 0.3,
          maxChildSize: 0.6,
          expand: false,
          builder: (context, scrollController) {
            return Container(
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(25)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black26,
                    blurRadius: 10,
                    spreadRadius: 2,
                  ),
                ],
              ),
              padding: const EdgeInsets.all(20),
              child: SingleChildScrollView(
                controller: scrollController,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Center(
                      child: Container(
                        width: 50,
                        height: 6,
                        margin: const EdgeInsets.only(bottom: 20),
                        decoration: BoxDecoration(
                          color: Colors.grey[400],
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),

                    // Header Section
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        vertical: 12,
                        horizontal: 16,
                      ),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            Colors.deepPurpleAccent,
                            Colors.purpleAccent,
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.access_time, color: Colors.white),
                          const SizedBox(width: 10),
                          Text(
                            "Attendance Details",
                            style: Theme.of(
                              context,
                            ).textTheme.titleMedium?.copyWith(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    _buildInfoRow(
                      "📅 Date",
                      "${selectedDate.toLocal().toIso8601String().substring(0, 10)}",
                    ),
                    const Divider(height: 24),
                    _buildInfoRow(
                      "📌 Status",
                      status ?? "Not Found",
                      color:
                          status == "Late"
                              ? Colors.orange
                              : status == "Full Day"
                              ? Colors.green
                              : Colors.red,
                    ),
                    const Divider(height: 24),
                    _buildInfoRow(
                      "🕒 Start Time",
                      _formatTime(entry?.startTime) ?? "--",
                    ),
                    _buildInfoRow(
                      "🏁 End Time",
                      _formatTime(entry?.endTime) ?? "--",
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildInfoRow(String label, String value, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Text(
            "$label: ",
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(fontSize: 16, color: color ?? Colors.black87),
            ),
          ),
        ],
      ),
    );
  }
}

class InfoRow extends StatelessWidget {
  final Color color;
  final String label;

  const InfoRow({super.key, required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 16,
          height: 16,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6.0),
        Text(label, style: const TextStyle(fontSize: 14)),
      ],
    );
  }
}

class AttendanceEntry {
  final String? startTime;
  final String? endTime;

  AttendanceEntry({this.startTime, this.endTime});
}

String _formatTime(String? isoTime) {
  if (isoTime == null || isoTime.isEmpty) return '--';

  try {
    final dateTime = DateTime.parse(isoTime).toLocal();
    return DateFormat.jm().format(dateTime); // Example: 10:09 AM
  } catch (e) {
    return 'Invalid Time';
  }
}
