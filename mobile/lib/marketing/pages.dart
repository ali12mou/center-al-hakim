import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../widgets/common.dart';
import '../widgets/banners.dart';
import '../student/pages.dart' show AnnouncementList;

class ProspectDetail extends StatefulWidget {
  final PortalApi api;
  final String id;
  const ProspectDetail({super.key, required this.api, required this.id});
  @override
  State<ProspectDetail> createState() => _ProspectDetailState();
}

class _ProspectDetailState extends State<ProspectDetail> {
  int version = 0;
  final note = TextEditingController();
  String? status, error;
  DateTime? followUp;
  bool busy = false;
  @override
  void dispose() {
    note.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Fiche prospect')),
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: RemoteView(
        refreshKey: '$version',
        load: () => widget.api.get('/prospects/${widget.id}/history'),
        builder: (data) {
          final item = object(data['item']);
          final consent = item['consent'] == true;
          final channels = (item['consentChannels'] as List?) ?? [];
          final digits = label(item['phone'], '').replaceAll(RegExp(r'\D'), '');
          final phone = digits.length == 8 ? '253$digits' : digits;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              PageTitle(label(item['name']), label(item['reference'])),
              Panel(
                child: Column(
                  children: [
                    DetailRow('Formation', label(item['courseTitle'])),
                    DetailRow('Statut', prospectStatus(item['status'])),
                    DetailRow('Téléphone', label(item['phone'])),
                    DetailRow('E-mail', label(item['email'], 'Non renseigné')),
                    DetailRow(
                      'Source',
                      sources[item['source']] ?? label(item['source']),
                    ),
                    DetailRow(
                      'Accord de contact',
                      consent
                          ? 'Accord enregistré le ${dateLabel(item['consentAt'])}'
                          : 'Non accordé',
                    ),
                    DetailRow(
                      'Canaux autorisés',
                      channels.isEmpty ? 'À confirmer' : channels.join(', '),
                    ),
                    DetailRow(
                      'Prochaine relance',
                      dateLabel(item['nextFollowUpAt'] ?? item['nextFollowUp']),
                    ),
                    if (label(item['notes'], '').isNotEmpty)
                      Text(item['notes'] as String),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  OutlinedButton.icon(
                    onPressed: consent && channels.contains('phone')
                        ? () => openLink(context, 'tel:$phone')
                        : null,
                    icon: const Icon(Icons.phone_outlined),
                    label: const Text('Appeler'),
                  ),
                  FilledButton.icon(
                    onPressed: consent && channels.contains('whatsapp')
                        ? () => openLink(
                            context,
                            'https://wa.me/$phone?text=${Uri.encodeComponent('Bonjour ${item['name']}, je vous contacte pour votre demande auprès d’AL-HAKIM CENTER.')}',
                          )
                        : null,
                    icon: const Icon(Icons.chat_outlined),
                    label: const Text('Ouvrir WhatsApp'),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Text(
                'Ouvrir WhatsApp prépare le contact : aucun message n’est comptabilisé comme envoyé. Les actions nécessitent l’accord pour le canal concerné.',
                style: TextStyle(color: muted, fontSize: 11),
              ),
              const SectionTitle('Enregistrer une interaction'),
              Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (item['status'] != 'enrolled')
                      DropdownButtonFormField<String>(
                        initialValue:
                            statuses.containsKey(status ?? item['status'])
                            ? status ?? item['status'] as String
                            : 'new',
                        decoration: const InputDecoration(labelText: 'Statut'),
                        items: statuses.entries
                            .map(
                              (entry) => DropdownMenuItem(
                                value: entry.key,
                                child: Text(entry.value),
                              ),
                            )
                            .toList(),
                        onChanged: (value) => setState(() => status = value),
                      ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: note,
                      maxLines: 3,
                      maxLength: 1000,
                      decoration: const InputDecoration(
                        labelText: 'Compte rendu de l’échange',
                        hintText: 'Indiquez les faits et la prochaine action.',
                      ),
                    ),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final date = await showDatePicker(
                          context: context,
                          firstDate: DateTime.now().subtract(
                            const Duration(days: 1),
                          ),
                          lastDate: DateTime(2100),
                        );
                        if (date == null || !context.mounted) return;
                        final time = await showTimePicker(
                          context: context,
                          initialTime: TimeOfDay.now(),
                        );
                        if (time != null) {
                          setState(
                            () => followUp = DateTime(
                              date.year,
                              date.month,
                              date.day,
                              time.hour,
                              time.minute,
                            ),
                          );
                        }
                      },
                      icon: const Icon(Icons.event_outlined),
                      label: Text(
                        followUp == null
                            ? 'Programmer une prochaine relance'
                            : 'Relance ${dateLabel(followUp)} · ${followUp!.hour}:${followUp!.minute.toString().padLeft(2, '0')}',
                      ),
                    ),
                    if (error != null)
                      Text(error!, style: const TextStyle(color: Colors.red)),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: busy
                          ? null
                          : () async {
                              if (note.text.trim().length < 2) {
                                setState(
                                  () => error = 'Ajoutez un compte rendu.',
                                );
                                return;
                              }
                              setState(() {
                                busy = true;
                                error = null;
                              });
                              try {
                                if (status != null &&
                                    status != item['status']) {
                                  await widget.api.post(
                                    '/prospects/${widget.id}/status',
                                    {
                                      'status': status,
                                      'note': note.text.trim(),
                                      if (followUp != null)
                                        'nextFollowUpAt': followUp!
                                            .toUtc()
                                            .toIso8601String(),
                                      if (followUp != null)
                                        'nextFollowUp': followUp!
                                            .toIso8601String()
                                            .substring(0, 10),
                                    },
                                  );
                                } else {
                                  await widget.api.post(
                                    '/prospects/${widget.id}/interactions',
                                    {
                                      'note': note.text.trim(),
                                      if (followUp != null)
                                        'nextFollowUpAt': followUp!
                                            .toUtc()
                                            .toIso8601String(),
                                    },
                                  );
                                }
                                if (mounted) {
                                  setState(() {
                                    version++;
                                    note.clear();
                                  });
                                }
                              } catch (e) {
                                if (mounted) {
                                  setState(() => error = e.toString());
                                }
                              } finally {
                                if (mounted) setState(() => busy = false);
                              }
                            },
                      child: Text(busy ? 'Enregistrement…' : 'Enregistrer'),
                    ),
                  ],
                ),
              ),
              const SectionTitle('Historique des interactions'),
              if (records(data['items']).isEmpty)
                const EmptyState(
                  'Aucune interaction enregistrée',
                  'Consignez les échanges pour organiser vos prochaines actions.',
                ),
              ...records(data['items']).map(
                (row) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Panel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(label(row['note'], 'Mise à jour du statut')),
                        const SizedBox(height: 8),
                        Text(
                          '${dateLabel(row['createdAt'])} · ${prospectStatus(row['to'])}',
                          style: const TextStyle(color: muted, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    ),
  );
}

class SupportsScreen extends StatelessWidget {
  final PortalApi api;
  const SupportsScreen({super.key, required this.api});
  @override
  Widget build(BuildContext context) => RemoteView(
    load: () => api.get('/home'),
    builder: (data) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const PageTitle(
          'Formations et supports',
          'Les informations et visuels approuvés par l’administration.',
        ),
        const SectionTitle('Catalogue du centre'),
        if (records(data['courses']).isEmpty)
          const EmptyState(
            'Aucune formation publiée',
            'Les programmes validés seront disponibles ici.',
          ),
        ...records(data['courses']).map(
          (course) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label(course['title']),
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 12),
                  Text(label(course['description'], '')),
                  DetailRow('Niveau', label(course['level'])),
                  DetailRow('Modalité', label(course['format'])),
                  DetailRow('Durée', label(course['duration'])),
                ],
              ),
            ),
          ),
        ),
        const SectionTitle('Supports de campagne'),
        if (records(data['banners'])
            .where((item) => label(item['imageUrl'], '').isNotEmpty)
            .isEmpty)
          const EmptyState(
            'Aucun support publié',
            'L’administration peut ajouter des visuels pour l’audience Marketing.',
          ),
        ...records(data['banners'])
            .where((item) => label(item['imageUrl'], '').isNotEmpty)
            .map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Panel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label(item['title']),
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 14),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.network(
                          api.absolute(item['imageUrl'] as String),
                          height: 180,
                          width: double.infinity,
                          fit: BoxFit.cover,
                          errorBuilder: (_, error, stack) =>
                              const Icon(Icons.image_outlined, size: 50),
                        ),
                      ),
                      const SizedBox(height: 14),
                      OutlinedButton.icon(
                        onPressed: () => openLink(
                          context,
                          api.absolute(item['imageUrl'] as String),
                        ),
                        icon: const Icon(Icons.download_outlined),
                        label: const Text('Ouvrir / télécharger le visuel'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
      ],
    ),
  );
}

const statuses = {
  'new': 'Nouveau',
  'to_contact': 'À contacter',
  'interested': 'Intéressé',
  'considering': 'En réflexion',
  'following': 'En cours de suivi',
  'visit': 'Visite prévue',
  'preregistered': 'Préinscrit',
  'not_interested': 'Non intéressé',
};
const sources = {
  'field': 'Terrain',
  'phone': 'Téléphone',
  'whatsapp': 'WhatsApp',
  'social': 'Réseaux sociaux',
  'referral': 'Recommandation',
  'event': 'Événement',
  'website': 'Site web',
  'other': 'Autre',
};
String prospectStatus(dynamic value) => value == 'enrolled'
    ? 'Inscription confirmée'
    : value == 'satisfied'
    ? 'Satisfait'
    : statuses[value] ?? label(value);

class MarketingHome extends StatelessWidget {
  final PortalApi api;
  final Json user;
  final void Function(String) navigate;
  const MarketingHome({
    super.key,
    required this.api,
    required this.user,
    required this.navigate,
  });
  @override
  Widget build(BuildContext context) => RemoteView(
    load: () => api.get('/home'),
    builder: (data) {
      final about = object(data['about']);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PageTitle(
            'Bonjour ${label(user['name']).split(' ').first},',
            'Bienvenue dans votre espace Marketing AL-HAKIM CENTER.',
          ),
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'FAIRE CONNAÎTRE LE CENTRE',
                  style: TextStyle(
                    color: pink,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  'Rencontrer. Informer. Accompagner.',
                  style: Theme.of(context).textTheme.headlineLarge,
                ),
                const SizedBox(height: 14),
                Text(label(about['description'], '')),
                const SizedBox(height: 20),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    FilledButton.icon(
                      onPressed: () => navigate('ajouter'),
                      icon: const Icon(Icons.person_add_alt),
                      label: const Text('Ajouter un prospect'),
                    ),
                    OutlinedButton.icon(
                      onPressed: () => navigate('relances'),
                      icon: const Icon(Icons.event_outlined),
                      label: const Text('Mes relances'),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          BannerCarousel(
            items: records(data['banners']),
            api: api,
            onOpen: (link) {
              if (link.startsWith('/marketings')) {
                navigate(link.split('/').last);
              } else {
                openLink(context, api.absolute(link));
              }
            },
          ),
          const SectionTitle('Vos outils de terrain'),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              OutlinedButton.icon(
                onPressed: () => navigate('supports'),
                icon: const Icon(Icons.menu_book_outlined),
                label: const Text('Formations et supports'),
              ),
              OutlinedButton.icon(
                onPressed: () => navigate('dashboard'),
                icon: const Icon(Icons.space_dashboard_outlined),
                label: const Text('Mes statistiques'),
              ),
              OutlinedButton.icon(
                onPressed: () => navigate('prospects'),
                icon: const Icon(Icons.people_outline),
                label: const Text('Mes prospects'),
              ),
            ],
          ),
          const SectionTitle('Campagnes et annonces approuvées'),
          AnnouncementList(
            records(data['banners'])
                .map((item) => {...item, 'body': item['description']})
                .toList(),
          ),
          const SectionTitle('Informations pratiques'),
          Panel(
            child: Column(
              children: [
                DetailRow('Téléphone', label(object(data['centre'])['phone'])),
                DetailRow('Adresse', label(object(data['centre'])['address'])),
                const Text(
                  'Utilisez uniquement les annonces et supports publiés par l’administration. Confirmez les tarifs, les conditions et les disponibilités auprès du centre.',
                  style: TextStyle(color: muted, fontSize: 12),
                ),
              ],
            ),
          ),
        ],
      );
    },
  );
}

class MarketingDashboard extends StatefulWidget {
  final PortalApi api;
  const MarketingDashboard({super.key, required this.api});
  @override
  State<MarketingDashboard> createState() => _MarketingDashboardState();
}

class _MarketingDashboardState extends State<MarketingDashboard> {
  DateTimeRange? period;
  String course = '', campaign = '';
  Json get query => {
    if (period != null)
      'from': period!.start.toIso8601String().substring(0, 10),
    if (period != null) 'to': period!.end.toIso8601String().substring(0, 10),
    if (course.isNotEmpty) 'courseId': course,
    if (campaign.isNotEmpty) 'campaignId': campaign,
  };
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const PageTitle(
        'Mon tableau de bord',
        'Vos statistiques personnelles, calculées sur les collectes qui vous sont attribuées.',
      ),
      RemoteView(
        load: () => widget.api.get('/home'),
        builder: (home) => Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            OutlinedButton.icon(
              onPressed: () async {
                final selected = await showDateRangePicker(
                  context: context,
                  firstDate: DateTime(2020),
                  lastDate: DateTime(2100),
                  initialDateRange: period,
                );
                if (selected != null) setState(() => period = selected);
              },
              icon: const Icon(Icons.calendar_month_outlined),
              label: Text(
                period == null
                    ? 'Toutes les périodes'
                    : '${dateLabel(period!.start)} – ${dateLabel(period!.end)}',
              ),
            ),
            SizedBox(
              width: 250,
              child: DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: course,
                decoration: const InputDecoration(labelText: 'Formation'),
                items: [
                  const DropdownMenuItem(
                    value: '',
                    child: Text('Toutes les formations'),
                  ),
                  ...records(home['courses']).map(
                    (item) => DropdownMenuItem(
                      value: label(item['id']),
                      child: Text(
                        label(item['title']),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ],
                onChanged: (value) => setState(() => course = value ?? ''),
              ),
            ),
            SizedBox(
              width: 250,
              child: DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: campaign,
                decoration: const InputDecoration(labelText: 'Campagne'),
                items: [
                  const DropdownMenuItem(
                    value: '',
                    child: Text('Toutes les campagnes'),
                  ),
                  ...records(home['banners']).map(
                    (item) => DropdownMenuItem(
                      value: label(item['_id']),
                      child: Text(
                        label(item['title']),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ],
                onChanged: (value) => setState(() => campaign = value ?? ''),
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 24),
      RemoteView(
        refreshKey: query.toString(),
        load: () => widget.api.get('/stats', query: query),
        builder: (data) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Metrics([
              ('Prospects collectés', '${data['total']}', Icons.people_outline),
              (
                'Personnes intéressées',
                '${data['interested']}',
                Icons.thumb_up_alt_outlined,
              ),
              (
                'Inscriptions validées',
                '${data['enrolled']}',
                Icons.verified_outlined,
              ),
              (
                'Relances à effectuer',
                '${data['followUps']}',
                Icons.event_outlined,
              ),
              (
                'Taux de conversion',
                '${data['conversion']} %',
                Icons.insights_outlined,
              ),
            ]),
            const SizedBox(height: 20),
            Panel(
              child: Text(
                label(
                  data['conversionMethod'],
                  'Inscriptions validées par l’administration / prospects collectés sur la période × 100.',
                ),
              ),
            ),
            const SectionTitle('Répartition des prospects'),
            Panel(
              child: Column(
                children: object(data['byStatus']).entries
                    .where((entry) => amount(entry.value) > 0)
                    .map(
                      (entry) => DetailRow(
                        prospectStatus(entry.key),
                        '${entry.value}',
                      ),
                    )
                    .toList(),
              ),
            ),
          ],
        ),
      ),
    ],
  );
}

class ProspectListScreen extends StatefulWidget {
  final PortalApi api;
  final bool followUps;
  final VoidCallback onAdd;
  const ProspectListScreen({
    super.key,
    required this.api,
    required this.onAdd,
    this.followUps = false,
  });
  @override
  State<ProspectListScreen> createState() => _ProspectListScreenState();
}

class _ProspectListScreenState extends State<ProspectListScreen> {
  String query = '', status = '';
  int page = 1;
  Timer? debounce;
  @override
  void dispose() {
    debounce?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      PageTitle(
        widget.followUps ? 'Mes relances' : 'Mes prospects',
        widget.followUps
            ? 'Les contacts à traiter, selon les dates de relance enregistrées.'
            : 'Vos collectes et leur historique. Les dossiers des autres agents restent privés.',
      ),
      Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          SizedBox(
            width: 360,
            child: TextField(
              decoration: const InputDecoration(
                labelText: 'Rechercher un prospect',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (value) {
                debounce?.cancel();
                debounce = Timer(const Duration(milliseconds: 350), () {
                  if (mounted) {
                    setState(() {
                      query = value;
                      page = 1;
                    });
                  }
                });
              },
            ),
          ),
          if (!widget.followUps)
            SizedBox(
              width: 250,
              child: DropdownButtonFormField<String>(
                isExpanded: true,
                initialValue: status,
                decoration: const InputDecoration(labelText: 'Statut'),
                items: [
                  const DropdownMenuItem(
                    value: '',
                    child: Text('Tous les statuts'),
                  ),
                  ...{
                    ...statuses,
                    'enrolled': 'Inscription confirmée',
                  }.entries.map(
                    (entry) => DropdownMenuItem(
                      value: entry.key,
                      child: Text(entry.value),
                    ),
                  ),
                ],
                onChanged: (value) => setState(() {
                  status = value ?? '';
                  page = 1;
                }),
              ),
            ),
          FilledButton.icon(
            onPressed: widget.onAdd,
            icon: const Icon(Icons.add),
            label: const Text('Ajouter un prospect'),
          ),
        ],
      ),
      const SizedBox(height: 24),
      RemoteView(
        refreshKey: '$query|$status|$page|${widget.followUps}',
        load: () => widget.api.get(
          '/prospects',
          query: {
            'q': query,
            'status': widget.followUps ? 'followup' : status,
            'page': page,
            'limit': 20,
          },
        ),
        builder: (data) {
          final items = records(data['items']);
          return Column(
            children: [
              if (items.isEmpty)
                EmptyState(
                  widget.followUps
                      ? 'Aucune relance à effectuer'
                      : 'Aucun prospect trouvé',
                  widget.followUps
                      ? 'Vous pouvez programmer vos prochaines actions depuis une fiche prospect.'
                      : 'Ajoutez un prospect ou adaptez vos filtres.',
                  action: 'Ajouter un prospect',
                  onAction: widget.onAdd,
                ),
              ...items.map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Panel(
                    child: ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: CircleAvatar(
                        backgroundColor: surface,
                        child: Text(label(item['name']).substring(0, 1)),
                      ),
                      title: Text(
                        label(item['name']),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        '${label(item['courseTitle'])}\n${prospectStatus(item['status'])}${label(item['nextFollowUpAt'] ?? item['nextFollowUp'], '').isNotEmpty ? ' · Relance ${dateLabel(item['nextFollowUpAt'] ?? item['nextFollowUp'])}' : ''}',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.of(context)
                          .push(
                            MaterialPageRoute<void>(
                              builder: (_) => ProspectDetail(
                                api: widget.api,
                                id: label(item['_id']),
                              ),
                            ),
                          )
                          .then((_) {
                            if (mounted) setState(() {});
                          }),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconButton(
                    tooltip: 'Page précédente',
                    onPressed: page > 1 ? () => setState(() => page--) : null,
                    icon: const Icon(Icons.chevron_left),
                  ),
                  Text('Page $page / ${data['pages'] ?? 1}'),
                  IconButton(
                    tooltip: 'Page suivante',
                    onPressed: page < amount(data['pages'])
                        ? () => setState(() => page++)
                        : null,
                    icon: const Icon(Icons.chevron_right),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    ],
  );
}

class ProspectForm extends StatefulWidget {
  final PortalApi api;
  const ProspectForm({super.key, required this.api});
  @override
  State<ProspectForm> createState() => _ProspectFormState();
}

class _ProspectFormState extends State<ProspectForm> {
  final form = GlobalKey<FormState>();
  final name = TextEditingController(),
      phone = TextEditingController(),
      email = TextEditingController(),
      notes = TextEditingController();
  String course = '', status = 'new', source = 'field', campaign = '';
  DateTime? followUp;
  Set<String> channels = {};
  bool consent = false, busy = false;
  String? error;
  Json? saved;
  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    email.dispose();
    notes.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    if (consent && channels.isEmpty) {
      setState(
        () => error = 'Choisissez au moins un canal de contact autorisé.',
      );
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = await widget.api.post('/prospects', {
        'name': name.text.trim(),
        'phone': phone.text.trim(),
        'email': email.text.trim(),
        'courseId': course,
        'status': status,
        'source': source,
        'notes': notes.text.trim(),
        'consent': consent,
        'consentChannels': consent ? channels.toList() : <String>[],
        'campaignId': campaign,
        if (followUp != null)
          'nextFollowUpAt': followUp!.toUtc().toIso8601String(),
        if (followUp != null)
          'nextFollowUp': followUp!.toIso8601String().substring(0, 10),
      });
      if (mounted) setState(() => saved = object(result['item']));
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (saved != null) {
      return EmptyState(
        'Prospect enregistré',
        '${saved!['name']} a été attribué à votre compte. Référence : ${saved!['reference']}',
        icon: Icons.check_circle_outline,
        action: 'Voir la fiche',
        onAction: () => Navigator.of(context)
            .push(
              MaterialPageRoute<void>(
                builder: (_) =>
                    ProspectDetail(api: widget.api, id: label(saved!['_id'])),
              ),
            )
            .then((_) {
              if (mounted) {
                setState(() {
                  saved = null;
                  name.clear();
                  phone.clear();
                  email.clear();
                  notes.clear();
                  consent = false;
                  channels = {};
                  followUp = null;
                });
              }
            }),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const PageTitle(
          'Ajouter un prospect',
          'La collecte est datée et attribuée automatiquement à votre compte.',
        ),
        RemoteView(
          load: () => widget.api.get('/home'),
          builder: (home) {
            final courses = records(home['courses']);
            if (courses.isEmpty) {
              return const EmptyState(
                'Catalogue indisponible',
                'Demandez au centre de publier les formations avant de créer une collecte.',
              );
            }
            return Panel(
              child: Form(
                key: form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextFormField(
                      controller: name,
                      decoration: const InputDecoration(
                        labelText: 'Nom complet *',
                      ),
                      validator: (value) => (value ?? '').trim().length < 2
                          ? 'Nom obligatoire'
                          : null,
                    ),
                    const SizedBox(height: 18),
                    TextFormField(
                      controller: phone,
                      keyboardType: TextInputType.phone,
                      decoration: const InputDecoration(
                        labelText: 'Téléphone *',
                        hintText: '+253…',
                      ),
                      validator: (value) =>
                          !RegExp(r'^[+0-9 ().-]{6,30}$').hasMatch(value ?? '')
                          ? 'Numéro invalide'
                          : null,
                    ),
                    const SizedBox(height: 18),
                    TextFormField(
                      controller: email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: const InputDecoration(
                        labelText: 'E-mail (facultatif)',
                      ),
                      validator: (value) =>
                          (value ?? '').isNotEmpty &&
                              !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
                                  .hasMatch(value!)
                          ? 'E-mail invalide'
                          : null,
                    ),
                    const SizedBox(height: 18),
                    DropdownButtonFormField<String>(
                      initialValue: course.isEmpty ? null : course,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Formation souhaitée *',
                      ),
                      items: courses
                          .map(
                            (item) => DropdownMenuItem(
                              value: label(item['id']),
                              child: Text(
                                label(item['title']),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      validator: (value) => value == null || value.isEmpty
                          ? 'Choisissez une formation'
                          : null,
                      onChanged: (value) =>
                          setState(() => course = value ?? ''),
                    ),
                    const SizedBox(height: 18),
                    DropdownButtonFormField<String>(
                      initialValue: status,
                      isExpanded: true,
                      decoration: const InputDecoration(labelText: 'Statut'),
                      items: statuses.entries
                          .map(
                            (entry) => DropdownMenuItem(
                              value: entry.key,
                              child: Text(entry.value),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setState(() => status = value!),
                    ),
                    const SizedBox(height: 18),
                    DropdownButtonFormField<String>(
                      initialValue: source,
                      decoration: const InputDecoration(labelText: 'Source'),
                      items: sources.entries
                          .map(
                            (entry) => DropdownMenuItem(
                              value: entry.key,
                              child: Text(entry.value),
                            ),
                          )
                          .toList(),
                      onChanged: (value) => setState(() => source = value!),
                    ),
                    const SizedBox(height: 18),
                    DropdownButtonFormField<String>(
                      initialValue: campaign,
                      decoration: const InputDecoration(
                        labelText: 'Campagne (facultative)',
                      ),
                      isExpanded: true,
                      items: [
                        const DropdownMenuItem(
                          value: '',
                          child: Text('Sans campagne'),
                        ),
                        ...records(home['banners']).map(
                          (item) => DropdownMenuItem(
                            value: label(item['_id']),
                            child: Text(
                              label(item['title']),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ),
                      ],
                      onChanged: (value) =>
                          setState(() => campaign = value ?? ''),
                    ),
                    const SizedBox(height: 18),
                    OutlinedButton.icon(
                      onPressed: () async {
                        final date = await showDatePicker(
                          context: context,
                          firstDate: DateTime.now().subtract(
                            const Duration(days: 1),
                          ),
                          lastDate: DateTime(2100),
                        );
                        if (date == null || !context.mounted) return;
                        final time = await showTimePicker(
                          context: context,
                          initialTime: TimeOfDay.now(),
                        );
                        if (time != null) {
                          setState(
                            () => followUp = DateTime(
                              date.year,
                              date.month,
                              date.day,
                              time.hour,
                              time.minute,
                            ),
                          );
                        }
                      },
                      icon: const Icon(Icons.event_outlined),
                      label: Text(
                        followUp == null
                            ? 'Programmer une relance'
                            : '${dateLabel(followUp)} · ${followUp!.hour.toString().padLeft(2, '0')}:${followUp!.minute.toString().padLeft(2, '0')}',
                      ),
                    ),
                    const SizedBox(height: 18),
                    TextFormField(
                      controller: notes,
                      maxLines: 4,
                      maxLength: 2000,
                      decoration: const InputDecoration(
                        labelText: 'Observations',
                        hintText: 'Besoin, niveau, disponibilité…',
                      ),
                    ),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: consent,
                      onChanged: (value) =>
                          setState(() => consent = value == true),
                      title: const Text(
                        'La personne accepte d’être recontactée',
                      ),
                      subtitle: const Text(
                        'Choix explicite. La date et les canaux autorisés sont conservés.',
                      ),
                      controlAffinity: ListTileControlAffinity.leading,
                    ),
                    if (consent)
                      Wrap(
                        spacing: 10,
                        children: [
                          for (final entry in {
                            'phone': 'Téléphone',
                            'whatsapp': 'WhatsApp',
                            'email': 'E-mail',
                          }.entries)
                            FilterChip(
                              label: Text(entry.value),
                              selected: channels.contains(entry.key),
                              onSelected: (selected) => setState(
                                () => selected
                                    ? channels.add(entry.key)
                                    : channels.remove(entry.key),
                              ),
                            ),
                        ],
                      ),
                    if (error != null)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        child: Text(
                          error!,
                          style: const TextStyle(color: Colors.red),
                        ),
                      ),
                    const SizedBox(height: 24),
                    FilledButton.icon(
                      onPressed: busy ? null : submit,
                      icon: const Icon(Icons.check),
                      label: Text(
                        busy ? 'Enregistrement…' : 'Enregistrer le prospect',
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
