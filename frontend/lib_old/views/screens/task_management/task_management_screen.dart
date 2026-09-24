import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/screens/task_management/observer_task_screen.dart';
import 'package:capital_care/views/screens/task_management/personal_screen.dart';
import 'package:capital_care/views/screens/task_management/task_assign_to_me_screen.dart';
import 'package:capital_care/views/screens/task_management/work_screen.dart';
import 'package:capital_care/views/widgets/app_scaffold.dart';
import 'package:capital_care/views/widgets/custom_appbar.dart';
import 'package:flutter/material.dart';

class TaskManagementScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      isFloatingActionButton: false,
      appBar: CustomAppbar(title: "Task Management"),
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              AppColors.primaryColor,
              const Color.fromARGB(255, 173, 221, 243),
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Center(
          child: Card(
            color: Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
            elevation: 4,
            margin: const EdgeInsets.all(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: GridView.count(
                shrinkWrap: true,
                crossAxisCount: 2,
                crossAxisSpacing: 24,
                mainAxisSpacing: 24,
                padding: const EdgeInsets.symmetric(horizontal: 24),
                children: [
                  buildCircleButton(
                    icon: Icons.assignment,
                    label: "ASSIGN TO ME",
                    color: Colors.brown,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => TaskAssignScreen(),
                        ),
                      );
                    },
                  ),
                  buildCircleButton(
                    icon: Icons.list_alt,
                    label: "OBSERVER TASK",
                    color: Colors.green,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => ObserverTaskScreen(),
                        ),
                      );
                    },
                  ),
                  buildCircleButton(
                    icon: Icons.person,
                    label: "PERSONAL",
                    color: Colors.lightBlue,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => PersonalScreen(),
                        ),
                      );
                    },
                  ),
                  buildCircleButton(
                    icon: Icons.work,
                    label: "WORK",
                    color: Colors.orange,
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => WorkScreen()),
                      );
                    },
                  ),
                  buildCircleButton(
                    icon: Icons.groups,
                    label: "MEET",
                    color: Colors.indigo,
                    onTap: () {
                      print("Meet tapped");
                    },
                  ),
                  buildCircleButton(
                    icon: Icons.home,
                    label: "HOME",
                    color: Colors.red,
                    onTap: () {
                      print("Home tapped");
                    },
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget buildCircleButton({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CircleAvatar(
            radius: 36,
            backgroundColor: color,
            child: Icon(icon, size: 32, color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }
}
