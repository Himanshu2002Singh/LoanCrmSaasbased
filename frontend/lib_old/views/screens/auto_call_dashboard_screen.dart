import 'package:capital_care/theme/appcolors.dart';
import 'package:capital_care/views/widgets/app_scaffold.dart';
import 'package:capital_care/views/widgets/custom_appbar.dart';
import 'package:flutter/material.dart';

class AutoCallDashboard extends StatefulWidget {
  AutoCallDashboard({super.key});

  @override
  State<AutoCallDashboard> createState() => _AutoCallDashboardState();
}

class _AutoCallDashboardState extends State<AutoCallDashboard> {
  var sourcesItems = [
    // "Internet", "Newspaper", "Website",
    "Self",
    "Reference",
    "Bulk excel",
  ];
  String? selectedSource;
  TextEditingController fromDateController = TextEditingController();
  TextEditingController toDateController = TextEditingController();

  Future<void> _selectDate(
    BuildContext context,
    TextEditingController controller,
  ) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) {
      setState(() {
        controller.text = "${picked.day}-${picked.month}-${picked.year}";
      });
    }
  }

  void dispose() {
    fromDateController.dispose();
    toDateController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      isFloatingActionButton: false,
      appBar: CustomAppbar(title: 'AutoCall Dashboard'),
      body: Container(
        padding: EdgeInsets.all(20),
        width: double.infinity,
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [
              AppColors.primaryColor,
              Color.fromARGB(255, 199, 236, 253),
            ],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // const SizedBox(height: 20),
            // Dropdown and date pickers row
            DropdownButtonFormField<String>(
              decoration: InputDecoration(
                filled: true,
                fillColor: Colors.white,
                hintText: 'Select Source',

                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              dropdownColor: Colors.white,
              items:
                  sourcesItems.map((item) {
                    return DropdownMenuItem<String>(
                      child: Text(item),
                      value: item,
                    );
                  }).toList(),
              onChanged: (value) {
                setState(() {
                  selectedSource = value;
                });
              },
            ),

            const SizedBox(height: 10),
            // Date From and Date To
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: fromDateController,
                    readOnly: true,
                    onTap: () => _selectDate(context, fromDateController),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.white,
                      hintText: 'Date From',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      suffixIcon: const Icon(Icons.calendar_today),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextFormField(
                    controller: toDateController,
                    readOnly: true,
                    onTap: () => _selectDate(context, toDateController),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.white,
                      hintText: 'Date To',
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      suffixIcon: const Icon(Icons.calendar_today),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            // GO Button
            ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                // shape: const CircleBorder(),
                // padding: const EdgeInsets.all(15),
              ),
              child: const Text('GO', style: TextStyle(color: Colors.blue)),
            ),
            const SizedBox(height: 20),
            // Stats Card
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: const [
                    BoxShadow(color: Colors.black26, blurRadius: 4),
                  ],
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Circular total count
                    Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.grey, width: 10),
                      ),
                      child: const Center(
                        child: Text(
                          'Total\n0',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    // Icons row
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: const [
                          Column(
                            children: [
                              Icon(Icons.autorenew, color: Colors.grey),
                              SizedBox(height: 4),
                              Text('0 Fresh Leads'),
                            ],
                          ),
                          Column(
                            children: [
                              Icon(Icons.call, color: Colors.green),
                              SizedBox(height: 4),
                              Text('0 DONE'),
                            ],
                          ),
                          Column(
                            children: [
                              Icon(Icons.call_end, color: Colors.red),
                              SizedBox(height: 4),
                              Text('0 Failed'),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
