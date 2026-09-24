import 'package:capital_care/controllers/providers/calls_provider.dart';
import 'package:capital_care/models/calls_model.dart';
import 'package:capital_care/models/leads_model.dart';
import 'package:capital_care/services/api_service.dart';
import 'package:capital_care/views/screens/call_details_screen.dart';
import 'package:capital_care/views/widgets/custom_appbar.dart';
import 'package:contacts_service_plus/contacts_service_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_phone_direct_caller/flutter_phone_direct_caller.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:provider/provider.dart';

class ContactsPage extends StatefulWidget {
  const ContactsPage({Key? key}) : super(key: key);

  @override
  State<ContactsPage> createState() => _ContactsPageState();
}

class _ContactsPageState extends State<ContactsPage> {
  List<Contact> _allContacts = [];
  List<Contact> _filteredContacts = [];
  final TextEditingController _searchController = TextEditingController();
  bool isLoading = false;

  @override
  void initState() {
    super.initState();
    _requestPermissionAndFetchContacts();
    _searchController.addListener(_filterContacts);
  }

  Future<void> _requestPermissionAndFetchContacts() async {
    setState(() {
      isLoading = true;
    });
    if (await Permission.contacts.request().isGranted) {
      Iterable<Contact> contacts = await ContactsService.getContacts(
        withThumbnails: false,
      );
      setState(() {
        _allContacts = contacts.toList();
        _filteredContacts = _allContacts;
      });
    } else {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Contacts permission denied")));
    }
    setState(() {
      isLoading = false;
    });
  }

  void _filterContacts() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredContacts =
          _allContacts.where((contact) {
            final name = contact.displayName?.toLowerCase() ?? "";

            // Join all phone numbers into one string (in case there are multiple)
            final numbers =
                (contact.phones ?? [])
                    .map((item) => item.value ?? "")
                    .join(" ")
                    .toLowerCase();

            return name.contains(query) || numbers.contains(query);
          }).toList();
    });
  }

  Future<void> _callAndNavigate(String number) async {
    if (await Permission.phone.request().isGranted && number.isNotEmpty) {
      Leads lead = await ApiService.getLeadByNumber(number);
      await FlutterPhoneDirectCaller.callNumber(number);

      Future.delayed(Duration(seconds: 2), () {
        if (lead.lead_id != null) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => CallDetailsScreen(lead: lead),
            ),
          );
          submitCall(lead);
        } else {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => CallDetailsScreen(number: number),
            ),
          );
        }
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Phone permission denied or number invalid")),
      );
    }
  }

  void submitCall(Leads lead) async {
    final storage = FlutterSecureStorage();
    final userId = await storage.read(key: "userId") ?? "";
    Calls call = Calls(
      lead_id: lead.lead_id ?? "",
      emp_id: userId,
      name: lead.name ?? "",
      number: lead.number ?? "",
    );
    Provider.of<CallsProvider>(context, listen: false).addCall(call);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.blue.shade50,
      appBar: CustomAppbar(title: "Contacts"),
      body:
          isLoading
              ? Center(child: CircularProgressIndicator())
              : Column(
                children: [
                  Padding(
                    padding: EdgeInsets.all(12),
                    child: TextField(
                      controller: _searchController,
                      decoration: InputDecoration(
                        hintText: "Search contacts...",
                        prefixIcon: Icon(Icons.search),
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child:
                        _filteredContacts.isEmpty
                            ? Center(child: Text("No contacts found"))
                            : ListView.builder(
                              itemCount: _filteredContacts.length,
                              itemBuilder: (context, index) {
                                final contact = _filteredContacts[index];
                                final name = contact.displayName ?? "Unknown";
                                final phone =
                                    contact.phones?.isNotEmpty == true
                                        ? contact.phones!.first.value ?? ""
                                        : "";

                                return Card(
                                  margin: EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 0,
                                  ),
                                  child: ListTile(
                                    leading: CircleAvatar(
                                      backgroundColor: const Color.fromARGB(
                                        255,
                                        213,
                                        234,
                                        247,
                                      ),
                                      child: Text(
                                        name.isNotEmpty
                                            ? name[0].toUpperCase()
                                            : "?",
                                      ),
                                    ),
                                    title: Text(name),
                                    subtitle: Text(phone),
                                    tileColor: Colors.white,
                                    trailing: IconButton(
                                      icon: Icon(
                                        Icons.call,
                                        color: Colors.blue,
                                      ),
                                      onPressed: () {
                                        if (phone.isNotEmpty) {
                                          _callAndNavigate(phone);
                                        } else {
                                          ScaffoldMessenger.of(
                                            context,
                                          ).showSnackBar(
                                            SnackBar(
                                              content: Text(
                                                "No number available",
                                              ),
                                            ),
                                          );
                                        }
                                      },
                                    ),
                                  ),
                                );
                              },
                            ),
                  ),
                ],
              ),
    );
  }
}
