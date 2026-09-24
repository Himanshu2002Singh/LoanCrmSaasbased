import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/constants/api_constants.dart';
import '../../../core/networking/api_client.dart';
import '../models/user_model.dart';

class AuthService {
  static const String userPrefKey = 'cached_user_profile';

  Future<UserModel> login(String identifier, String password) async {
    final response = await ApiClient.post(
      ApiConstants.login,
      body: {
        'username': identifier.trim(),
        'email': identifier.trim(),
        'password': password,
      },
    );

    // Save token
    final token = response['token'] ?? response['data']?['token'];
    if (token != null) {
      await ApiClient.saveToken(token.toString());
    }

    final userData = response['user'] ?? response['data']?['user'] ?? response;
    final user = UserModel.fromJson(userData);
    await _cacheUser(user);
    return user;
  }

  Future<UserModel?> getProfile() async {
    try {
      final token = await ApiClient.getToken();
      if (token == null || token.isEmpty) return null;

      final response = await ApiClient.get(ApiConstants.me);
      final userData = response['user'] ?? response['data']?['user'] ?? response;
      final user = UserModel.fromJson(userData);
      await _cacheUser(user);
      return user;
    } catch (_) {
      // Fallback to cached user if offline
      return await getCachedUser();
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await ApiClient.put(
      ApiConstants.changePassword,
      body: {
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      },
    );
  }

  Future<void> logout() async {
    await ApiClient.clearToken();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(userPrefKey);
  }

  Future<bool> isAuthenticated() async {
    final token = await ApiClient.getToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> _cacheUser(UserModel user) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(userPrefKey, jsonEncode(user.toJson()));
  }

  Future<UserModel?> getCachedUser() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonStr = prefs.getString(userPrefKey);
    if (jsonStr == null) return null;
    try {
      return UserModel.fromJson(jsonDecode(jsonStr));
    } catch (_) {
      return null;
    }
  }
}
