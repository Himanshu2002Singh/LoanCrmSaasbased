import 'package:flutter/material.dart';

class CustomHomeContainer extends StatelessWidget {
  final title;
  final elementIcons;
  const CustomHomeContainer({
    super.key,
    required this.title,
    required this.elementIcons,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      color: Colors.white,
      elevation: 3,
      child: Container(
        padding: EdgeInsets.all(10),
        width: MediaQuery.of(context).size.width,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17),
            ),
            GridView.builder(
              shrinkWrap: true,
              physics: NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 4,
              ),
              itemBuilder: (context, index) {
                return InkWell(
                  child: Container(
                    child: Column(
                      children: [Icon(elementIcons[index]), Text("book")],
                    ),
                  ),
                  onTap: () {},
                );
              },
              itemCount: 6,
            ),
          ],
        ),
      ),
    );
  }
}
