import 'package:capital_care/models/employee_model.dart';
import 'package:capital_care/services/api_service.dart';
import 'package:flutter/material.dart';

class UserProvider extends ChangeNotifier {
  Employee? _user;

  Employee? get user => _user;

  Future<void> fetchUserData(String userId) async {
    try {
      final fetchedUser = await ApiService.getUserById(userId);
      _user = fetchedUser;
    } catch (err) {
      print("Error fetching user: $err");
      _user = null;
    }

    notifyListeners();
  }

  void updateUserFields({String? name, String? phone, String? email}) {
    if (_user != null) {
      _user = Employee(
        empId: _user!.empId,
        ename: name ?? _user!.ename,
        email: email ?? _user!.email,
        phone: phone ?? _user!.phone,
        username: _user!.username,
        password: _user!.password,
      );
      notifyListeners();
    }
  }
}
