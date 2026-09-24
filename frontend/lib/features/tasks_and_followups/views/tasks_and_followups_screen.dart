import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:flutter_phone_direct_caller/flutter_phone_direct_caller.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/app_drawer.dart';
import 'package:capital_care/core/widgets/empty_state_view.dart';
import 'package:capital_care/core/widgets/status_badge.dart';
import 'package:capital_care/features/tasks_and_followups/models/followup_model.dart';
import 'package:capital_care/features/tasks_and_followups/models/task_model.dart';
import 'package:capital_care/features/tasks_and_followups/providers/tasks_provider.dart';
import 'package:capital_care/features/tasks_and_followups/views/add_task_dialog.dart';

class TasksAndFollowupsScreen extends ConsumerStatefulWidget {
  final int initialTabIndex;

  const TasksAndFollowupsScreen({super.key, this.initialTabIndex = 0});

  @override
  ConsumerState<TasksAndFollowupsScreen> createState() => _TasksAndFollowupsScreenState();
}

class _TasksAndFollowupsScreenState extends ConsumerState<TasksAndFollowupsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this, initialIndex: widget.initialTabIndex);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      drawer: const AppDrawer(),
      appBar: AppBar(
        leading: Builder(
          builder: (ctx) => IconButton(
            icon: const Icon(Icons.menu_rounded),
            tooltip: 'Open Menu',
            onPressed: () => Scaffold.of(ctx).openDrawer(),
          ),
        ),
        title: const Text('Tasks & Follow-ups'),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          tabs: const [
            Tab(text: 'Follow-up Reminders'),
            Tab(text: 'My Tasks'),
          ],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        icon: const Icon(Icons.add_task, color: Colors.white),
        label: const Text('Add Task', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        onPressed: () {
          showDialog(
            context: context,
            builder: (ctx) => const AddTaskDialog(),
          );
        },
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildFollowUpsTab(),
          _buildTasksTab(),
        ],
      ),
    );
  }

  Widget _buildFollowUpsTab() {
    final state = ref.watch(followUpsNotifierProvider);
    final windows = [
      {'label': 'Today', 'value': 'today'},
      {'label': 'Overdue', 'value': 'overdue'},
      {'label': 'Upcoming', 'value': 'upcoming'},
      {'label': 'All', 'value': 'all'},
    ];

    return Column(
      children: [
        // Window Chips
        Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: windows.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final item = windows[index];
              final isSelected = state.selectedWindow == item['value'];
              return ChoiceChip(
                label: Text(item['label']!),
                selected: isSelected,
                selectedColor: AppColors.primary,
                labelStyle: TextStyle(
                  color: isSelected ? Colors.white : AppColors.textPrimary,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                  fontSize: 12,
                ),
                backgroundColor: AppColors.surface,
                side: BorderSide(color: isSelected ? AppColors.primary : AppColors.cardBorder),
                onSelected: (selected) {
                  if (selected) {
                    ref.read(followUpsNotifierProvider.notifier).setWindow(item['value']!);
                  }
                },
              );
            },
          ),
        ),

        Expanded(
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.read(followUpsNotifierProvider.notifier).loadFollowUps(),
            child: _buildFollowUpsList(state),
          ),
        ),
      ],
    );
  }

  Widget _buildFollowUpsList(FollowUpsState state) {
    if (state.isLoading && state.followUps.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    if (state.error != null && state.followUps.isEmpty) {
      return Center(
        child: EmptyStateView(
          icon: Icons.error_outline,
          title: 'Error loading follow-ups',
          message: state.error!,
          actionLabel: 'Retry',
          onAction: () => ref.read(followUpsNotifierProvider.notifier).loadFollowUps(),
        ),
      );
    }

    if (state.followUps.isEmpty) {
      return const Center(
        child: EmptyStateView(
          icon: Icons.event_available_outlined,
          title: 'No pending follow-ups',
          message: 'All customer meetings and follow-ups are up to date',
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: state.followUps.length,
      itemBuilder: (context, index) {
        final f = state.followUps[index];
        return _buildFollowUpCard(f);
      },
    );
  }

  Widget _buildFollowUpCard(FollowUpModel f) {
    final formattedDate = f.scheduledAt != null
        ? DateFormat('dd MMM yyyy, hh:mm a').format(f.scheduledAt!)
        : 'Unscheduled';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: f.isOverdue ? AppColors.error.withValues(alpha: 0.5) : AppColors.cardBorder,
        ),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 6, offset: const Offset(0, 2)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    f.isOverdue ? Icons.warning_amber_rounded : Icons.schedule,
                    color: f.isOverdue ? AppColors.error : AppColors.primary,
                    size: 18,
                  ),
                  const SizedBox(width: 8),
                  Text(
                    formattedDate,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: f.isOverdue ? AppColors.error : AppColors.textPrimary,
                    ),
                  ),
                ],
              ),
              StatusBadge(status: f.status),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    f.customerName ?? 'Customer',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                  ),
                  if (f.customerNumber != null)
                    Text(
                      f.customerNumber!,
                      style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    ),
                ],
              ),
              Row(
                children: [
                  if (f.customerNumber != null)
                    IconButton(
                      icon: const Icon(Icons.phone, color: AppColors.primary, size: 20),
                      onPressed: () async {
                        await FlutterPhoneDirectCaller.callNumber(f.customerNumber!);
                      },
                    ),
                  if (f.status != 'COMPLETED')
                    IconButton(
                      icon: const Icon(Icons.check_circle_outline, color: AppColors.success, size: 22),
                      tooltip: 'Mark Complete',
                      onPressed: () async {
                        await ref.read(followUpsNotifierProvider.notifier).completeFollowUp(f.id);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Follow-up marked completed!'), backgroundColor: AppColors.success),
                          );
                        }
                      },
                    ),
                ],
              ),
            ],
          ),
          if (f.remarks != null && f.remarks!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              'Notes: ${f.remarks!}',
              style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: AppColors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTasksTab() {
    final state = ref.watch(tasksNotifierProvider);

    return Column(
      children: [
        // Status & Priority Filters
        Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          child: Row(
            children: [
              _buildTaskFilterChip('All', 'ALL', state.selectedStatus, (v) {
                ref.read(tasksNotifierProvider.notifier).setStatus(v);
              }),
              const SizedBox(width: 8),
              _buildTaskFilterChip('Pending', 'PENDING', state.selectedStatus, (v) {
                ref.read(tasksNotifierProvider.notifier).setStatus(v);
              }),
              const SizedBox(width: 8),
              _buildTaskFilterChip('Completed', 'COMPLETED', state.selectedStatus, (v) {
                ref.read(tasksNotifierProvider.notifier).setStatus(v);
              }),
            ],
          ),
        ),

        Expanded(
          child: RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () async => ref.read(tasksNotifierProvider.notifier).loadTasks(),
            child: _buildTasksList(state),
          ),
        ),
      ],
    );
  }

  Widget _buildTaskFilterChip(String label, String value, String current, ValueChanged<String> onSelected) {
    final isSelected = current == value;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      selectedColor: AppColors.primary,
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : AppColors.textPrimary,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
        fontSize: 12,
      ),
      backgroundColor: AppColors.surface,
      side: BorderSide(color: isSelected ? AppColors.primary : AppColors.cardBorder),
      onSelected: (sel) {
        if (sel) onSelected(value);
      },
    );
  }

  Widget _buildTasksList(TasksState state) {
    if (state.isLoading && state.tasks.isEmpty) {
      return const Center(child: CircularProgressIndicator(color: AppColors.primary));
    }

    if (state.error != null && state.tasks.isEmpty) {
      return Center(
        child: EmptyStateView(
          icon: Icons.error_outline,
          title: 'Error loading tasks',
          message: state.error!,
          actionLabel: 'Retry',
          onAction: () => ref.read(tasksNotifierProvider.notifier).loadTasks(),
        ),
      );
    }

    if (state.tasks.isEmpty) {
      return Center(
        child: EmptyStateView(
          icon: Icons.task_alt,
          title: 'No tasks found',
          message: 'Create a task to keep track of your loan operations and to-dos',
          actionLabel: 'Add Task',
          onAction: () {
            showDialog(
              context: context,
              builder: (ctx) => const AddTaskDialog(),
            );
          },
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: state.tasks.length,
      itemBuilder: (context, index) {
        final task = state.tasks[index];
        return _buildTaskCard(task);
      },
    );
  }

  Widget _buildTaskCard(TaskModel task) {
    final formattedDue = task.dueDate != null
        ? DateFormat('dd MMM yyyy').format(task.dueDate!)
        : 'No due date';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Checkbox(
            value: task.isCompleted,
            activeColor: AppColors.success,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
            onChanged: (_) {
              ref.read(tasksNotifierProvider.notifier).toggleTaskStatus(task);
            },
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    decoration: task.isCompleted ? TextDecoration.lineThrough : null,
                    color: task.isCompleted ? AppColors.textMuted : AppColors.textPrimary,
                  ),
                ),
                if (task.description != null && task.description!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    task.description!,
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ],
                const SizedBox(height: 8),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: _getPriorityColor(task.priority).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        task.priority,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: _getPriorityColor(task.priority),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Icon(Icons.event, size: 12, color: AppColors.textMuted),
                    const SizedBox(width: 4),
                    Text(
                      formattedDue,
                      style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Color _getPriorityColor(String priority) {
    switch (priority.toUpperCase()) {
      case 'HIGH':
      case 'URGENT':
        return AppColors.error;
      case 'MEDIUM':
        return AppColors.warning;
      case 'LOW':
        return AppColors.info;
      default:
        return AppColors.textSecondary;
    }
  }
}
