import 'package:capital_care/theme/appcolors.dart';
import 'package:flutter/material.dart';

class CustomAppbar extends StatelessWidget implements PreferredSizeWidget {
  final title;
  final leading;
  final List<Widget>? action;
  final backgroundColor;
  final textColor;
  const CustomAppbar({
    super.key,
    required this.title,
    this.leading,
    this.action,
    this.backgroundColor = AppColors.primaryColor,
    this.textColor = AppColors.appBarForegroundColor,
  });

  @override
  Widget build(BuildContext context) {
    return AppBar(
      title: Text(title),
      leading: leading,
      actions: action,
      backgroundColor: backgroundColor,
      foregroundColor: textColor,
    );
  }

  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}
