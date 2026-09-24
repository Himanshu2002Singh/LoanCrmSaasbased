import 'package:capital_care/controllers/providers/userprovider.dart';
import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/screens/attendance_screen.dart';
import 'package:capital_care/views/screens/auto_call_dashboard_screen.dart';
import 'package:capital_care/views/screens/call_logs_screen.dart';
import 'package:capital_care/views/screens/contacts_page.dart';
import 'package:capital_care/views/screens/dashboard/dashboard_screen.dart';
import 'package:capital_care/views/screens/leads/fresh_leads.dart';
import 'package:capital_care/views/screens/leads/leads_screen.dart';
import 'package:capital_care/views/screens/login_screen.dart';
import 'package:capital_care/views/screens/my_attendance_screen.dart';
import 'package:capital_care/views/screens/profile_screen.dart';
import 'package:capital_care/views/screens/task/task_assigned_by_me.dart';
import 'package:capital_care/views/screens/task_management/task_management_screen.dart';
import 'package:capital_care/views/widgets/custom_appbar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';

class AppScaffold extends StatelessWidget {
  final appBar;
  final Widget body;
  final floatingActionButtonIcon;
  final floatingActionButtonOnTap;
  final isFloatingActionButton;
  final backgroundColor;

  const AppScaffold({
    super.key,
    required this.appBar,
    required this.body,
    this.floatingActionButtonIcon,
    this.floatingActionButtonOnTap,
    required this.isFloatingActionButton,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: backgroundColor,
      appBar: appBar,
      drawer: _homeDrawer(context),
      body: body,

      floatingActionButton:
          isFloatingActionButton
              ? FloatingActionButton(
                backgroundColor: AppColors.primaryColor,
                foregroundColor: AppColors.appBarForegroundColor,
                onPressed: () {
                  floatingActionButtonOnTap();
                },
                child: floatingActionButtonIcon,
              )
              : null,
    );
  }

  Widget _homeDrawer(BuildContext context) {
    final user = Provider.of<UserProvider>(context, listen: false).user;

    return Drawer(
      child: ListView(
        padding: EdgeInsets.zero,
        children: <Widget>[
          DrawerHeader(
            decoration: BoxDecoration(color: AppColors.primaryColor),
            child: GestureDetector(
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => EmployeeProfilePage(),
                  ),
                );
              },
              child: Column(
                children: [
                  SizedBox(height: 10),
                  CircleAvatar(radius: 45, child: Text("U")),
                  SizedBox(height: 5),
                  Text(
                    user?.ename ?? "User",
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
          ...[
            _drawerItem(
              Icons.dashboard,
              "Dashboard",
              onTap:
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => DashboardScreen()),
                  ),
            ),
            _drawerItem(
              Icons.present_to_all_outlined,
              "Attendance",
              onTap:
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => Attendancescreen()),
                  ),
            ),
            // _drawerItem(
            //   Icons.phone_in_talk_rounded,
            //   "AutoCall Dashboard",
            //   onTap:
            //       () => Navigator.push(
            //         context,
            //         MaterialPageRoute(
            //           builder: (context) => AutoCallDashboard(),
            //         ),
            //       ),
            // ),
            _drawerItem(
              Icons.man,
              "Leads",
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => LeadsScreen()),
                );
              },
            ),
            _drawerItem(
              Icons.man_3,
              "Fresh Leads",
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => FreshLeads()),
                );
              },
            ),
            _drawerItem(
              Icons.history,
              "Call Logs",
              section: "Tracking",
              onTap:
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => CallLogsScreen()),
                  ),
            ),
            _drawerItem(
              Icons.calendar_month,
              "My Attendance",
              onTap:
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => MyAttendanceScreen(),
                    ),
                  ),
            ),
            _drawerItem(
              Icons.add_to_photos,
              "Add Task",
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => TasksAssignedByMeScreen(),
                  ),
                );
              },
            ),

            // _drawerItem(
            //   Icons.note,
            //   "Task Management",
            //   onTap:
            //       () => Navigator.push(
            //         context,
            //         MaterialPageRoute(
            //           builder: (context) => TaskManagementScreen(),
            //         ),
            //       ),
            // ),

            // _drawerItem(
            //   Icons.error_outline,
            //   "Performance Report",
            //   section: "Custom Menu",
            // ),
            _drawerItem(
              Icons.person,
              "Profile",
              section: "Custom Menu",
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => EmployeeProfilePage(),
                  ),
                );
              },
            ),
            _drawerItem(
              Icons.contacts,
              "My Contacts",
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => ContactsPage()),
                );
              },
            ),

            // _drawerItem(
            //   Icons.view_headline,
            //   "Create CheckList",
            //   section: "Check List",
            // ),
            // _drawerItem(Icons.playlist_add, "Fill CheckList"),
            // _drawerItem(Icons.playlist_add_check, "CheckList Report"),
            _drawerItem(Icons.security, "App Permission", section: "Policies"),
            _drawerItem(Icons.private_connectivity, "Privacy Policy"),
            _drawerItem(Icons.settings, "Settings"),
            _drawerItem(
              Icons.arrow_circle_left_outlined,
              "Sign Out",
              onTap: () async {
                final FlutterSecureStorage _secureStorage =
                    FlutterSecureStorage();

                await _secureStorage.deleteAll();

                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(builder: (context) => const LoginScreen()),
                  (Route<dynamic> route) => false,
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  Widget _drawerItem(
    IconData icon,
    String title, {
    String? section,
    VoidCallback? onTap,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (section != null) ...[
          const Divider(),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4),
            child: Text(section, style: const TextStyle(color: Colors.grey)),
          ),
        ],
        ListTile(
          onTap: onTap,
          tileColor: Colors.black12,
          leading: Icon(icon),
          title: Text(title),
        ),
        const Divider(height: 0, thickness: 0.5, color: Colors.grey),
      ],
    );
  }
}
