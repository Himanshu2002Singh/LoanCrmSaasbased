import 'package:flutter/material.dart';

class FollowupBoxDashboard extends StatelessWidget {
  const FollowupBoxDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height / 5,
      width: MediaQuery.of(context).size.width / 5,
      color: Colors.red,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.access_alarms_rounded),
          Center(
            child: Column(children: [Text("0"), Text("Pending FollowUps")]),
          ),
        ],
      ),
    );
  }
}
