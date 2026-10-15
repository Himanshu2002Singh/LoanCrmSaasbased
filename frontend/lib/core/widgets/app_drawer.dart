import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/api_constants.dart';
import '../constants/app_colors.dart';
import '../widgets/status_badge.dart';
import '../../features/auth/providers/auth_provider.dart';

class AppDrawer extends ConsumerWidget {
  const AppDrawer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userState = ref.watch(currentUserProvider);
    final user = userState.value;
    final currentRoute = GoRouterState.of(context).uri.toString();

    return Drawer(
      backgroundColor: Colors.white,
      child: Column(
        children: [
          // Drawer Header
          Container(
            padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top + 20,
              bottom: 20,
              left: 20,
              right: 20,
            ),
            decoration: const BoxDecoration(
              color: AppColors.primary,
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: Colors.white.withValues(alpha: 0.12),
                  child: Text(
                    user != null && user.name.isNotEmpty ? user.name[0].toUpperCase() : 'U',
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.name ?? 'User',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        user?.company?.name ?? 'Capital Care CRM',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.7),
                          fontSize: 12,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6),
                      if (user != null)
                        StatusBadge(
                          status: user.role,
                          fontSize: 10,
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Menu List
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(vertical: 8),
              children: [
                _buildMenuItem(
                  context,
                  icon: Icons.dashboard_rounded,
                  title: 'Dashboard',
                  path: '/dashboard',
                  isSelected: currentRoute == '/dashboard',
                ),
                _buildMenuItem(
                  context,
                  icon: Icons.people_alt_rounded,
                  title: 'Leads Pipeline',
                  path: '/leads',
                  isSelected: currentRoute == '/leads',
                ),
                _buildMenuItem(
                  context,
                  icon: Icons.person_add_rounded,
                  title: 'Add New Lead',
                  path: '/leads/add',
                  isSelected: currentRoute == '/leads/add' || currentRoute == '/add-lead',
                ),
                _buildMenuItem(
                  context,
                  icon: Icons.dialpad_rounded,
                  title: 'Smart Dialer',
                  path: '/dialer',
                  isSelected: currentRoute == '/dialer',
                ),
                _buildMenuItem(
                  context,
                  icon: Icons.phone_in_talk_rounded,
                  title: 'Call Logs',
                  path: '/calls',
                  isSelected: currentRoute == '/calls',
                ),
                _buildMenuItem(
                  context,
                  icon: Icons.alarm_rounded,
                  title: 'Follow-ups & Reminders',
                  path: '/followups',
                  isSelected: currentRoute == '/followups',
                ),
                _buildMenuItem(
                  context,
                  icon: Icons.assignment_turned_in_rounded,
                  title: 'Tasks',
                  path: '/tasks',
                  isSelected: currentRoute == '/tasks',
                ),
                _buildMenuItem(
                  context,
                  icon: Icons.location_on_rounded,
                  title: 'GPS Attendance',
                  path: '/attendance',
                  isSelected: currentRoute == '/attendance',
                ),
                _buildMenuItem(
                  context,
                  icon: Icons.folder_shared_rounded,
                  title: 'Loan Applications',
                  path: '/applications',
                  isSelected: currentRoute == '/applications',
                ),
                _buildMenuItem(
                  context,
                  icon: Icons.receipt_long_rounded,
                  title: 'My Expenses / Claims',
                  path: '/expenses',
                  isSelected: currentRoute == '/expenses' || currentRoute == '/expenses/add',
                ),
                _buildMenuItem(
                  context,
                  icon: Icons.sticky_note_2_rounded,
                  title: 'Quick Notes',
                  path: '/notes',
                  isSelected: currentRoute == '/notes',
                ),
                const Divider(height: 16),
                _buildMenuItem(
                  context,
                  icon: Icons.person_rounded,
                  title: 'My Profile',
                  path: '/profile',
                  isSelected: currentRoute == '/profile',
                ),
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                  child: ListTile(
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    dense: true,
                    leading: const Icon(
                      Icons.privacy_tip_outlined,
                      size: 20,
                      color: AppColors.textSecondary,
                    ),
                    title: const Text(
                      'Privacy Policy',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    trailing: const Icon(
                      Icons.open_in_new_rounded,
                      size: 14,
                      color: AppColors.textMuted,
                    ),
                    onTap: () async {
                      Navigator.pop(context);
                      final uri = Uri.parse(ApiConstants.privacyPolicyUrl);
                      await launchUrl(uri, mode: LaunchMode.externalApplication);
                    },
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.error.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: ListTile(
                    leading: const Icon(
                      Icons.logout_rounded,
                      size: 20,
                      color: AppColors.error,
                    ),
                    title: const Text(
                      'Logout',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: AppColors.error,
                      ),
                    ),
                    dense: true,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    onTap: () => _handleLogout(context, ref, user?.company?.name ?? 'CRM'),
                  ),
                ),
              ],
            ),
          ),

          // Footer
          Padding(
            padding: const EdgeInsets.all(16),
            child: Text(
              user?.company?.name ?? 'SaaS Loan CRM v2.0',
              style: TextStyle(
                fontSize: 11,
                color: AppColors.textMuted.withValues(alpha: 0.8),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleLogout(BuildContext context, WidgetRef ref, String companyName) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Confirm Logout', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Text('Are you sure you want to log out of $companyName?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Logout', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      if (context.mounted) {
        Navigator.pop(context); // close drawer
      }
      await ref.read(currentUserProvider.notifier).logout();
      if (context.mounted) {
        context.go('/login');
      }
    }
  }

  Widget _buildMenuItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String path,
    required bool isSelected,
  }) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
      decoration: BoxDecoration(
        color: isSelected ? AppColors.secondary.withValues(alpha: 0.08) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
      ),
      child: ListTile(
        leading: Icon(
          icon,
          size: 20,
          color: isSelected ? AppColors.secondary : AppColors.textSecondary,
        ),
        title: Text(
          title,
          style: TextStyle(
            fontSize: 14,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            color: isSelected ? AppColors.secondary : AppColors.textPrimary,
          ),
        ),
        dense: true,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        onTap: () {
          Navigator.pop(context); // close drawer
          context.go(path);
        },
      ),
    );
  }
}
