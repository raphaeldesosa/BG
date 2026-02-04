import 'package:flutter/material.dart';
import '../models/user.dart';
import 'package:intl/intl.dart';

class LenderViewScreen extends StatelessWidget {
  final User borrower;

  const LenderViewScreen({super.key, required this.borrower});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(borrower.name)),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Name: ${borrower.name}'),
            Text('Email: ${borrower.email}'),
            Text('Contact: ${borrower.contact}'),
            Text('DSJ ID: ${borrower.accountNumber}'),
            Text('Loan Due: ${DateFormat.yMMMMd().format(borrower.dueDate)}'),
          ],
        ),
      ),
    );
  }
}
