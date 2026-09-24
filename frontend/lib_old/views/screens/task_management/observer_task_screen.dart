import 'package:capital_care/views/widgets/app_scaffold.dart';
import 'package:capital_care/views/widgets/custom_appbar.dart';
import 'package:flutter/material.dart';

class ObserverTaskScreen extends StatelessWidget {
  const ObserverTaskScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      isFloatingActionButton: false,
      appBar: CustomAppbar(title: "Observer Task"),
      body: Container(),
    );
  }
}
