import 'package:capital_care/controllers/providers/calls_provider.dart';
import 'package:capital_care/controllers/providers/lead_provider.dart';
import 'package:capital_care/models/calls_model.dart';
import 'package:capital_care/services/api_service.dart';
import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/screens/call_details_screen.dart';
import 'package:capital_care/views/screens/leads/lead_details_screen.dart';
import 'package:capital_care/views/widgets/app_scaffold.dart';
import 'package:capital_care/views/widgets/custom_appbar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_phone_direct_caller/flutter_phone_direct_caller.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:intl/intl.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

class LeadsCountScreen extends StatefulWidget {
  final title;
  // final leads;
  LeadsCountScreen({super.key, required this.title});

  @override
  State<LeadsCountScreen> createState() => _LeadsCountScreenState();
}

class _LeadsCountScreenState extends State<LeadsCountScreen> {
  var leads = [];
  Future<void> makeDirectCall(String number, dynamic lead) async {
    var status = await Permission.phone.status;
    if (!status.isGranted) {
      await Permission.phone.request();
    }

    if (await Permission.phone.isGranted) {
      await FlutterPhoneDirectCaller.callNumber(number);
      Future.delayed(const Duration(seconds: 2), () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => CallDetailsScreen(lead: lead),
          ),
        );
      });

      submitCall(lead); // If needed, ensure this function is defined
    } else {
      print("CALL_PHONE permission denied");
    }
  }

  void submitCall(var lead) async {
    final storage = FlutterSecureStorage();
    final userId = await storage.read(key: "userId");
    Calls call = Calls(
      lead_id: lead.lead_id,
      emp_id: userId,
      name: lead.name,
      number: lead.number,
    );
    Provider.of<CallsProvider>(context, listen: false).addCall(call);
    // bool success = await ApiService.addCalls(call);
    // ScaffoldMessenger.of(
    //   context,
    // ).showSnackBar(SnackBar(content: Text(success ? "success" : "Error")));
  }

  @override
  Widget build(BuildContext context) {
    final leadProvider = Provider.of<LeadProvider>(context, listen: true);
    leads =
        widget.title == "File Login Leads"
            ? leadProvider.fileLoginLeads
            : widget.title == "Tomorrow Followups"
            ? leadProvider.tomorrowLeads
            : leadProvider.todayLeads;
    return AppScaffold(
      isFloatingActionButton: false,
      appBar: CustomAppbar(
        title: widget.title,
        // action: const [Icon(Icons.search), SizedBox(width: 16)],
      ),
      body: SafeArea(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Text(
                'Total FollowUps - ${leads.length}',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            const SizedBox(height: 10),
            Expanded(
              child: ListView.builder(
                itemCount: leads.length,
                itemBuilder: (context, index) {
                  final f = leads[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 6,
                    ),
                    child: Card(
                      elevation: 2,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        // crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            height: 160,
                            width: 100,

                            padding: const EdgeInsets.all(8),
                            decoration: const BoxDecoration(
                              color: AppColors.primaryColor,
                              borderRadius: BorderRadius.only(
                                topLeft: Radius.circular(12),
                                bottomLeft: Radius.circular(12),
                              ),
                            ),
                            child: Center(
                              child: Text(
                                "${formatDateTime(f.next_meeting)}",
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                          ),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.all(10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          // "",
                                          f.name,
                                          style: const TextStyle(
                                            color: Colors.blue,
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                      IconButton(
                                        onPressed: () {
                                          Navigator.push(
                                            context,
                                            MaterialPageRoute(
                                              builder:
                                                  (context) =>
                                                      LeadDetailsScreen(
                                                        lead: f,
                                                      ),
                                            ),
                                          );
                                        },
                                        icon: Icon(Icons.remove_red_eye),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.phone_android,
                                        color: Colors.blue,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        f.number,
                                        style: const TextStyle(
                                          color: Colors.orange,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.person,
                                        color: Colors.blue,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(f.owner),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  GestureDetector(
                                    onTap: () => makeDirectCall(f.number, f),
                                    child: Row(
                                      children: [
                                        const Icon(
                                          Icons.call,
                                          color: Colors.blue,
                                        ),
                                        const SizedBox(width: 8),
                                        Flexible(
                                          child: Text(
                                            "Last call:- ${f.status}",
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String formatDateTime(String dateTimeString) {
  if (dateTimeString.isEmpty || dateTimeString == null) {
    return "";
  }
  final dateTime = DateTime.parse(dateTimeString);
  final formatter = DateFormat('d MMM yyyy hh:mm a');
  return formatter.format(dateTime);
}
