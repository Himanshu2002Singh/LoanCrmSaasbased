import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:capital_care/core/constants/app_colors.dart';
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
import 'package:capital_care/features/expenses/models/expense_model.dart';
import 'package:capital_care/features/expenses/views/expenses_screen.dart';
import 'package:capital_care/features/expenses/views/add_edit_expense_screen.dart';
import 'package:capital_care/features/notes/views/notes_screen.dart';

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

  Future<void> _handlePop() async {
    final location = GoRouterState.of(context).uri.path;

    // 1. If currently on a sub-route or any other screen, navigate back to Dashboard
    if (location != '/dashboard' && location != '/') {
      if (context.canPop()) {
        context.pop();
      } else {
        context.go('/dashboard');
      }
      return;
    }

    // 2. If on /dashboard: Ask for confirmation before exiting
    final shouldExit = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        title: const Row(
          children: [
            Icon(Icons.exit_to_app_rounded, color: AppColors.error, size: 24),
            SizedBox(width: 8),
            Text(
              'Exit App',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18),
            ),
          ],
        ),
        content: const Text(
          'Are you sure you want to exit the Loan CRM app?',
          style: TextStyle(fontSize: 14, color: AppColors.textPrimary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text(
              'Cancel',
              style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w600),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text(
              'Exit',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );

    if (shouldExit == true) {
      SystemNavigator.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _handlePop();
      },
      child: Scaffold(
        drawer: const AppDrawer(),
        body: widget.child,
      ),
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
            final fromDialer = state.uri.queryParameters['fromDialer'] == 'true' || state.uri.queryParameters['dialer'] == 'true';
            return AddLeadScreen(initialMobile: mobile, fromDialer: fromDialer);
          },
        ),
        GoRoute(
          path: '/add-lead',
          builder: (context, state) {
            final mobile = state.uri.queryParameters['mobile'] ?? state.uri.queryParameters['number'];
            final fromDialer = state.uri.queryParameters['fromDialer'] == 'true' || state.uri.queryParameters['dialer'] == 'true';
            return AddLeadScreen(initialMobile: mobile, fromDialer: fromDialer);
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
          builder: (context, state) {
            final tabIndex = int.tryParse(state.uri.queryParameters['tab'] ?? '0') ?? 0;
            final window = state.uri.queryParameters['window'];
            return TasksAndFollowupsScreen(initialTabIndex: tabIndex, initialWindow: window);
          },
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
          path: '/expenses',
          builder: (context, state) => const ExpensesScreen(),
        ),
        GoRoute(
          path: '/expenses/add',
          builder: (context, state) {
            final exp = state.extra as ExpenseModel?;
            return AddEditExpenseScreen(initialExpense: exp);
          },
        ),
        GoRoute(
          path: '/notes',
          builder: (context, state) => const NotesScreen(),
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfileScreen(),
        ),
      ],
    ),
  ],
);
