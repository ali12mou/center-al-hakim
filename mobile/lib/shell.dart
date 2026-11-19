import 'package:flutter/material.dart';

import 'core/api.dart';
import 'core/theme.dart';
import 'widgets/common.dart';
import 'student/pages.dart';
import 'student/account.dart';
import 'marketing/pages.dart';

const studentMenus = <(String, String, IconData)>[
  ('home', 'Accueil', Icons.home_outlined),
  ('dashboard', 'Tableau de bord', Icons.space_dashboard_outlined),
  ('cours', 'Mes cours', Icons.menu_book_outlined),
  ('suivi', 'Mon suivi', Icons.insights_outlined),
  ('paiements', 'Mes paiements', Icons.account_balance_wallet_outlined),
  ('annonces', 'Annonces', Icons.notifications_outlined),
  ('profil', 'Mon profil', Icons.person_outline),
  ('carte', 'Carte étudiant', Icons.badge_outlined),
];
const marketingMenus = <(String, String, IconData)>[
  ('home', 'Accueil', Icons.home_outlined),
  ('dashboard', 'Tableau de bord', Icons.space_dashboard_outlined),
  ('prospects', 'Mes prospects', Icons.people_outline),
  ('ajouter', 'Ajouter un prospect', Icons.person_add_alt),
  ('relances', 'Mes relances', Icons.event_outlined),
  ('supports', 'Formations et supports', Icons.folder_outlined),
  ('profil', 'Mon profil', Icons.person_outline),
];

class PortalShell extends StatefulWidget {
  final PortalApi api;
  final Json user;
  final VoidCallback onLogout, onPassword;
  const PortalShell({
    super.key,
    required this.api,
    required this.user,
    required this.onLogout,
    required this.onPassword,
  });
  @override
  State<PortalShell> createState() => _PortalShellState();
}

class _PortalShellState extends State<PortalShell> {
  String page = 'home';
  final scroll = ScrollController();
  int refresh = 0;
  bool get student => widget.api.role == 'student';
  List<(String, String, IconData)> get menus =>
      student ? studentMenus : marketingMenus;
  void navigate(String value) {
    const aliases = {
      '': 'home',
      'etudiant': 'home',
      'marketings': 'home',
      'payments': 'paiements',
      'courses': 'cours',
      'followups': 'relances',
      'announcements': 'annonces',
    };
    final next = aliases[value] ?? value;
    if (!menus.any((menu) => menu.$1 == next)) return;
    setState(() => page = next);
    if (scroll.hasClients) scroll.jumpTo(0);
  }

  Widget content() {
    final api = widget.api;
    if (student) {
      return switch (page) {
        'home' => StudentHome(api: api, user: widget.user, navigate: navigate),
        'dashboard' => StudentDashboard(api: api),
        'cours' => CoursesScreen(api: api),
        'suivi' => ProgressScreen(api: api),
        'paiements' => PaymentsScreen(api: api),
        'carte' => StudentCardScreen(api: api),
        'annonces' => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const PageTitle(
              'Mes annonces',
              'Les informations publiées pour vous par le centre.',
            ),
            RemoteView(
              load: () => api.get('/announcements'),
              builder: (data) => AnnouncementList(records(data['items'])),
            ),
          ],
        ),
        _ => ProfileScreen(
          api: api,
          user: widget.user,
          onPassword: widget.onPassword,
          onCard: () => navigate('carte'),
        ),
      };
    }
    return switch (page) {
      'home' => MarketingHome(api: api, user: widget.user, navigate: navigate),
      'dashboard' => MarketingDashboard(api: api),
      'prospects' => ProspectListScreen(
        api: api,
        onAdd: () => navigate('ajouter'),
      ),
      'ajouter' => ProspectForm(api: api),
      'relances' => ProspectListScreen(
        api: api,
        followUps: true,
        onAdd: () => navigate('ajouter'),
      ),
      'supports' => SupportsScreen(api: api),
      _ => ProfileScreen(
        api: api,
        user: widget.user,
        onPassword: widget.onPassword,
        onCard: () {},
      ),
    };
  }

  Future<void> more() async {
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => SafeArea(
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final menu in menus)
                ListTile(
                  selected: page == menu.$1,
                  leading: Icon(menu.$3),
                  title: Text(menu.$2),
                  onTap: () {
                    Navigator.pop(context);
                    navigate(menu.$1);
                  },
                ),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.logout),
                title: const Text('Déconnexion'),
                onTap: () {
                  Navigator.pop(context);
                  widget.onLogout();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 1000;
    final primary = student
        ? [studentMenus[0], studentMenus[2], studentMenus[3], studentMenus[4]]
        : [
            marketingMenus[0],
            marketingMenus[2],
            marketingMenus[3],
            marketingMenus[4],
          ];
    final bottomIndex = primary.indexWhere((menu) => menu.$1 == page);
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 72,
        title: Row(
          children: [
            Image.asset('assets/logo.png', width: 42, height: 46),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'AL-HAKIM CENTER',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                  ),
                  Text(
                    student ? 'Espace Étudiant' : 'Espace Marketing',
                    style: const TextStyle(color: muted, fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Actualiser',
            onPressed: () => setState(() => refresh++),
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Notifications',
            onPressed: () => navigate(student ? 'annonces' : 'home'),
            icon: const Icon(Icons.notifications_outlined),
          ),
          IconButton(
            tooltip: 'Mon profil',
            onPressed: () => navigate('profil'),
            icon: CircleAvatar(
              radius: 17,
              backgroundColor: const Color(0xFFFCE9EF),
              child: Text(
                label(widget.user['name']).substring(0, 1),
                style: const TextStyle(
                  color: pink,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
        ],
      ),
      body: SafeArea(
        top: false,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (wide)
              Container(
                width: 245,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(right: BorderSide(color: Color(0xFFE2E8F0))),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            label(widget.user['name']),
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            student
                                ? 'Mon parcours au centre'
                                : 'Mon espace de prospection',
                            style: const TextStyle(fontSize: 11, color: muted),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        children: menus
                            .map(
                              (menu) => Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Material(color:Colors.transparent, child: ListTile(
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  selected: page == menu.$1,
                                  selectedTileColor: const Color(0xFFEAF0F9),
                                  selectedColor: navy,
                                  leading: Icon(menu.$3, size: 21),
                                  title: Text(
                                    menu.$2,
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                  onTap: () => navigate(menu.$1),
                                )),
                              ),
                            )
                            .toList(),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(18),
                      child: TextButton.icon(
                        onPressed: widget.onLogout,
                        icon: const Icon(Icons.logout, size: 18),
                        label: const Text('Déconnexion'),
                      ),
                    ),
                  ],
                ),
              ),
            Expanded(
              child: SingleChildScrollView(
                controller: scroll,
                padding: EdgeInsets.fromLTRB(
                  wide ? 36 : 20,
                  28,
                  wide ? 36 : 20,
                  40,
                ),
                child: Align(
                  alignment: Alignment.topCenter,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1280),
                    child: KeyedSubtree(
                      key: ValueKey('$page-$refresh'),
                      child: content(),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: wide
          ? null
          : NavigationBar(
              selectedIndex: bottomIndex < 0 ? 4 : bottomIndex,
              onDestinationSelected: (index) =>
                  index == 4 ? more() : navigate(primary[index].$1),
              labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
              destinations: [
                for (final menu in primary)
                  NavigationDestination(
                    icon: Icon(menu.$3),
                    label: menu.$2
                        .replaceFirst('Mes ', '')
                        .replaceFirst('Mon ', ''),
                  ),
                const NavigationDestination(
                  icon: Icon(Icons.more_horiz),
                  label: 'Plus',
                ),
              ],
            ),
    );
  }
}
