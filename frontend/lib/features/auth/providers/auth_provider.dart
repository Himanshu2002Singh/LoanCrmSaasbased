import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:capital_care/core/utils/provider_reset.dart';
import '../models/user_model.dart';
import '../services/auth_service.dart';

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

final currentUserProvider = StateNotifierProvider<AuthNotifier, AsyncValue<UserModel?>>((ref) {
  return AuthNotifier(ref.watch(authServiceProvider), ref);
});

class AuthNotifier extends StateNotifier<AsyncValue<UserModel?>> {
  final AuthService _authService;
  final Ref _ref;

  AuthNotifier(this._authService, this._ref) : super(const AsyncLoading()) {
    checkAuth();
  }

  Future<void> checkAuth() async {
    state = const AsyncLoading();
    try {
      final isAuth = await _authService.isAuthenticated();
      if (!isAuth) {
        invalidateAllAppProviders(_ref);
        state = const AsyncData(null);
        return;
      }
      final user = await _authService.getProfile();
      state = AsyncData(user);
    } catch (e, st) {
      invalidateAllAppProviders(_ref);
      state = AsyncError(e, st);
    }
  }

  Future<void> login(String identifier, String password) async {
    state = const AsyncLoading();
    try {
      final user = await _authService.login(identifier, password);
      // Invalidate all domain providers so newly logged in user sees 100% fresh data
      invalidateAllAppProviders(_ref);
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
      // Invalidate all domain providers to eliminate any leftover user data
      invalidateAllAppProviders(_ref);
      state = const AsyncData(null);
    } catch (e, st) {
      invalidateAllAppProviders(_ref);
      state = AsyncError(e, st);
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
