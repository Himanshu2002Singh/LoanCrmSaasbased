import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_phone_direct_caller/flutter_phone_direct_caller.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:capital_care/core/constants/app_colors.dart';
import 'package:capital_care/core/widgets/app_drawer.dart';
import 'package:capital_care/core/widgets/status_badge.dart';
import 'package:capital_care/features/leads/models/lead_model.dart';
import 'package:capital_care/features/leads/services/lead_service.dart';
import 'package:capital_care/features/leads/views/add_lead_screen.dart';
import 'package:capital_care/features/telecalling/views/log_call_dialog.dart';

class DialerScreen extends ConsumerStatefulWidget {
  final String? initialNumber;
  final bool isBottomSheet;

  const DialerScreen({
    super.key,
    this.initialNumber,
    this.isBottomSheet = false,
  });

  static Future<void> showAsBottomSheet(BuildContext context, {String? initialNumber}) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => FractionallySizedBox(
        heightFactor: 0.88,
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          child: DialerScreen(
            initialNumber: initialNumber,
            isBottomSheet: true,
          ),
        ),
      ),
    );
  }

  @override
  ConsumerState<DialerScreen> createState() => _DialerScreenState();
}

class _DialerScreenState extends ConsumerState<DialerScreen> {
  final TextEditingController _numberController = TextEditingController();
  final LeadService _leadsService = LeadService();

  LeadModel? _matchedLead;
  bool _isSearching = false;
  Timer? _debounceTimer;

  @override
  void initState() {
    super.initState();
    if (widget.initialNumber != null && widget.initialNumber!.isNotEmpty) {
      _numberController.text = widget.initialNumber!;
      _onNumberChanged(widget.initialNumber!);
    }
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _numberController.dispose();
    super.dispose();
  }

  void _onKeyTap(String value) {
    HapticFeedback.lightImpact();
    final text = _numberController.text;
    final selection = _numberController.selection;
    final int start = selection.start >= 0 ? selection.start : text.length;
    final int end = selection.end >= 0 ? selection.end : text.length;

    final newText = text.replaceRange(start, end, value);
    _numberController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: start + value.length),
    );
    _onNumberChanged(newText);
  }

  void _onBackspace() {
    HapticFeedback.selectionClick();
    final text = _numberController.text;
    final selection = _numberController.selection;
    final int start = selection.start >= 0 ? selection.start : text.length;
    final int end = selection.end >= 0 ? selection.end : text.length;

    if (start == 0 && end == 0) return;

    String newText;
    int newOffset;
    if (start == end) {
      newText = text.replaceRange(start - 1, start, '');
      newOffset = start - 1;
    } else {
      newText = text.replaceRange(start, end, '');
      newOffset = start;
    }

    _numberController.value = TextEditingValue(
      text: newText,
      selection: TextSelection.collapsed(offset: newOffset),
    );
    _onNumberChanged(newText);
  }

  void _onClearAll() {
    HapticFeedback.mediumImpact();
    _numberController.clear();
    _onNumberChanged('');
  }

  Future<void> _handlePaste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    if (data?.text != null) {
      final clean = data!.text!.replaceAll(RegExp(r'[^0-9+*#]'), '');
      if (clean.isNotEmpty) {
        _numberController.text = clean;
        _numberController.selection = TextSelection.collapsed(offset: clean.length);
        _onNumberChanged(clean);
      }
    }
  }

  void _onNumberChanged(String value) {
    _debounceTimer?.cancel();
    final query = value.replaceAll(RegExp(r'\D'), '');

    if (query.length < 3) {
      if (mounted) {
        setState(() {
          _matchedLead = null;
          _isSearching = false;
        });
      }
      return;
    }

    setState(() => _isSearching = true);

    _debounceTimer = Timer(const Duration(milliseconds: 350), () async {
      try {
        final result = await _leadsService.getLeads(search: query, limit: 5);
        if (!mounted) return;

        // Find best match matching the phone number
        LeadModel? bestMatch;
        for (final l in result.leads) {
          final leadNum = l.number.replaceAll(RegExp(r'\D'), '');
          if (leadNum.contains(query) || query.contains(leadNum)) {
            bestMatch = l;
            break;
          }
        }

        // Fallback to first search result if any
        if (bestMatch == null && result.leads.isNotEmpty) {
          bestMatch = result.leads.first;
        }

        setState(() {
          _matchedLead = bestMatch;
          _isSearching = false;
        });
      } catch (e) {
        if (mounted) {
          setState(() {
            _matchedLead = null;
            _isSearching = false;
          });
        }
      }
    });
  }

  Future<void> _makeCall() async {
    final number = _numberController.text.trim();
    if (number.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a phone number to call')),
      );
      return;
    }

    var status = await Permission.phone.status;
    if (!status.isGranted) {
      status = await Permission.phone.request();
    }

    try {
      await FlutterPhoneDirectCaller.callNumber(number);

      if (!mounted) return;

      // After invoking the system dialer, prompt to log or create lead
      if (_matchedLead != null) {
        showDialog(
          context: context,
          builder: (ctx) => LogCallDialog(lead: _matchedLead!),
        );
      } else {
        _showNewLeadPrompt(number);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not place call: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  void _showNewLeadPrompt(String number) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.person_add_alt_1_rounded, color: AppColors.primary, size: 28),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'New Contact Called',
                            style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                          ),
                          Text(
                            number,
                            style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                const Text(
                  'Would you like to register this contact as a new lead in CRM?',
                  style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: () {
                    Navigator.pop(ctx);
                    if (widget.isBottomSheet) {
                      Navigator.pop(context);
                    }
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => AddLeadScreen(initialMobile: number),
                      ),
                    );
                  },
                  icon: const Icon(Icons.add_circle_outline, color: Colors.white),
                  label: const Text('Create New Lead', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 10),
                OutlinedButton(
                  onPressed: () => Navigator.pop(ctx),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Dismiss'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      drawer: widget.isBottomSheet ? null : const AppDrawer(),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: widget.isBottomSheet
            ? IconButton(
                icon: const Icon(Icons.close_rounded, color: AppColors.textPrimary),
                onPressed: () => Navigator.pop(context),
              )
            : Builder(
                builder: (ctx) => IconButton(
                  icon: const Icon(Icons.menu_rounded, color: AppColors.textPrimary),
                  tooltip: 'Open Menu',
                  onPressed: () => Scaffold.of(ctx).openDrawer(),
                ),
              ),
        title: const Text(
          'Smart Dialer',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.content_paste_rounded, color: AppColors.textSecondary),
            tooltip: 'Paste Number',
            onPressed: _handlePaste,
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Lead Lookup Preview Card
            _buildLeadPreviewHeader(),

            // Linear search indicator
            if (_isSearching)
              const LinearProgressIndicator(
                minHeight: 2,
                color: AppColors.primary,
                backgroundColor: Colors.transparent,
              )
            else
              const SizedBox(height: 2),

            const Spacer(),

            // Number Input Display Field
            _buildNumberDisplay(),

            const SizedBox(height: 12),

            // Dialer Keypad
            _buildKeypad(),

            const SizedBox(height: 16),

            // Bottom Actions (Call Button & Backspace)
            _buildBottomCallBar(),

            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }

  Widget _buildLeadPreviewHeader() {
    if (_matchedLead != null) {
      final lead = _matchedLead!;
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.08),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: AppColors.primary.withValues(alpha: 0.15),
              child: Text(
                lead.name.isNotEmpty ? lead.name[0].toUpperCase() : 'L',
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppColors.primary,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          lead.name,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: AppColors.textPrimary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 6),
                      StatusBadge(
                        status: lead.status,
                        fontSize: 10,
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    '${lead.loanType ?? "Lead"} • ${lead.formattedAmount}',
                    style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: AppColors.primary),
              tooltip: 'View Lead',
              onPressed: () {
                if (widget.isBottomSheet) Navigator.pop(context);
                context.push('/leads/${lead.id}');
              },
            ),
          ],
        ),
      );
    }

    if (_numberController.text.length >= 7 && !_isSearching) {
      return Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.amber.shade50,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: Colors.amber.shade300),
        ),
        child: Row(
          children: [
            Icon(Icons.info_outline_rounded, size: 20, color: Colors.amber.shade800),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'New contact not in CRM',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.amber.shade900,
                ),
              ),
            ),
            TextButton(
              onPressed: () {
                final num = _numberController.text.trim();
                if (widget.isBottomSheet) Navigator.pop(context);
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => AddLeadScreen(initialMobile: num)),
                );
              },
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: const Text(
                '+ Add Lead',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary),
              ),
            ),
          ],
        ),
      );
    }

    return const SizedBox(height: 48);
  }

  Widget _buildNumberDisplay() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24),
      child: TextField(
        controller: _numberController,
        readOnly: true,
        showCursor: true,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 32,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.5,
          color: AppColors.textPrimary,
        ),
        decoration: InputDecoration(
          hintText: 'Enter number',
          hintStyle: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w400,
            color: AppColors.textMuted.withValues(alpha: 0.5),
            letterSpacing: 1.0,
          ),
          border: InputBorder.none,
          contentPadding: EdgeInsets.zero,
        ),
      ),
    );
  }

  Widget _buildKeypad() {
    const keys = [
      {'digit': '1', 'letters': ''},
      {'digit': '2', 'letters': 'A B C'},
      {'digit': '3', 'letters': 'D E F'},
      {'digit': '4', 'letters': 'G H I'},
      {'digit': '5', 'letters': 'J K L'},
      {'digit': '6', 'letters': 'M N O'},
      {'digit': '7', 'letters': 'P Q R S'},
      {'digit': '8', 'letters': 'T U V'},
      {'digit': '9', 'letters': 'W X Y Z'},
      {'digit': '*', 'letters': ''},
      {'digit': '0', 'letters': '+'},
      {'digit': '#', 'letters': ''},
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: keys.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 3,
          crossAxisSpacing: 24,
          mainAxisSpacing: 14,
          childAspectRatio: 1.35,
        ),
        itemBuilder: (context, index) {
          final item = keys[index];
          final digit = item['digit']!;
          final letters = item['letters']!;

          return _buildKeypadButton(
            digit: digit,
            letters: letters,
            onTap: () => _onKeyTap(digit),
            onLongPress: digit == '0' ? () => _onKeyTap('+') : null,
          );
        },
      ),
    );
  }

  Widget _buildKeypadButton({
    required String digit,
    required String letters,
    required VoidCallback onTap,
    VoidCallback? onLongPress,
  }) {
    return Material(
      color: Colors.grey.shade100,
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        splashColor: AppColors.primary.withValues(alpha: 0.2),
        highlightColor: AppColors.primary.withValues(alpha: 0.1),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                digit,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                  height: 1.1,
                ),
              ),
              if (letters.isNotEmpty)
                Text(
                  letters,
                  style: TextStyle(
                    fontSize: 8.5,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.8,
                    color: AppColors.textSecondary.withValues(alpha: 0.8),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBottomCallBar() {
    final hasInput = _numberController.text.isNotEmpty;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 40),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          // Left Placeholder / WhatsApp / Paste
          SizedBox(
            width: 56,
            height: 56,
            child: hasInput
                ? IconButton(
                    icon: const Icon(Icons.copy_rounded, color: AppColors.textSecondary),
                    tooltip: 'Copy Number',
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: _numberController.text));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Copied number to clipboard'), duration: Duration(seconds: 1)),
                      );
                    },
                  )
                : const SizedBox.shrink(),
          ),

          // Main Call Button
          GestureDetector(
            onTap: _makeCall,
            child: Container(
              width: 68,
              height: 68,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: const LinearGradient(
                  colors: [Color(0xFF2E7D32), Color(0xFF43A047)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF2E7D32).withValues(alpha: 0.35),
                    blurRadius: 14,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: const Center(
                child: Icon(Icons.call_rounded, color: Colors.white, size: 32),
              ),
            ),
          ),

          // Backspace Button
          SizedBox(
            width: 56,
            height: 56,
            child: hasInput
                ? IconButton(
                    icon: const Icon(Icons.backspace_outlined, color: AppColors.textSecondary),
                    onPressed: _onBackspace,
                    onLongPress: _onClearAll,
                    tooltip: 'Delete',
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }
}
