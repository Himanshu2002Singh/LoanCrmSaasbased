import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:capital_care/core/networking/api_client.dart';
import 'package:capital_care/core/widgets/app_drawer.dart';
import 'package:capital_care/core/widgets/subscription_expired_dialog.dart';
import 'package:capital_care/features/auth/views/splash_screen.dart';
import 'package:capital_care/features/auth/views/login_screen.dart';
import 'package:capital_care/features/auth/views/profile_screen.dart';
import 'package:capital_care/features/auth/views/change_password_screen.dart';
import 'package:capital_care/features/dashboard/views/dashboard_screen.dart';
import 'package:capital_care/features/leads/views/leads_screen.dart';
import 'package:capital_care/features/leads/views/add_lead_screen.dart';
import 'package:capital_care/features/leads/views/lead_details_screen.dart';
import 'package:capital_care/features/telecalling/views/call_logs_screen.dart';
import 'package:capital_care/features/telecalling/views/dialer_screen.dart';
import 'package:capital_care/features/tasks_and_followups/views/tasks_and_followups_screen.dart';
import 'package:capital_care/features/attendance/views/attendance_screen.dart';
import 'package:capital_care/features/applications/views/applications_screen.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>();
final GlobalKey<NavigatorState> _shellNavigatorKey = GlobalKey<NavigatorState>();

class AppShell extends StatefulWidget {
  final Widget child;

  const AppShell({super.key, required this.child});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  StreamSubscription<SubscriptionEvent>? _subSubscription;

  @override
  void initState() {
    super.initState();
    _subSubscription = ApiClient.onSubscriptionEvent.listen((event) {
      if (!mounted) return;
      final ctx = _rootNavigatorKey.currentContext ?? context;
      SubscriptionExpiredDialog.show(
        ctx,
        message: event.message,
        expiredAt: event.expiredAt,
        isSuspended: event.code == 'COMPANY_SUSPENDED',
      );
    });
  }

  @override
  void dispose() {
    _subSubscription?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppDrawer(),
      body: widget.child,
    );
  }
}

final GoRouter appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginScreen(),
    ),
    GoRoute(
      path: '/change-password',
      builder: (context, state) => const ChangePasswordScreen(),
    ),
    ShellRoute(
      navigatorKey: _shellNavigatorKey,
      builder: (context, state, child) {
        return AppShell(child: child);
      },
      routes: [
        GoRoute(
          path: '/dashboard',
          builder: (context, state) => const DashboardScreen(),
        ),
        GoRoute(
          path: '/leads',
          builder: (context, state) => const LeadsScreen(),
        ),
        GoRoute(
          path: '/leads/add',
          builder: (context, state) {
            final mobile = state.uri.queryParameters['mobile'] ?? state.uri.queryParameters['number'];
            return AddLeadScreen(initialMobile: mobile);
          },
        ),
        GoRoute(
          path: '/add-lead',
          builder: (context, state) {
            final mobile = state.uri.queryParameters['mobile'] ?? state.uri.queryParameters['number'];
            return AddLeadScreen(initialMobile: mobile);
          },
        ),
        GoRoute(
          path: '/leads/:id',
          builder: (context, state) {
            final id = int.tryParse(state.pathParameters['id'] ?? '') ?? 0;
            return LeadDetailsScreen(leadId: id);
          },
        ),
        GoRoute(
          path: '/dialer',
          builder: (context, state) {
            final number = state.uri.queryParameters['number'] ?? state.uri.queryParameters['mobile'];
            return DialerScreen(initialNumber: number);
          },
        ),
        GoRoute(
          path: '/calls',
          builder: (context, state) => const CallLogsScreen(),
        ),
        GoRoute(
          path: '/followups',
          builder: (context, state) => const TasksAndFollowupsScreen(initialTabIndex: 0),
        ),
        GoRoute(
          path: '/tasks',
          builder: (context, state) => const TasksAndFollowupsScreen(initialTabIndex: 1),
        ),
        GoRoute(
          path: '/attendance',
          builder: (context, state) => const AttendanceScreen(),
        ),
        GoRoute(
          path: '/applications',
          builder: (context, state) => const ApplicationsScreen(),
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfileScreen(),
        ),
      ],
    ),
  ],
);
