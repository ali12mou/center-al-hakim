import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:al_hakim_mobile/core/api.dart';
import 'package:al_hakim_mobile/core/theme.dart';
import 'package:al_hakim_mobile/shell.dart';
import 'package:al_hakim_mobile/auth/login.dart';

class FakeApi extends PortalApi {
  FakeApi(super.role);
  @override
  Future<Json> get(String path, {Json? query}) async {
    if (path == '/home') {
      return {
        'centre': {
          'phone': '+253 77 70 34 36',
          'phoneLink': '+25377703436',
          'email': 'info@example.com',
          'whatsapp': '25377703436',
        },
        'about': {
          'title': 'Notre centre',
          'description': 'Formation et accompagnement.',
        },
        'banners': [],
        'sessions': [],
        'lessons': [],
        'announcements': [],
        'courses': [],
      };
    }
    if (path == '/me') return {'accounts': [], 'payments': [], 'invoices': []};
    if (path == '/progress') {
      return {
        'grades': [],
        'attendance': [],
        'stats': {'rate': null, 'average': null},
      };
    }
    if (path == '/stats') {
      return {
        'total': 0,
        'interested': 0,
        'enrolled': 0,
        'followUps': 0,
        'conversion': 0,
        'byStatus': {},
      };
    }
    return {'items': [], 'pages': 1};
  }
}

void main() {
  testWidgets(
    'Chaque rôle arrive sur un accueil personnel; navigation mobile sans débordement',
    (tester) async {
      tester.view.physicalSize = const Size(390, 844);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      for (final role in ['student', 'marketing']) {
        await tester.pumpWidget(
          MaterialApp(
            theme: portalTheme(),
            home: PortalShell(
              key: ValueKey(role),
              api: FakeApi(role),
              user: {'id': role, 'name': 'Fathia Test'},
              onLogout: () {},
              onPassword: () {},
            ),
          ),
        );
        await tester.pumpAndSettle();
        expect(find.text('Bonjour Fathia,'), findsOneWidget);
        expect(find.byType(NavigationBar), findsOneWidget);
        expect(tester.takeException(), isNull);
        await tester.tap(find.text('Plus'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('Tableau de bord').last);
        await tester.pumpAndSettle();
        expect(find.text('Mon tableau de bord'), findsOneWidget);
        expect(tester.takeException(), isNull);
      }
    },
  );
  testWidgets(
    'Navigation latérale sur ordinateur et formulaire de connexion utilisable',
    (tester) async {
      tester.view.physicalSize = const Size(1400, 1000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          theme: portalTheme(),
          home: PortalShell(
            api: FakeApi('student'),
            user: {'id': 'one', 'name': 'Test'},
            onLogout: () {},
            onPassword: () {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.byType(NavigationBar), findsNothing);
      expect(find.text('Tableau de bord'), findsAtLeastNWidgets(1));
      expect(tester.takeException(), isNull);
      String? identity;
      await tester.pumpWidget(
        MaterialApp(
          theme: portalTheme(),
          home: LoginScreen(
            role: 'student',
            onRole: (_) {},
            onLogin: (name, password) async {
              identity = name;
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField).first, 'etudiant');
      await tester.enterText(
        find.byType(TextFormField).last,
        'Exemple-Securise-2026',
      );
      await tester.tap(find.text('Me connecter'));
      await tester.pumpAndSettle();
      expect(identity, 'etudiant');
      expect(tester.takeException(), isNull);
    },
  );
}
