import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'web_adapter.dart'
    if (dart.library.js_interop) 'web_adapter_browser.dart';

typedef Json = Map<String, dynamic>;
Json object(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : {};
List<Json> records(dynamic value) =>
    value is List ? value.map(object).toList() : [];
String label(dynamic value, [String fallback = 'À renseigner']) =>
    value == null || value.toString().isEmpty ? fallback : value.toString();
num amount(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;

class ApiFailure implements Exception {
  final String message;
  final int? status;
  final bool passwordRequired;
  const ApiFailure(this.message, {this.status, this.passwordRequired = false});
  @override
  String toString() => message;
}

class PortalApi {
  final String role;
  final Dio dio;
  final FlutterSecureStorage storage;
  String? cookie;
  String? csrf;
  VoidCallback? onExpired;
  static const base = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4100',
  );
  PortalApi(this.role, {Dio? client, FlutterSecureStorage? secureStorage})
    : dio =
          client ??
          Dio(
            BaseOptions(
              baseUrl: base,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 30),
            ),
          ),
      storage = secureStorage ?? const FlutterSecureStorage() {
    if (client == null) configureWeb(dio);
  }
  String get prefix => '/api/$role';
  String absolute(String path) =>
      Uri.parse(dio.options.baseUrl).resolve(path).toString();
  Future<void> restore() async {
    if (!kIsWeb) cookie = await storage.read(key: 'session_$role');
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    Json? body,
    Json? query,
    bool bytes = false,
  }) async {
    try {
      final response = await dio.request<dynamic>(
        path.startsWith('/api/') ? path : '$prefix$path',
        data: body,
        queryParameters: query,
        options: Options(
          method: method,
          responseType: bytes ? ResponseType.bytes : ResponseType.json,
          headers: {
            if (!kIsWeb && cookie != null) 'Cookie': cookie,
            if (csrf != null) 'X-CSRF-Token': csrf,
          },
        ),
      );
      if (!kIsWeb) {
        for (final entry in response.headers['set-cookie'] ?? <String>[]) {
          final match = RegExp('ah_$role=([^;]*)').firstMatch(entry);
          if (match != null && match.group(1)!.isNotEmpty) {
            cookie = 'ah_$role=${match.group(1)}';
            await storage.write(key: 'session_$role', value: cookie);
          }
        }
      }
      if (!bytes &&
          response.data is Map &&
          response.data['csrfToken'] != null) {
        csrf = response.data['csrfToken'] as String;
      }
      return bytes
          ? Uint8List.fromList(List<int>.from(response.data as List))
          : response.data;
    } on DioException catch (error) {
      final data = object(error.response?.data);
      if (error.response?.statusCode == 401 && !path.contains('/auth/login')) {
        onExpired?.call();
      }
      throw ApiFailure(
        label(
          data['error'],
          'Connexion impossible. Vérifiez votre réseau puis réessayez.',
        ),
        status: error.response?.statusCode,
        passwordRequired: data['passwordChangeRequired'] == true,
      );
    }
  }

  Future<Json> get(String path, {Json? query}) async =>
      object(await request(path, query: query));
  Future<Json> post(String path, Json body) async =>
      object(await request(path, method: 'POST', body: body));
  Future<Json> patch(String path, Json body) async =>
      object(await request(path, method: 'PATCH', body: body));
  Future<void> forget() async {
    cookie = null;
    csrf = null;
    if (!kIsWeb) await storage.delete(key: 'session_$role');
  }
}
