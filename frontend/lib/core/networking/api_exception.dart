class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final dynamic details;
  final String? code;

  ApiException(this.message, {this.statusCode, this.details, this.code});

  bool get isSubscriptionExpired =>
      code == 'SUBSCRIPTION_EXPIRED' ||
      (details is Map && details['code'] == 'SUBSCRIPTION_EXPIRED') ||
      message.toLowerCase().contains('subscription has expired') ||
      message.toLowerCase().contains('subscription plan expired');

  bool get isCompanySuspended =>
      code == 'COMPANY_SUSPENDED' ||
      (details is Map && details['code'] == 'COMPANY_SUSPENDED') ||
      message.toLowerCase().contains('account has been suspended');

  String? get expiredAt => (details is Map) ? details['expiredAt']?.toString() : null;

  @override
  String toString() => message;
}
