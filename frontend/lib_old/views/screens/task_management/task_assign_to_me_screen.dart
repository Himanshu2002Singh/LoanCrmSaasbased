import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/widgets/app_scaffold.dart';
import 'package:flutter/material.dart';

class TaskAssignScreen extends StatefulWidget {
  const TaskAssignScreen({Key? key}) : super(key: key);

  @override
  State<TaskAssignScreen> createState() => _TaskAssignScreenState();
}

class _TaskAssignScreenState extends State<TaskAssignScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<String> tabs = ["PENDING", "CHECKED IN", "COMPLETED"];

  @override
  void initState() {
    _tabController = TabController(length: tabs.length, vsync: this);
    super.initState();
  }

  Widget build(BuildContext context) {
    return AppScaffold(
      isFloatingActionButton: false,
      appBar: AppBar(
        title: const Text("Task Assign To Me"),
        backgroundColor: AppColors.primaryColor,
        foregroundColor: AppColors.appBarForegroundColor,

        bottom: TabBar(
          controller: _tabController,
          indicatorSize: TabBarIndicatorSize.tab,
          padding: EdgeInsets.only(left: 10, right: 10),
          unselectedLabelStyle: TextStyle(
            color: Colors.black,
            fontWeight: FontWeight.w500,
          ),
          labelColor: Colors.white,
          tabs:
              tabs
                  .map(
                    (tab) => Tab(
                      child: Text(
                        tab,
                        // style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ),
                  )
                  .toList(),
          indicator: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                const Color.fromARGB(255, 116, 207, 249),
                const Color.fromARGB(255, 196, 229, 245),
              ],
            ),
            borderRadius: BorderRadius.circular(25),
          ),
          unselectedLabelColor: Colors.black,
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: List.generate(tabs.length, (index) => _buildTabContent()),
      ),
      backgroundColor: Colors.grey[200],
    );
  }

  Widget _buildTabContent() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: TextField(
            decoration: InputDecoration(
              hintText: "Search by Task name",
              prefixIcon: Icon(Icons.search, color: Colors.blue),
              contentPadding: EdgeInsets.symmetric(vertical: 0, horizontal: 16),
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(25),
                borderSide: BorderSide.none,
              ),
            ),
          ),
        ),
        Expanded(
          child: Center(
            child: Text(
              "No Task",
              style: TextStyle(color: Colors.blue, fontSize: 16),
            ),
          ),
        ),
      ],
    );
  }
}
