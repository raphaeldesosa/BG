import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../models/user.dart';
import 'package:intl/intl.dart';

class LenderDashboardScreen extends StatefulWidget {
  const LenderDashboardScreen({super.key});

  @override
  State<LenderDashboardScreen> createState() => _LenderDashboardScreenState();
}

class _LenderDashboardScreenState extends State<LenderDashboardScreen> {
  List<User> _users = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetchUsers();
  }

  Future<void> _fetchUsers() async {
    final users = await ApiService.getAllUsers();
    if (users != null && mounted) {
      setState(() {
        _users = users;
        _loading = false;
      });
    }
  }

  Future<void> _deleteUser(int id) async {
    final success = await ApiService.deleteUser(id);
    if (success) {
      setState(() {
        _users.removeWhere((user) => user.id == id);
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('User deleted successfully')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('PAY APP Dashboard'),
        backgroundColor: Colors.redAccent,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _users.isEmpty
              ? Center(
                  child: Text(
                    'No clients yet',
                    style: TextStyle(fontSize: 20, color: Colors.grey.shade600),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: _users.length,
                  itemBuilder: (context, index) {
                    final user = _users[index];
                    return Card(
                      elevation: 3,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10)),
                      margin: const EdgeInsets.symmetric(vertical: 8),
                      child: ListTile(
                        contentPadding: const EdgeInsets.all(16),
                        title: Text(
                          user.name,
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        subtitle: Text(
                          'Due: ${DateFormat.yMMMMd().format(user.dueDate)}\n'
                          'Contact: ${user.contact}',
                          style: const TextStyle(fontSize: 16),
                        ),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete, color: Colors.red),
                          onPressed: () => _deleteUser(user.id),
                        ),
                      ),
                    );
                  },
                ),
    );
  }
}
