import 'package:capital_care/controllers/providers/calls_provider.dart';
import 'package:capital_care/models/calls_model.dart';
import 'package:capital_care/services/api_service.dart';
import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/screens/call_details_screen.dart';
import 'package:capital_care/views/widgets/template_dialog.dart';
import 'package:flutter/material.dart';
import 'package:flutter_phone_direct_caller/flutter_phone_direct_caller.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

class LeadCard extends StatefulWidget {
  // final LeadModel lead;
  final lead;
  LeadCard({super.key, required this.lead});

  @override
  State<LeadCard> createState() => _LeadCardState();
}

class _LeadCardState extends State<LeadCard> {
  String leadAssignedTo = "Select User";

  List<String> assignLeadOptions = ["User1", "User2", "User3"];
  List<String> filteredUsers = [];

  void submitCall() async {
    final storage = FlutterSecureStorage();
    final userId = await storage.read(key: "userId") ?? "";
    Calls call = Calls(
      lead_id: widget.lead.lead_id ?? "",
      emp_id: userId,
      name: widget.lead.name ?? "",
      number: widget.lead.number ?? "",
    );
    Provider.of<CallsProvider>(context, listen: false).addCall(call);
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Name and action buttons
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  widget.lead.name.length > 15
                      ? (widget.lead.name).substring(0, 15) + "..."
                      : widget.lead.name ?? "",
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildSmallIconButton(
                      icon: Icons.phone,
                      color: Colors.blue,
                      onPressed: () {
                        makeDirectCall(widget.lead.number ?? "");
                      },
                    ),
                    _buildSmallIconButton(
                      icon: Icons.sms,
                      color: Colors.orange,
                      onPressed: () {
                        sendSMS(widget.lead.number ?? "", "");
                      },
                    ),
                    _buildSmallIconButton(
                      icon: FontAwesomeIcons.whatsapp,
                      color: Colors.green,
                      isFaIcon: true,
                      onPressed: () {
                        TemplateDialog.show(
                          context,
                          widget.lead.number ?? "",
                          widget.lead.name ?? "",
                        );
                        // openWhatsApp(
                        //   widget.lead.number ?? "",
                        //   "message description",
                        // );
                      },
                    ),
                    // _buildSmallIconButton(
                    //   icon: Icons.transform_outlined,
                    //   color: Colors.blueAccent,
                    //   onPressed: () {
                    //     leadAssignAlert();
                    //   },
                    // ),
                    // const CircleAvatar(radius: 15, child: Text('2')),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 4),
            // Info Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.person),
                        const SizedBox(width: 5),
                        Text(
                          ((widget.lead.owner ?? "").length > 15
                              ? (widget.lead.owner ?? "").substring(0, 12) +
                                  "..."
                              : (widget.lead.owner ?? "")),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        const Icon(Icons.public),
                        const SizedBox(width: 5),
                        Text(widget.lead.source ?? ""),
                      ],
                    ),
                    Row(
                      children: [
                        const Icon(Icons.timer),
                        const SizedBox(width: 5),
                        Text(
                          widget.lead.createdAt != null &&
                                  widget.lead.createdAt != ""
                              ? (widget.lead.createdAt ?? "").substring(0, 10)
                              : "",
                        ),
                      ],
                    ),
                    // Icon(Icons.forum),
                    Row(
                      children: [
                        const Icon(Icons.stairs),
                        const SizedBox(width: 5),
                        Text(
                          ((widget.lead.priority ?? "").length > 15
                              ? (widget.lead.priority ?? "").substring(0, 12) +
                                  "..."
                              : (widget.lead.priority ?? "")),
                          style: const TextStyle(color: Colors.purple),
                        ),
                      ],
                    ),
                  ],
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.assignment),
                        const SizedBox(width: 5),
                        Text(
                          widget.lead.status ?? "",
                          style: TextStyle(color: Colors.purple),
                        ),
                      ],
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.messenger),
                            const SizedBox(width: 5),
                            Text(
                              ((widget.lead.description ?? "").length > 8
                                  ? (widget.lead.description ?? "").substring(
                                        0,
                                        8,
                                      ) +
                                      "..."
                                  : (widget.lead.description ?? "")),
                            ),
                          ],
                        ),
                        SizedBox(width: 10),
                        InkWell(
                          child: Text(
                            "(see more)",
                            style: TextStyle(color: Colors.blue),
                          ),
                          onTap: () {
                            showDialog(
                              context: context,
                              builder:
                                  (context) => AlertDialog(
                                    title: Text("Lead Description!"),
                                    content: Text(
                                      widget.lead.description ?? "",
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () {
                                          Navigator.pop(context);
                                        },
                                        child: Text(
                                          "OK",
                                          style: TextStyle(color: Colors.blue),
                                        ),
                                      ),
                                    ],
                                  ),
                            );
                          },
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        const Icon(Icons.calendar_month_sharp),
                        const SizedBox(width: 5),
                        Text(
                          widget.lead.next_meeting != null &&
                                  widget.lead.next_meeting != ""
                              ? (widget.lead.next_meeting ?? "").substring(
                                0,
                                10,
                              )
                              : "",
                        ),
                      ],
                    ),
                    // Icon(Icons.forum),
                    // Row(
                    //   children: [
                    //     const Icon(Icons.money_rounded),
                    //     const SizedBox(width: 5),
                    //     Text(
                    //       "${widget.lead.salary != null && widget.lead.salary != "" ? widget.lead.salary : ""}",
                    //     ),
                    //   ],
                    // ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // from here functions start ********************************************************************************************************************************************************

  Future<void> makeDirectCall(String number) async {
    var status = await Permission.phone.status;
    if (!status.isGranted) {
      await Permission.phone.request();
    }

    if (await Permission.phone.isGranted) {
      await FlutterPhoneDirectCaller.callNumber(number);
      Future.delayed(Duration(seconds: 2), () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => CallDetailsScreen(lead: widget.lead),
          ),
        );
      });

      submitCall();
    } else {
      print("CALL_PHONE permission denied");
    }
  }

  void sendSMS(String number, String message) async {
    final Uri smsUri = Uri(
      scheme: 'sms',
      path: number,
      queryParameters: <String, String>{'body': message},
    );

    if (await canLaunchUrl(smsUri)) {
      await launchUrl(smsUri);
    } else {
      throw 'Could not launch SMS';
    }
  }

  void openWhatsApp(String phone, String message) async {
    final Uri whatsappUri = Uri.parse(
      "https://wa.me/$phone?text=${Uri.encodeComponent(message)}",
    );

    try {
      await launchUrl(whatsappUri, mode: LaunchMode.externalApplication);
    } catch (e) {
      print("WhatsApp launch failed: $e");
    }
  }

  Future<dynamic> leadAssignAlert() {
    return showDialog(
      context: context,
      builder: (BuildContext context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return Dialog(
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Top bar with title and close icon
                  Container(
                    padding: EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primaryColor,
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(10),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          "Assign Lead",
                          style: TextStyle(
                            color: AppColors.appBarForegroundColor,
                            fontSize: 18,
                          ),
                        ),
                        GestureDetector(
                          onTap: () => Navigator.of(context).pop(),
                          child: Icon(
                            Icons.close,
                            color: AppColors.appBarForegroundColor,
                          ),
                        ),
                      ],
                    ),
                  ),

                  SizedBox(height: 15),

                  // User info
                  ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.blue,
                      child: Icon(
                        Icons.check,
                        weight: 500,
                        color: Colors.white,
                      ),
                    ),
                    title: Text("Person Name", style: TextStyle(fontSize: 18)),
                  ),

                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          "Select User's Name",
                          style: TextStyle(fontSize: 17, color: Colors.grey),
                        ),
                        SizedBox(height: 8),
                        GestureDetector(
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: Colors.black,
                                width: 2,
                                style: BorderStyle.solid,
                              ),
                            ),
                            padding: EdgeInsets.only(
                              top: 10,
                              bottom: 10,
                              left: 20,
                              right: 10,
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(leadAssignedTo),
                                Icon(Icons.arrow_drop_down),
                              ],
                            ),
                          ),
                          onTap: () {
                            showDialog(
                              context: context,
                              builder: (context) {
                                return SingleChildScrollView(
                                  child: AlertDialog(
                                    title: Text("Select User"),
                                    content: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        TextField(
                                          decoration: InputDecoration(
                                            prefixIcon: Icon(Icons.search),
                                          ),
                                        ),
                                        Container(
                                          height: 200,
                                          width: double.maxFinite,
                                          child: ListView.separated(
                                            itemBuilder: (context, index) {
                                              return ListTile(
                                                title: Text(
                                                  assignLeadOptions[index],
                                                ),
                                                onTap: () {
                                                  setState(() {
                                                    leadAssignedTo =
                                                        assignLeadOptions[index];
                                                  });

                                                  Navigator.pop(context);
                                                },
                                              );
                                            },
                                            separatorBuilder:
                                                (_, _) => Divider(),
                                            itemCount: assignLeadOptions.length,
                                          ),
                                        ),
                                      ],
                                    ),
                                    actions: [
                                      TextButton(
                                        onPressed: () {
                                          Navigator.pop(context);
                                        },
                                        child: Text("CLOSE"),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            );
                          },
                        ),
                      ],
                    ),
                  ),

                  SizedBox(height: 20),

                  // Submit button
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        minimumSize: Size(double.infinity, 50),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      onPressed: () {
                        // Your submit logic here
                        Navigator.of(context).pop();
                      },
                      child: Text(
                        "SUBMIT",
                        style: TextStyle(color: Colors.white),
                      ),
                    ),
                  ),

                  SizedBox(height: 15),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

Widget _buildSmallIconButton({
  required dynamic icon,
  required Color color,
  required VoidCallback onPressed,
  bool isFaIcon = false,
}) {
  return SizedBox(
    width: 40,
    height: 35,
    child: IconButton(
      padding: EdgeInsets.zero,
      iconSize: 25,
      icon:
          isFaIcon
              ? FaIcon(icon, color: color, size: 25)
              : Icon(icon, color: color, size: 25),
      onPressed: onPressed,
    ),
  );
}
