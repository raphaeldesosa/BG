class User {
  final int id;
  final String name;
  final String email;
  final String contact;
  final String accountNumber;
  final DateTime dueDate;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.contact,
    required this.accountNumber,
    required this.dueDate,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    // Parse dueDate safely
    DateTime parsedDueDate;
    if (json['due_date'] != null) {
      parsedDueDate = DateTime.tryParse(json['due_date']) ?? DateTime.now();
    } else {
      parsedDueDate = DateTime.now();
    }

    return User(
      id: json['id'],
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      contact: json['contact'] ?? '',
      accountNumber: json['account_number'] ?? '',
      dueDate: parsedDueDate,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'email': email,
      'contact': contact,
      'account_number': accountNumber,
      'due_date': dueDate.toIso8601String(),
    };
  }
}
