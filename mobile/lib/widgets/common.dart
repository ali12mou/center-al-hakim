import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api.dart';
import '../core/theme.dart';

class Panel extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  const Panel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(22),
  });
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(padding: padding, child: child),
  );
}

class PageTitle extends StatelessWidget {
  final String title, subtitle;
  const PageTitle(this.title, this.subtitle, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.headlineLarge),
        const SizedBox(height: 8),
        Text(subtitle, style: const TextStyle(color: muted)),
      ],
    ),
  );
}

class RemoteView extends StatefulWidget {
  final Future<Json> Function() load;
  final Widget Function(Json data) builder;
  final String? refreshKey;
  const RemoteView({
    super.key,
    required this.load,
    required this.builder,
    this.refreshKey,
  });
  @override
  State<RemoteView> createState() => _RemoteViewState();
}

class _RemoteViewState extends State<RemoteView> {
  late Future<Json> future;
  @override
  void initState() {
    super.initState();
    future = widget.load();
  }

  @override
  void didUpdateWidget(RemoteView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.refreshKey != widget.refreshKey) future = widget.load();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Json>(
    future: future,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const Padding(
          padding: EdgeInsets.all(48),
          child: Center(child: CircularProgressIndicator()),
        );
      }
      if (snapshot.hasError) {
        return EmptyState(
          'Impossible de charger ces informations',
          snapshot.error.toString(),
          action: 'Réessayer',
          onAction: () => setState(() => future = widget.load()),
          icon: Icons.cloud_off_outlined,
        );
      }
      return widget.builder(snapshot.data ?? {});
    },
  );
}

class EmptyState extends StatelessWidget {
  final String title, message;
  final String? action;
  final VoidCallback? onAction;
  final IconData icon;
  const EmptyState(
    this.title,
    this.message, {
    super.key,
    this.action,
    this.onAction,
    this.icon = Icons.inbox_outlined,
  });
  @override
  Widget build(BuildContext context) => Panel(
    child: SizedBox(
      width: double.infinity,
      child: Column(
        children: [
          Icon(icon, size: 38, color: muted),
          const SizedBox(height: 14),
          Text(
            title,
            style: Theme.of(context).textTheme.titleLarge,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: muted),
          ),
          if (action != null)
            Padding(
              padding: const EdgeInsets.only(top: 16),
              child: OutlinedButton(onPressed: onAction, child: Text(action!)),
            ),
        ],
      ),
    ),
  );
}

class Metrics extends StatelessWidget {
  final List<(String, String, IconData)> items;
  const Metrics(this.items, {super.key});
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final columns = constraints.maxWidth > 800
          ? 4
          : constraints.maxWidth > 470
          ? 2
          : 1;
      return Wrap(
        spacing: 14,
        runSpacing: 14,
        children: items
            .map(
              (item) => SizedBox(
                width: (constraints.maxWidth - (columns - 1) * 14) / columns,
                child: Panel(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(item.$3, color: pink),
                      const SizedBox(height: 14),
                      Text(
                        item.$2,
                        style: const TextStyle(
                          fontSize: 23,
                          color: navy,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        item.$1,
                        style: const TextStyle(color: muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),
            )
            .toList(),
      );
    },
  );
}

class SectionTitle extends StatelessWidget {
  final String title;
  final Widget? action;
  const SectionTitle(this.title, {super.key, this.action});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 28, bottom: 14),
    child: Row(
      children: [
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleLarge),
        ),
        ?action,
      ],
    ),
  );
}

class DetailRow extends StatelessWidget {
  final String title, value;
  const DetailRow(this.title, this.value, {super.key});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(color: muted, fontSize: 12),
          ),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            value,
            style: const TextStyle(fontWeight: FontWeight.w600),
            textAlign: TextAlign.end,
          ),
        ),
      ],
    ),
  );
}

String money(dynamic value, [String currency = 'FDJ']) =>
    '${amount(value).toStringAsFixed(0)} $currency';
String dateLabel(dynamic value) {
  final date = DateTime.tryParse('${value ?? ''}');
  if (date == null) return 'À confirmer';
  return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
}

Future<void> openLink(BuildContext context, String url) async {
  final uri = Uri.tryParse(url);
  if (uri == null || !['https', 'http', 'tel', 'mailto'].contains(uri.scheme)) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Lien non disponible.')));
    }
    return;
  }
  if (!await launchUrl(uri, mode: LaunchMode.externalApplication) &&
      context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Impossible d’ouvrir ce lien.')),
    );
  }
}
