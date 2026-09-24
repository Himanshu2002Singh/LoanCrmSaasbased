import 'package:capital_care/models/leads_model.dart';
import 'package:flutter/material.dart';
import 'package:syncfusion_flutter_charts/charts.dart';

class DynamicPieChart extends StatelessWidget {
  final List<Leads> leads;

  DynamicPieChart({Key? key, required this.leads}) : super(key: key);

  final List<String> sources = [
    // "Internet",
    // "Newspaper",
    // "Website",
    "Self",
    "Refrence",
    "Bulk excel",
  ];

  final List<Color> pieColors = [
    Colors.red,
    Colors.blue,
    Colors.green,
    Colors.orange,
    Colors.purple,
  ];

  @override
  Widget build(BuildContext context) {
    // Count leads per source
    Map<String, int> sourceCounts = {for (var s in sources) s: 0};
    for (var lead in leads) {
      if (sourceCounts.containsKey(lead.source)) {
        sourceCounts[lead.source] = sourceCounts[lead.source]! + 1;
      }
    }

    final total = sourceCounts.values.fold(0, (a, b) => a + b);

    // Prepare chart data
    final chartData = <_ChartData>[];
    for (int i = 0; i < sources.length; i++) {
      final source = sources[i];
      final count = sourceCounts[source]!;
      if (count > 0) {
        final percent = total == 0 ? 0 : (count / total) * 100;
        chartData.add(
          _ChartData(
            source,
            count,
            "${percent.toStringAsFixed(1)}%",
            pieColors[i % pieColors.length],
          ),
        );
      }
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.blue.shade100),
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(color: Colors.black12, blurRadius: 5, offset: Offset(0, 2)),
        ],
      ),
      child: SfCircularChart(
        title: ChartTitle(text: 'Lead Sources'),
        legend: Legend(isVisible: false),
        series: <PieSeries<_ChartData, String>>[
          PieSeries<_ChartData, String>(
            dataSource: chartData,
            xValueMapper: (_ChartData data, _) => data.source,
            yValueMapper: (_ChartData data, _) => data.count,
            pointColorMapper: (_ChartData data, _) => data.color,
            dataLabelMapper:
                (_ChartData data, _) => '${data.source}\n${data.percent}',
            dataLabelSettings: const DataLabelSettings(
              isVisible: true,
              labelPosition: ChartDataLabelPosition.outside,
              connectorLineSettings: ConnectorLineSettings(
                type: ConnectorType.line,
                length: '10%',
                width: 1.2,
              ),
              textStyle: TextStyle(fontSize: 11),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChartData {
  final String source;
  final int count;
  final String percent;
  final Color color;

  _ChartData(this.source, this.count, this.percent, this.color);
}
