import 'package:dio/dio.dart';
import 'package:dio/browser.dart';

void configureWeb(Dio dio) {
  dio.httpClientAdapter = BrowserHttpClientAdapter()..withCredentials = true;
}
