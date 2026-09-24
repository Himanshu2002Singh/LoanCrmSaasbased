import 'package:capital_care/controllers/providers/calls_provider.dart';
import 'package:capital_care/controllers/providers/lead_provider.dart';
import 'package:capital_care/controllers/providers/userprovider.dart';
import 'package:capital_care/services/api_service.dart';
import 'package:capital_care/views/screens/dashboard/dashboard_screen.dart';
import 'package:capital_care/views/widgets/custom_button.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  TextEditingController userNameController = TextEditingController();
  TextEditingController passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;

  void loginUser(String userName, String password) async {
    if (userName.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: Colors.red,
          content: Text('Employee ID and Password are required'),
        ),
      );
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final user = await ApiService.login(userName, password);

      await Provider.of<UserProvider>(
        context,
        listen: false,
      ).fetchUserData(user.empId);
      await Provider.of<LeadProvider>(context, listen: false).fetchAllLeads();
      await Provider.of<CallsProvider>(
        context,
        listen: false,
      ).fetchTotalCalls();

      if (!mounted) return;

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Welcome ${user.ename}!')));

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) =>  DashboardScreen()),
      );
    } catch (e) {
      print("Login error: $e");
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.red,
            content: Text('Something went wrong'),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: Stack(
            children: [
              Container(
                child: Column(
                  mainAxisAlignment:
                      MainAxisAlignment.center, // Center vertically
                  children: <Widget>[
                    Padding(
                      padding: const EdgeInsets.only(top: 20.0),
                      child: Column(
                        children: [
                          Image.asset(
                            'assets/images/capitalCareLogo.png',
                            width: 225,
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: 40), // Extra space
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24.0),
                      child: Column(
                        children: <Widget>[
                          TextField(
                            controller: userNameController,
                            decoration: const InputDecoration(
                              labelText: 'Enter Username',
                              border: OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 20),
                          TextField(
                            controller: passwordController,
                            obscureText:
                                _obscurePassword, // Obscure or show password based on toggle
                            decoration: InputDecoration(
                              labelText: 'Enter Password',
                              border: OutlineInputBorder(),
                              suffixIcon: IconButton(
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_off
                                      : Icons.visibility,
                                ),
                                onPressed: () {
                                  setState(() {
                                    _obscurePassword =
                                        !_obscurePassword; // Toggle password visibility
                                  });
                                },
                              ),
                            ),
                          ),
                          const SizedBox(height: 30),
                          _isLoading
                              ? const CircularProgressIndicator(color: Colors.green)
                              : CustomButton(
                                  text: "Login",
                                  onPressed: () {
                                    String username = userNameController.text.trim();
                                    String password = passwordController.text.trim();
                                    loginUser(username, password);
                                  },
                                  color: Colors.green,
                                ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Positioned(
                bottom: 10,
                left: 40,
                child: Text("Designed and Developed by Trusting Brains"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
