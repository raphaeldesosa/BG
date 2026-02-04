import 'package:flutter/material.dart';
import '../services/api_service.dart';

class BorrowerFormScreen extends StatefulWidget {
  const BorrowerFormScreen({super.key});

  @override
  State<BorrowerFormScreen> createState() => _BorrowerFormScreenState();
}

class _BorrowerFormScreenState extends State<BorrowerFormScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _contactController = TextEditingController();
  final _accountController = TextEditingController();

  bool _loading = false;
  bool _submitted = false;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _contactController.dispose();
    _accountController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_nameController.text.isEmpty ||
        _emailController.text.isEmpty ||
        _contactController.text.isEmpty ||
        _accountController.text.isEmpty) {
      return;
    }

    setState(() => _loading = true);

    final dueDate = await ApiService.createUser(
      name: _nameController.text,
      email: _emailController.text,
      contact: _contactController.text,
      accountNumber: _accountController.text,
    );

    setState(() => _loading = false);

    if (dueDate != null && mounted) {
      setState(() => _submitted = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('PAY APP'),
        backgroundColor: Colors.redAccent,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            const SizedBox(height: 20),
            Text(
              'Enter Your Information',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: Colors.redAccent.shade700,
              ),
            ),
            const SizedBox(height: 20),
            if (!_submitted) ...[
              _buildTextField(_nameController, 'Full Name', Icons.person),
              const SizedBox(height: 16),
              _buildTextField(_emailController, 'Email', Icons.email),
              const SizedBox(height: 16),
              _buildTextField(_contactController, 'Contact Number', Icons.phone),
              const SizedBox(height: 16),
              _buildTextField(_accountController, 'DSJ ID / Account Number', Icons.badge),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton.icon(
                  onPressed: _loading ? null : _submit,
                  icon: _loading
                      ? const SizedBox(
                          width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.send),
                  label: Text(
                    _loading ? 'Submitting...' : 'Submit Info',
                    style: const TextStyle(fontSize: 18),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ] else ...[
              const SizedBox(height: 40),
              const Icon(Icons.check_circle, color: Colors.green, size: 100),
              const SizedBox(height: 24),
              const Text(
                '✅ Thank you! Your information has been submitted.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              Text(
                'The admin will be notified about your submission.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 16, color: Colors.grey.shade700),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildTextField(
      TextEditingController controller, String label, IconData icon) {
    return TextField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: Icon(icon),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        filled: true,
        fillColor: Colors.green.shade50,
      ),
    );
  }
}
