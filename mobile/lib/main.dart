import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'core/api.dart';
import 'core/theme.dart';
import 'auth/login.dart';
import 'shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AlHakimApp());
}

class AlHakimApp extends StatelessWidget {
  const AlHakimApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'AL-HAKIM CENTER',
    debugShowCheckedModeBanner: false,
    theme: portalTheme(),
    home: const SessionGate(),
  );
}

class SessionGate extends StatefulWidget {
  const SessionGate({super.key});
  @override
  State<SessionGate> createState() => _SessionGateState();
}

class _SessionGateState extends State<SessionGate> {
  final storage = const FlutterSecureStorage();
  late PortalApi api;
  String role = 'student';
  Json? user;
  bool loading = true, changePassword = false;
  String? error;
  @override
  void initState() {
    super.initState();
    restore();
  }

  void createApi() {
    api = PortalApi(role);
    api.onExpired = () {
      if (mounted) {
        setState(() {
          user = null;
          changePassword = false;
        });
      }
    };
  }

  Future<void> restore() async {
    try {
      role = await storage.read(key: 'last_role') ?? 'student';
      if (!['student', 'marketing'].contains(role)) role = 'student';
      createApi();
      await api.restore();
      final result = await api.get('/auth/status');
      if (mounted) {
        setState(
          () => user = result['user'] == null ? null : object(result['user']),
        );
      }
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> login(String identity, String password) async {
    final result = await api.post('/auth/login', {
      role == 'student' ? 'username' : 'email': identity,
      'password': password,
    });
    await storage.write(key: 'last_role', value: role);
    if (mounted) setState(() => user = object(result['user']));
  }

  Future<void> logout() async {
    try {
      await api.post('/auth/logout', {});
    } finally {
      await api.forget();
      if (mounted) {
        setState(() {
          user = null;
          changePassword = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (error != null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.cloud_off_outlined, size: 48),
                const SizedBox(height: 16),
                Text(error!, textAlign: TextAlign.center),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: () {
                    setState(() {
                      loading = true;
                      error = null;
                    });
                    restore();
                  },
                  child: const Text('Réessayer'),
                ),
                TextButton(
                  onPressed: () {
                    setState(() => error = null);
                  },
                  child: const Text('Aller à la connexion'),
                ),
              ],
            ),
          ),
        ),
      );
    }
    if (user == null) {
      return LoginScreen(
        role: role,
        onRole: (value) => setState(() {
          role = value;
          createApi();
        }),
        onLogin: login,
      );
    }
    if (user!['mustChangePassword'] == true || changePassword) {
      return PasswordScreen(
        api: api,
        onLogout: logout,
        onChanged: (result) => setState(() {
          user = object(result['user']);
          changePassword = false;
        }),
      );
    }
    return PortalShell(
      key: ValueKey('${role}_${user!['id']}'),
      api: api,
      user: user!,
      onLogout: logout,
      onPassword: () => setState(() => changePassword = true),
    );
  }
}
