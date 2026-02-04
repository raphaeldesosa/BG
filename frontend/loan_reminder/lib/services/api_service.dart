import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/user.dart';

class ApiService {
  static const String baseUrl = 'http://127.0.0.1:8000';

  static Future<DateTime?> createUser({
    required String name,
    required String email,
    required String contact,
    required String accountNumber,
  }) async {
    final url = Uri.parse('$baseUrl/users');
    final body = jsonEncode({
      'name': name,
      'email': email,
      'contact': contact,
      'account_number': accountNumber,
    });

    try {
      final response = await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: body,
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body);
        return DateTime.parse(data['due_date']);
      } else {
        print('Error creating user: ${response.statusCode}');
        return null;
      }
    } catch (e) {
      print('Exception creating user: $e');
      return null;
    }
  }

  static Future<List<User>?> getAllUsers() async {
    final url = Uri.parse('$baseUrl/users');
    try {
      final response = await http.get(url);
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        return data.map((json) => User.fromJson(json)).toList();
      } else {
        print('Error fetching users: ${response.statusCode}');
        return null;
      }
    } catch (e) {
      print('Exception fetching users: $e');
      return null;
    }
  }

  static Future<bool> deleteUser(int id) async {
    final url = Uri.parse('$baseUrl/users/$id');
    try {
      final response = await http.delete(url);
      return response.statusCode == 200;
    } catch (e) {
      print('Exception deleting user: $e');
      return false;
    }
  }
}
