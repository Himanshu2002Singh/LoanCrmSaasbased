import 'package:capital_care/controllers/providers/lead_provider.dart';
import 'package:capital_care/controllers/providers/userprovider.dart';
import 'package:capital_care/models/employee_model.dart';
import 'package:capital_care/services/api_service.dart';
import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/screens/change_password.dart';
import 'package:capital_care/views/widgets/custom_appbar.dart';
import 'package:capital_care/views/widgets/custom_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:provider/provider.dart';

class EmployeeProfilePage extends StatefulWidget {
  const EmployeeProfilePage({super.key});

  @override
  State<EmployeeProfilePage> createState() => _EmployeeProfilePageState();
}

class _EmployeeProfilePageState extends State<EmployeeProfilePage> {
  bool isEditing = false;

  // Static dummy data (will be replaced by actual backend data)
  String profileImage =
      'https://via.placeholder.com/150'; // you can use a network image or asset

  Employee? user;

  // Controllers for editable fields
  final TextEditingController nameController = TextEditingController();
  final TextEditingController phoneController = TextEditingController();
  final TextEditingController emailController = TextEditingController();

  @override
  void initState() {
    super.initState();
    user = Provider.of<UserProvider>(context, listen: false).user;
    nameController.text = user?.ename ?? "";
    phoneController.text = user?.phone ?? "";
    emailController.text = user?.email ?? "";
  }

  void saveChanges() async {
    Employee employee = Employee(
      ename: nameController.text,
      email: emailController.text,
      phone: phoneController.text,
    );
    bool success = await ApiService.updateUser(user?.empId, employee);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(success ? "Successfully " : "Error")),
    );
    if (success) {
      // Update state management here
      Provider.of<UserProvider>(context, listen: false).updateUserFields(
        name: nameController.text,
        phone: phoneController.text,
        email: emailController.text,
      );

      setState(() {
        isEditing = false;
      });
    }
  }

  Widget buildTextField(
    String label,
    TextEditingController controller, {
    bool readOnly = true,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: TextField(
        readOnly: readOnly,
        enabled: true,
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          border: OutlineInputBorder(),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CustomAppbar(
        title: "Profile",
        action: [
          IconButton(
            icon: Icon(isEditing ? Icons.save : Icons.edit),
            onPressed: () {
              if (isEditing) {
                saveChanges();
              } else {
                setState(() {
                  isEditing = true;
                });
              }
            },
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              CircleAvatar(
                radius: 60,
                backgroundImage: NetworkImage(profileImage),
              ),
              const SizedBox(height: 20),
              buildTextField("Name", nameController, readOnly: !isEditing),
              const SizedBox(height: 8),
              buildTextField("Email", emailController, readOnly: !isEditing),
              const SizedBox(height: 8),
              buildTextField("Phone", phoneController, readOnly: !isEditing),
              const SizedBox(height: 12),
              TextFormField(
                initialValue: user?.empId ?? "",
                readOnly: true,
                enabled: !isEditing,
                decoration: const InputDecoration(
                  labelText: 'Employee Id',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 20),
              TextFormField(
                initialValue: user?.username,
                readOnly: true,
                enabled: !isEditing,
                decoration: const InputDecoration(
                  labelText: 'username',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 20),
              TextFormField(
                initialValue:
                    "${Provider.of<LeadProvider>(context, listen: false).leads.length}",
                readOnly: true,
                enabled: !isEditing,
                decoration: const InputDecoration(
                  labelText: 'Total leads Assigned',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 15),
              CustomButton(
                text: "Change Password",
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => ChangePassword()),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
