import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:printing/printing.dart';
import 'package:video_player/video_player.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import '../widgets/banners.dart';

Future<Json> studentBundle(PortalApi api) async {
  final results = await Future.wait([
    api.get('/me'),
    api.get('/progress'),
    api.get('/home'),
  ]);
  return {'me': results[0], 'progress': results[1], 'home': results[2]};
}

class StudentHome extends StatelessWidget {
  final PortalApi api;
  final Json user;
  final void Function(String) navigate;
  const StudentHome({
    super.key,
    required this.api,
    required this.user,
    required this.navigate,
  });
  @override
  Widget build(BuildContext context) => RemoteView(
    load: () => api.get('/home'),
    builder: (data) {
      final about = object(data['about']), centre = object(data['centre']);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          StudentWelcomeHeader(name: label(user['name'])),
          const SizedBox(height: 22),
          BannerCarousel(
            items: records(data['banners']),
            api: api,
            onOpen: (link) {
              if (link.startsWith('/etudiant')) {
                navigate(link.split('/').last);
              } else {
                openLink(context, api.absolute(link));
              }
            },
          ),
          const SizedBox(height: 18),
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'VOTRE CENTRE DE FORMATION',
                  style: TextStyle(
                    fontSize: 10,
                    letterSpacing: 1.5,
                    color: pink,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  label(
                    about['title'],
                    'Apprendre aujourd’hui. Aller plus loin demain.',
                  ),
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 10),
                Text(
                  label(about['description'], ''),
                  style: const TextStyle(color: muted),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Langues · Management · Informatique · Comptabilité & finance',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          const SectionTitle('Votre espace, en un geste'),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              for (final item in [
                ('cours', 'Mes cours', Icons.menu_book_outlined),
                (
                  'paiements',
                  'Mes paiements',
                  Icons.account_balance_wallet_outlined,
                ),
                ('carte', 'Ma carte étudiant', Icons.badge_outlined),
                (
                  'dashboard',
                  'Tableau de bord',
                  Icons.space_dashboard_outlined,
                ),
              ])
                OutlinedButton.icon(
                  onPressed: () => navigate(item.$1),
                  icon: Icon(item.$3, size: 18),
                  label: Text(item.$2),
                ),
            ],
          ),
          const SectionTitle('Vos prochaines séances'),
          SessionList(records(data['sessions'])),
          const SectionTitle('À la une pour vous'),
          AnnouncementList(records(data['announcements'])),
          SectionTitle(
            'Nouvelles ressources',
            action: TextButton(
              onPressed: () => navigate('cours'),
              child: const Text('Voir mes cours'),
            ),
          ),
          if (records(data['lessons']).isEmpty)
            const EmptyState(
              'Les ressources arrivent bientôt',
              'Retrouvez ici les nouveaux contenus publiés pour vos formations.',
              icon: Icons.menu_book_outlined,
            )
          else
            Panel(
              child: Column(
                children: records(data['lessons'])
                    .map(
                      (item) => ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(
                          Icons.article_outlined,
                          color: navy,
                        ),
                        title: Text(label(item['title'])),
                        subtitle: Text(dateLabel(item['createdAt'])),
                        onTap: () => navigate('cours'),
                      ),
                    )
                    .toList(),
              ),
            ),
          const SectionTitle('Nous sommes à votre écoute'),
          Panel(
            child: Column(
              children: [
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.phone_outlined),
                  title: Text(label(centre['phone'])),
                  onTap: () => openLink(context, 'tel:${centre['phoneLink']}'),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.mail_outline),
                  title: Text(label(centre['email'])),
                  onTap: () => openLink(context, 'mailto:${centre['email']}'),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.chat_outlined),
                  title: const Text('Contacter le centre sur WhatsApp'),
                  onTap: () =>
                      openLink(context, 'https://wa.me/${centre['whatsapp']}'),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.location_on_outlined),
                  title: Text(label(centre['address'])),
                  subtitle: Text(label(centre['landmark'], '')),
                ),
              ],
            ),
          ),
        ],
      );
    },
  );
}

class StudentWelcomeHeader extends StatelessWidget {
  final String name;
  const StudentWelcomeHeader({super.key, required this.name});
  @override
  Widget build(BuildContext context) => Container(
    width: double.infinity,
    padding: const EdgeInsets.all(24),
    decoration: BoxDecoration(
      gradient: const LinearGradient(
        colors: [Color(0xFF193964), Color(0xFF35335F)],
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      ),
      borderRadius: BorderRadius.circular(22),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'MON ESPACE ÉTUDIANT',
                    style: TextStyle(
                      color: Color(0xFFF5ADC6),
                      fontSize: 10,
                      letterSpacing: 1.4,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Bonjour ${name.split(' ').first},',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 28,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Bienvenue dans votre espace AL-HAKIM CENTER.',
                    style: TextStyle(
                      color: Color(0xFFDAE5F3),
                      fontSize: 13,
                      height: 1.8,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),
            Container(
              width: 72,
              height: 80,
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Image.asset('assets/logo.png', fit: BoxFit.contain),
            ),
          ],
        ),
        const SizedBox(height: 24),
        const Divider(color: Color(0x30FFFFFF), height: 1),
        const SizedBox(height: 18),
        const Text(
          'Apprendre aujourd’hui. Aller plus loin demain.',
          style: TextStyle(
            color: Colors.white,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    ),
  );
}

class SessionList extends StatelessWidget {
  final List<Json> items;
  const SessionList(this.items, {super.key});
  @override
  Widget build(BuildContext context) => items.isEmpty
      ? const EmptyState(
          'Planning à venir',
          'Les séances publiées pour votre formation et votre groupe apparaîtront ici.',
          icon: Icons.event_outlined,
        )
      : Panel(
          child: Column(
            children: items
                .map(
                  (session) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.event_outlined, color: pink),
                    title: Text(label(session['label'], 'Séance de formation')),
                    subtitle: Text(
                      '${dateLabel(session['date'])} · ${label(session['startTime'], '')}–${label(session['endTime'], '')}\nSalle : ${label(session['room'], 'à confirmer')} · ${label(object(session['staffId'])['fullName'], 'Formateur à confirmer')}',
                    ),
                  ),
                )
                .toList(),
          ),
        );
}

class AnnouncementList extends StatelessWidget {
  final List<Json> items;
  const AnnouncementList(this.items, {super.key});
  @override
  Widget build(BuildContext context) => items.isEmpty
      ? const EmptyState(
          'Aucune annonce pour le moment',
          'Les informations du centre et de vos formations seront affichées ici.',
          icon: Icons.campaign_outlined,
        )
      : Column(
          children: items
              .map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Panel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            if (item['pinned'] == true)
                              const Padding(
                                padding: EdgeInsets.only(right: 8),
                                child: Icon(
                                  Icons.push_pin_outlined,
                                  color: pink,
                                  size: 17,
                                ),
                              ),
                            Expanded(
                              child: Text(
                                label(item['title']),
                                style: Theme.of(context).textTheme.titleLarge,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(label(item['body'], '')),
                        const SizedBox(height: 8),
                        Text(
                          dateLabel(item['date']),
                          style: const TextStyle(fontSize: 11, color: muted),
                        ),
                      ],
                    ),
                  ),
                ),
              )
              .toList(),
        );
}

class StudentDashboard extends StatelessWidget {
  final PortalApi api;
  const StudentDashboard({super.key, required this.api});
  @override
  Widget build(BuildContext context) => RemoteView(
    load: () => studentBundle(api),
    builder: (data) {
      final me = object(data['me']),
          progress = object(data['progress']),
          stats = object(progress['stats']),
          home = object(data['home']);
      final accounts = records(me['accounts']),
          grades = records(progress['grades']);
      final paid = accounts.fold<num>(
            0,
            (sum, item) => sum + amount(item['paidAmount']),
          ),
          balance = accounts.fold<num>(
            0,
            (sum, item) => sum + amount(item['balance']),
          );
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PageTitle(
            'Mon tableau de bord',
            'Votre situation personnelle, à partir des données publiées par le centre.',
          ),
          Metrics([
            (
              'Formations en cours',
              '${accounts.where((item) => item['status'] == 'active').length}',
              Icons.menu_book_outlined,
            ),
            (
              'Formations terminées',
              '${accounts.where((item) => item['status'] == 'completed').length}',
              Icons.school_outlined,
            ),
            (
              'Taux de présence',
              stats['rate'] == null ? 'À venir' : '${stats['rate']} %',
              Icons.fact_check_outlined,
            ),
            (
              'Moyenne disponible',
              stats['average'] == null
                  ? 'Aucune note'
                  : '${stats['average']} / 20',
              Icons.insights_outlined,
            ),
            (
              'Montant payé',
              accounts.isEmpty ? 'À renseigner' : money(paid),
              Icons.payments_outlined,
            ),
            (
              'Reste à payer',
              accounts.isEmpty ? 'À renseigner' : money(balance),
              Icons.account_balance_wallet_outlined,
            ),
          ]),
          const SizedBox(height: 16),
          const Text(
            'Présence = séances présentes ou en retard / séances renseignées × 100. Moyenne = moyenne des notes publiées, ramenées sur 20. Une ressource ouverte n’est pas une compétence validée.',
            style: TextStyle(fontSize: 11, color: muted),
          ),
          const SectionTitle('Votre prochaine séance'),
          SessionList(records(home['sessions']).take(1).toList()),
          const SectionTitle('Derniers résultats'),
          if (grades.isEmpty)
            const EmptyState(
              'Aucune note publiée',
              'Les évaluations seront visibles après leur publication par le centre.',
            )
          else
            Panel(
              child: Column(
                children: grades
                    .take(3)
                    .map(
                      (grade) => DetailRow(
                        label(grade['title']),
                        '${grade['score']} / ${grade['maxScore']}',
                      ),
                    )
                    .toList(),
              ),
            ),
          const SectionTitle('Prochaines échéances'),
          if (accounts.every((account) => account['nextDue'] == null))
            const EmptyState(
              'Aucune échéance à venir',
              'Consultez Mes paiements pour retrouver le détail de vos dossiers.',
            )
          else
            Panel(
              child: Column(
                children: accounts
                    .where((account) => account['nextDue'] != null)
                    .map(
                      (account) => DetailRow(
                        label(account['courseTitle']),
                        '${dateLabel(object(account['nextDue'])['dueDate'])} · ${money(object(account['nextDue'])['remaining'] ?? object(account['nextDue'])['amount'])}',
                      ),
                    )
                    .toList(),
              ),
            ),
        ],
      );
    },
  );
}

class CoursesScreen extends StatelessWidget {
  final PortalApi api;
  const CoursesScreen({super.key, required this.api});
  @override
  Widget build(BuildContext context) => RemoteView(
    load: () async {
      final data = await Future.wait([api.get('/me'), api.get('/lessons')]);
      return {'me': data[0], 'lessons': data[1]};
    },
    builder: (data) {
      final accounts = records(object(data['me'])['accounts']),
          lessons = records(object(data['lessons'])['items']);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PageTitle(
            'Mes cours',
            'Vos formations et leurs ressources pédagogiques publiées.',
          ),
          if (accounts.isEmpty)
            const EmptyState(
              'Aucune formation associée',
              'Contactez le centre pour vérifier votre dossier.',
              icon: Icons.school_outlined,
            ),
          ...accounts.map((account) {
            final course = object(account['course']),
                resources = lessons
                    .where((item) => item['courseId'] == account['courseId'])
                    .toList();
            return Padding(
              padding: const EdgeInsets.only(bottom: 18),
              child: Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (label(course['imageUrl'], '').isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 18),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: Image.network(
                            api.absolute(course['imageUrl'] as String),
                            height: 170,
                            width: double.infinity,
                            fit: BoxFit.cover,
                            errorBuilder: (_, error, stack) =>
                                const SizedBox.shrink(),
                          ),
                        ),
                      ),
                    Text(
                      label(account['courseTitle']),
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '${label(course['level'], 'Niveau à confirmer')} · ${label(course['format'], 'Format à confirmer')}',
                      style: const TextStyle(color: muted),
                    ),
                    DetailRow(
                      'Période',
                      'À partir du ${dateLabel(account['startDate'])}',
                    ),
                    DetailRow(
                      'Groupe',
                      label(account['groupId'], 'À confirmer'),
                    ),
                    DetailRow(
                      'Statut',
                      account['status'] == 'completed'
                          ? 'Terminée'
                          : 'En cours',
                    ),
                    const Divider(),
                    if (resources.isEmpty)
                      const Text(
                        'Les ressources de cette formation seront publiées ici.',
                        style: TextStyle(color: muted),
                      ),
                    ...resources.map((resource) {
                      final added = DateTime.tryParse(
                        '${resource['createdAt']}',
                      );
                      final fresh =
                          added != null &&
                          DateTime.now().difference(added).inDays < 7;
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                          resource['kind'] == 'video'
                              ? Icons.play_circle_outline
                              : resource['hasFile'] == true
                              ? Icons.picture_as_pdf_outlined
                              : Icons.article_outlined,
                          color: navy,
                        ),
                        title: Text(label(resource['title'])),
                        subtitle: Text(
                          '${label(resource['kind'], 'Leçon')}${fresh ? ' · Nouveau' : ''}',
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute<void>(
                            builder: (_) =>
                                LessonScreen(api: api, item: resource),
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            );
          }),
        ],
      );
    },
  );
}

class LessonScreen extends StatelessWidget {
  final PortalApi api;
  final Json item;
  const LessonScreen({super.key, required this.api, required this.item});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(label(item['title']))),
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PageTitle(label(item['title']), label(item['description'], '')),
          if (item['kind'] == 'video' && label(item['link'], '').isNotEmpty)
            InlineVideo(url: api.absolute(item['link'] as String)),
          Text(label(item['body'], '')),
          if (item['hasFile'] == true)
            Padding(
              padding: const EdgeInsets.only(top: 20),
              child: FilledButton.icon(
                icon: const Icon(Icons.download_outlined),
                label: const Text('Ouvrir le document'),
                onPressed: () async {
                  try {
                    final bytes = await api.request(
                      '/lessons/${item['_id']}/file',
                      bytes: true,
                    ) as Uint8List;
                    if (item['fileType'] == 'pdf') {
                      await Printing.layoutPdf(
                        onLayout: (_) => bytes,
                        name: 'Cours_${item['_id']}.pdf',
                      );
                    } else if (context.mounted) {
                      await showDialog<void>(
                        context: context,
                        builder: (_) => Dialog(
                          child: InteractiveViewer(child: Image.memory(bytes)),
                        ),
                      );
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context)
                          .showSnackBar(SnackBar(content: Text(e.toString())));
                    }
                  }
                },
              ),
            ),
          if (item['kind'] != 'video' && label(item['link'], '').isNotEmpty)
            TextButton.icon(
              onPressed: () => openLink(context, item['link'] as String),
              icon: const Icon(Icons.open_in_new),
              label: const Text('Ouvrir le lien'),
            ),
        ],
      ),
    ),
  );
}

class InlineVideo extends StatefulWidget {
  final String url;
  const InlineVideo({super.key, required this.url});
  @override
  State<InlineVideo> createState() => _InlineVideoState();
}

class _InlineVideoState extends State<InlineVideo> {
  late VideoPlayerController controller;
  String? error;
  @override
  void initState() {
    super.initState();
    controller = VideoPlayerController.networkUrl(Uri.parse(widget.url));
    controller
        .initialize()
        .then((_) {
          if (mounted) setState(() {});
        })
        .catchError((Object e) {
          if (mounted) {
            setState(
              () => error = 'Vidéo indisponible. Vérifiez le réseau ou le format du fichier.',
            );
          }
        });
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 24),
    child: error != null
        ? Text(error!)
        : !controller.value.isInitialized
        ? const Center(child: CircularProgressIndicator())
        : Column(
            children: [
              AspectRatio(
                aspectRatio: controller.value.aspectRatio,
                child: VideoPlayer(controller),
              ),
              VideoProgressIndicator(controller, allowScrubbing: true),
              IconButton(
                tooltip: controller.value.isPlaying ? 'Pause' : 'Lire la vidéo',
                onPressed: () {
                  setState(
                    () => controller.value.isPlaying
                        ? controller.pause()
                        : controller.play(),
                  );
                },
                icon: Icon(
                  controller.value.isPlaying ? Icons.pause : Icons.play_arrow,
                ),
              ),
            ],
          ),
  );
}

class ProgressScreen extends StatefulWidget {
  final PortalApi api;
  const ProgressScreen({super.key, required this.api});
  @override
  State<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends State<ProgressScreen> {
  int selected = 0;
  @override
  Widget build(BuildContext context) => RemoteView(
    load: () => widget.api.get('/progress'),
    builder: (data) {
      final stats = object(data['stats']);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PageTitle(
            'Mon suivi',
            'Votre progression, vos évaluations et vos présences.',
          ),
          Wrap(
            spacing: 8,
            children: [
              for (final (index, name) in [
                'Progression',
                'Notes',
                'Présences',
              ].indexed)
                ChoiceChip(
                  label: Text(name),
                  selected: selected == index,
                  onSelected: (_) => setState(() => selected = index),
                ),
            ],
          ),
          const SizedBox(height: 22),
          if (selected == 0) ...[
            Metrics([
              (
                'Moyenne des notes publiées',
                stats['average'] == null
                    ? 'Aucune note publiée'
                    : '${stats['average']} / 20',
                Icons.trending_up,
              ),
              (
                'Présence',
                stats['rate'] == null ? 'À renseigner' : '${stats['rate']} %',
                Icons.fact_check_outlined,
              ),
            ]),
            const SizedBox(height: 20),
            const Panel(
              child: Text(
                'La progression est appréciée à partir des évaluations publiées. Consulter une leçon ne valide pas automatiquement une compétence. Le taux de présence inclut les présences et retards, sur toutes les séances renseignées.',
              ),
            ),
          ] else if (selected == 1) ...[
            if (records(data['grades']).isEmpty)
              const EmptyState(
                'Aucune note publiée',
                'Vos évaluations apparaîtront après validation par le formateur.',
              ),
            ...records(data['grades']).map(
              (grade) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Panel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label(grade['title']),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      DetailRow(
                        'Évaluation',
                        '${grade['score']} / ${grade['maxScore']}',
                      ),
                      DetailRow('Date', dateLabel(grade['date'])),
                      Text(label(grade['comment'], 'Aucune observation')),
                    ],
                  ),
                ),
              ),
            ),
          ] else ...[
            if (records(data['attendance']).isEmpty)
              const EmptyState(
                'Présences à venir',
                'Aucune séance n’a encore été renseignée.',
              ),
            ...records(data['attendance']).map(
              (row) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Panel(
                  child: Column(
                    children: [
                      DetailRow(
                        dateLabel(row['date']),
                        {
                              'present': 'Présent',
                              'late': 'Retard',
                              'absent': 'Absent',
                              'excused': 'Absence justifiée',
                            }[row['status']] ??
                            label(row['status']),
                      ),
                      if (label(row['notes'], '').isNotEmpty)
                        Text(row['notes'] as String),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ],
      );
    },
  );
}
