import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

final currentUserProvider = StateNotifierProvider<AuthNotifier, AsyncValue<UserModel?>>((ref) {
  return AuthNotifier(ref.watch(authServiceProvider));
});

class AuthNotifier extends StateNotifier<AsyncValue<UserModel?>> {
  final AuthService _authService;

  AuthNotifier(this._authService) : super(const AsyncLoading()) {
    checkAuth();
  }

  Future<void> checkAuth() async {
    state = const AsyncLoading();
    try {
      final isAuth = await _authService.isAuthenticated();
      if (!isAuth) {
        state = const AsyncData(null);
        return;
      }
      final user = await _authService.getProfile();
      state = AsyncData(user);
    } catch (e, st) {
      state = AsyncError(e, st);
    }
  }

  Future<void> login(String identifier, String password) async {
    state = const AsyncLoading();
    try {
      final user = await _authService.login(identifier, password);
      state = AsyncData(user);
    } catch (e, st) {
      state = AsyncError(e, st);
      rethrow;
    }
  }

  Future<void> logout() async {
    state = const AsyncLoading();
    try {
      await _authService.logout();
      state = const AsyncData(null);
    } catch (e, st) {
      state = AsyncError(e, st);
    }
  }

  Future<void> deleteAccount() async {
    state = const AsyncLoading();
    try {
      await _authService.deleteAccount();
      state = const AsyncData(null);
    } catch (e, st) {
      state = AsyncError(e, st);
      rethrow;
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _authService.changePassword(
      currentPassword: currentPassword,
      newPassword: newPassword,
    );
  }
}
