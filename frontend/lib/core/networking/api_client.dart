import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_exception.dart';

class SubscriptionEvent {
  final String code;
  final String message;
  final String? expiredAt;
  final String? planStatus;

  SubscriptionEvent({
    required this.code,
    required this.message,
    this.expiredAt,
    this.planStatus,
  });
}

class ApiClient {
  static const _storage = FlutterSecureStorage();
  static const String tokenKey = 'auth_token';

  static final _subscriptionEventsController = StreamController<SubscriptionEvent>.broadcast();
  static Stream<SubscriptionEvent> get onSubscriptionEvent => _subscriptionEventsController.stream;

  static void notifySubscriptionExpired(String message, {String? expiredAt}) {
    _subscriptionEventsController.add(
      SubscriptionEvent(
        code: 'SUBSCRIPTION_EXPIRED',
        message: message,
        expiredAt: expiredAt,
        planStatus: 'expired',
      ),
    );
  }

  static Future<String?> getToken() async {
    return await _storage.read(key: tokenKey);
  }

  static Future<void> saveToken(String token) async {
    await _storage.write(key: tokenKey, value: token);
  }

  static Future<void> clearToken() async {
    await _storage.delete(key: tokenKey);
  }

  static Future<Map<String, String>> _getHeaders({bool isJson = true}) async {
    final token = await getToken();
    final headers = <String, String>{
      'x-source-panel': 'Mobile App',
    };
    if (isJson) {
      headers['Content-Type'] = 'application/json';
      headers['Accept'] = 'application/json';
    }
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    return headers;
  }

  static dynamic _handleResponse(http.Response response) {
    dynamic body;
    try {
      body = jsonDecode(response.body);
    } catch (_) {
      body = response.body;
    }

    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }

    final code = (body is Map && body.containsKey('code')) ? body['code']?.toString() : null;
    final message = (body is Map && body.containsKey('message'))
        ? body['message'].toString()
        : 'Request failed with status ${response.statusCode}';

    final exception = ApiException(message, statusCode: response.statusCode, details: body, code: code);

    if (exception.isSubscriptionExpired || exception.isCompanySuspended) {
      _subscriptionEventsController.add(
        SubscriptionEvent(
          code: code ?? (exception.isCompanySuspended ? 'COMPANY_SUSPENDED' : 'SUBSCRIPTION_EXPIRED'),
          message: message,
          expiredAt: exception.expiredAt,
          planStatus: (body is Map) ? body['planStatus']?.toString() : null,
        ),
      );
    }

    throw exception;
  }

  // GET Request
  static Future<dynamic> get(
    String url, {
    Map<String, dynamic>? queryParams,
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      var uri = Uri.parse(url);
      final params = queryParams ?? queryParameters;
      if (params != null && params.isNotEmpty) {
        final stringParams = params.map((k, v) => MapEntry(k, v?.toString() ?? ''));
        stringParams.removeWhere((k, v) => v.isEmpty);
        uri = uri.replace(queryParameters: stringParams);
      }

      final headers = await _getHeaders();
      final response = await http.get(uri, headers: headers).timeout(const Duration(seconds: 20));
      return _handleResponse(response);
    } on SocketException {
      throw ApiException('No internet connection or server unreachable');
    } on http.ClientException {
      throw ApiException('Connection error to server');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  // POST Request
  static Future<dynamic> post(String url, {Map<String, dynamic>? body}) async {
    try {
      final uri = Uri.parse(url);
      final headers = await _getHeaders();
      final response = await http
          .post(uri, headers: headers, body: jsonEncode(body ?? {}))
          .timeout(const Duration(seconds: 25));
      return _handleResponse(response);
    } on SocketException {
      throw ApiException('No internet connection or server unreachable');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  // PUT Request
  static Future<dynamic> put(String url, {Map<String, dynamic>? body}) async {
    try {
      final uri = Uri.parse(url);
      final headers = await _getHeaders();
      final response = await http
          .put(uri, headers: headers, body: jsonEncode(body ?? {}))
          .timeout(const Duration(seconds: 25));
      return _handleResponse(response);
    } on SocketException {
      throw ApiException('No internet connection or server unreachable');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  // PATCH Request
  static Future<dynamic> patch(String url, {Map<String, dynamic>? body}) async {
    try {
      final uri = Uri.parse(url);
      final headers = await _getHeaders();
      final response = await http
          .patch(uri, headers: headers, body: jsonEncode(body ?? {}))
          .timeout(const Duration(seconds: 25));
      return _handleResponse(response);
    } on SocketException {
      throw ApiException('No internet connection or server unreachable');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  // DELETE Request
  static Future<dynamic> delete(String url) async {
    try {
      final uri = Uri.parse(url);
      final headers = await _getHeaders();
      final response = await http.delete(uri, headers: headers).timeout(const Duration(seconds: 20));
      return _handleResponse(response);
    } on SocketException {
      throw ApiException('No internet connection or server unreachable');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }

  // Multipart File Upload
  static Future<dynamic> uploadFile(
    String url, {
    String? filePath,
    File? file,
    String fileFieldName = 'file',
    String? fileField,
    Map<String, String>? fields,
  }) async {
    final effectiveFile = file ?? (filePath != null ? File(filePath) : null);
    if (effectiveFile == null) {
      throw ApiException('File path or File object must be provided');
    }

    try {
      final uri = Uri.parse(url);
      final request = http.MultipartRequest('POST', uri);
      final headers = await _getHeaders(isJson: false);
      request.headers.addAll(headers);

      if (fields != null) {
        request.fields.addAll(fields);
      }

      request.files.add(await http.MultipartFile.fromPath(fileField ?? fileFieldName, effectiveFile.path));

      final streamedResponse = await request.send().timeout(const Duration(seconds: 60));
      final response = await http.Response.fromStream(streamedResponse);
      return _handleResponse(response);
    } on SocketException {
      throw ApiException('No internet connection or server unreachable');
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(e.toString());
    }
  }
}
