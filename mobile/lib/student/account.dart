import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

class PaymentsScreen extends StatelessWidget {
  final PortalApi api;
  const PaymentsScreen({super.key, required this.api});
  @override
  Widget build(BuildContext context) => RemoteView(
    load: () => api.get('/me'),
    builder: (data) {
      final accounts = records(data['accounts']),
          payments = records(data['payments']),
          invoices = records(data['invoices']);
      final currency = label(data['currency'], 'FDJ');
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const PageTitle(
            'Mes paiements',
            'Vos frais, échéances et règlements enregistrés par le centre.',
          ),
          if (accounts.isEmpty)
            const EmptyState(
              'Aucun dossier financier associé',
              'Contactez le centre si vous avez déjà une inscription.',
            ),
          ...accounts.map(
            (account) => Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label(account['courseTitle']),
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 10),
                    Chip(
                      label: Text(
                        amount(account['totalAmount']) == 0
                            ? 'Formation gratuite'
                            : amount(account['balance']) <= 0
                            ? 'Dossier soldé'
                            : 'Paiement en attente',
                      ),
                    ),
                    DetailRow(
                      'Montant total',
                      money(account['totalAmount'], currency),
                    ),
                    if (amount(account['discountAmount']) > 0)
                      DetailRow(
                        'Réduction validée',
                        money(account['discountAmount'], currency),
                      ),
                    DetailRow(
                      'Montant payé',
                      money(account['paidAmount'], currency),
                    ),
                    DetailRow(
                      'Reste à payer',
                      money(account['balance'], currency),
                    ),
                    const Divider(),
                    const Text(
                      'Échéancier',
                      style: TextStyle(fontWeight: FontWeight.w700),
                    ),
                    ...records(account['schedule']).map(
                      (due) => DetailRow(
                        '${dateLabel(due['dueDate'])} · ${label(due['label'], 'Échéance')}',
                        '${money(due['remaining'], currency)} · ${due['status'] == 'paid'
                            ? 'Réglée'
                            : due['status'] == 'overdue'
                            ? 'En retard'
                            : 'À régler'}',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SectionTitle('Historique des paiements'),
          if (payments.isEmpty)
            const EmptyState(
              'Aucun paiement enregistré',
              'Les règlements validés par le centre seront affichés ici.',
            ),
          ...payments.map(
            (payment) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    DetailRow(
                      label(payment['receiptNumber']),
                      money(payment['amount'], currency),
                    ),
                    Text(
                      '${dateLabel(payment['date'])} · ${label((payment['methods'] as List?)?.join(', '), 'Méthode à confirmer')}',
                      style: const TextStyle(fontSize: 12, color: muted),
                    ),
                    const SizedBox(height: 12),
                    if (payment['status'] == 'pending')
                      const Text(
                        'À vérifier par le centre',
                        style: TextStyle(
                          color: Colors.orange,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    if (payment['status'] == 'confirmed')
                      OutlinedButton.icon(
                        onPressed: () => downloadFinance(
                          context,
                          api,
                          'receipts',
                          payment['id'].toString(),
                        ),
                        icon: const Icon(Icons.picture_as_pdf_outlined),
                        label: const Text('Télécharger le reçu'),
                      ),
                  ],
                ),
              ),
            ),
          ),
          const SectionTitle('Mes factures'),
          if (invoices.isEmpty)
            const EmptyState(
              'Aucune facture publiée',
              'Les factures émises pour vos formations apparaîtront ici.',
            ),
          ...invoices.map(
            (invoice) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Panel(
                child: Column(
                  children: [
                    DetailRow(
                      label(invoice['number']),
                      money(invoice['total'], currency),
                    ),
                    DetailRow('Échéance', dateLabel(invoice['dueDate'])),
                    OutlinedButton.icon(
                      onPressed: () => downloadFinance(
                        context,
                        api,
                        'invoices',
                        invoice['id'].toString(),
                      ),
                      icon: const Icon(Icons.download_outlined),
                      label: const Text('Télécharger la facture'),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 22),
          const Panel(
            child: Text(
              'Contactez le centre pour connaître les moyens de paiement acceptés. L’application n’effectue aucun prélèvement ni paiement en ligne. Seuls les règlements enregistrés et validés par le centre figurent dans cet historique.',
            ),
          ),
        ],
      );
    },
  );
}

String pdfText(dynamic value) => label(value, '')
    .replaceAll('’', "'")
    .replaceAll('—', '-')
    .replaceAll('…', '...')
    .replaceAll('×', 'x');
Future<void> downloadFinance(
  BuildContext context,
  PortalApi api,
  String kind,
  String id,
) async {
  try {
    final data = await api.get('/documents/$kind/$id');
    final item = object(data['item']), issuer = object(data['issuer']);
    final pdf = pw.Document();
    final receipt = kind == 'receipts';
    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(28),
        build: (_) => [
          pw.Text(
            pdfText(issuer['centreName']),
            style: pw.TextStyle(fontSize: 19, fontWeight: pw.FontWeight.bold),
          ),
          pw.Text(pdfText(issuer['centrePhone'])),
          pw.SizedBox(height: 22),
          pw.Text(
            receipt ? 'RECU DE PAIEMENT' : 'FACTURE',
            style: pw.TextStyle(fontSize: 17, fontWeight: pw.FontWeight.bold),
          ),
          pw.Text(pdfText(item[receipt ? 'receiptNumber' : 'number'])),
          pw.Text(dateLabel(item[receipt ? 'date' : 'issueDate'])),
          pw.SizedBox(height: 18),
          pw.Text(
            pdfText(
              receipt ? item['studentName'] : object(item['billTo'])['name'],
            ),
          ),
          pw.SizedBox(height: 16),
          if (receipt)
            pw.TableHelper.fromTextArray(
              headers: ['Moyen', 'Reference', 'Montant'],
              data: records(item['splits'])
                  .map(
                    (line) => [
                      pdfText(line['method']),
                      pdfText(line['transactionRef']),
                      money(line['amount'], label(data['currency'], 'FDJ')),
                    ],
                  )
                  .toList(),
            )
          else
            pw.TableHelper.fromTextArray(
              headers: ['Designation', 'Quantite', 'Prix unitaire', 'Montant'],
              data: records(item['lines'])
                  .map(
                    (line) => [
                      pdfText(line['label']),
                      pdfText(line['quantity']),
                      money(line['unitPrice'], label(data['currency'], 'FDJ')),
                      money(line['amount'], label(data['currency'], 'FDJ')),
                    ],
                  )
                  .toList(),
            ),
          pw.SizedBox(height: 16),
          pw.Align(
            alignment: pw.Alignment.centerRight,
            child: pw.Text(
              'Total : ${money(item[receipt ? 'amount' : 'total'], label(data['currency'], 'FDJ'))}',
              style: pw.TextStyle(fontWeight: pw.FontWeight.bold),
            ),
          ),
          pw.SizedBox(height: 28),
          pw.Text(
            'Document emis par AL-HAKIM CENTER. Conservez votre reference de paiement.',
          ),
        ],
      ),
    );
    final filename =
        '${receipt ? 'Recu' : 'Facture'}_${pdfText(item[receipt ? 'studentName' : 'number']).replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_')}_${DateTime.now().toIso8601String().replaceAll(':', '-')}.pdf';
    await Printing.sharePdf(bytes: await pdf.save(), filename: filename);
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }
}

class StudentCardScreen extends StatelessWidget {
  final PortalApi api;
  const StudentCardScreen({super.key, required this.api});
  @override
  Widget build(BuildContext context) => RemoteView(
    load: () => api.get('/card'),
    builder: (card) => Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const PageTitle(
          'Ma carte étudiant',
          'Une carte personnelle avec vérification de validité par QR code.',
        ),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 620),
          child: CardVisual(card: card, api: api),
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            FilledButton.icon(
              onPressed: () => exportCard(context, card),
              icon: const Icon(Icons.download_outlined),
              label: const Text('Télécharger la carte PDF'),
            ),
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => Scaffold(
                    appBar: AppBar(title: const Text('Carte étudiant')),
                    body: Center(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(20),
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 650),
                          child: CardVisual(card: card, api: api),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              icon: const Icon(Icons.fullscreen),
              label: const Text('Afficher en plein écran'),
            ),
          ],
        ),
        const SizedBox(height: 20),
        const Text(
          'Le QR code contient uniquement un lien avec un identifiant aléatoire. La page publique ne présente ni coordonnées, ni notes, ni paiements.',
          style: TextStyle(color: muted, fontSize: 12),
        ),
      ],
    ),
  );
}

class CardVisual extends StatelessWidget {
  final Json card;
  final PortalApi api;
  const CardVisual({super.key, required this.card, required this.api});
  @override
  Widget build(BuildContext context) => Panel(
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Image.asset('assets/logo.png', height: 64, width: 64),
            const SizedBox(width: 16),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'AL-HAKIM CENTER',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: navy,
                    ),
                  ),
                  Text(
                    'CARTE ÉTUDIANT',
                    style: TextStyle(
                      color: pink,
                      fontSize: 10,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const Divider(height: 32),
        Wrap(
          spacing: 20,
          runSpacing: 18,
          children: [
            if (label(card['photoUrl'], '').isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Image.network(
                  api.absolute(card['photoUrl'] as String),
                  height: 100,
                  width: 80,
                  fit: BoxFit.cover,
                  errorBuilder: (_, error, stack) =>
                      const Icon(Icons.person_outline, size: 65),
                ),
              )
            else
              Container(
                width: 80,
                height: 100,
                decoration: BoxDecoration(
                  color: surface,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.person_outline, size: 44, color: muted),
              ),
            SizedBox(
              width: 230,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label(card['name']),
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 21,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    label(card['number']),
                    style: const TextStyle(
                      color: pink,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    label(
                      (card['courses'] as List?)?.join(' · '),
                      'Formation à confirmer',
                    ),
                    style: const TextStyle(fontSize: 12, color: muted),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: 20,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            QrImageView(
              data: label(card['verifyUrl']),
              size: 120,
              backgroundColor: Colors.white,
              semanticsLabel: 'QR code de vérification de la carte',
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  card['status'] == 'valid'
                      ? 'Carte valide'
                      : card['status'] == 'expired'
                      ? 'Carte expirée'
                      : 'Carte révoquée',
                  style: TextStyle(
                    color: card['status'] == 'valid' ? Colors.teal : Colors.red,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  'Du ${dateLabel(card['validFrom'])}',
                  style: const TextStyle(fontSize: 12, color: muted),
                ),
                Text(
                  'Au ${dateLabel(card['validUntil'])}',
                  style: const TextStyle(fontSize: 12, color: muted),
                ),
              ],
            ),
          ],
        ),
      ],
    ),
  );
}

Future<void> exportCard(BuildContext context, Json card) async {
  try {
    final logo = (await rootBundle.load('assets/logo.png')).buffer
        .asUint8List();
    final pdf = pw.Document();
    pdf.addPage(
      pw.Page(
        pageFormat: const PdfPageFormat(
          86 * PdfPageFormat.mm,
          54 * PdfPageFormat.mm,
          marginAll: 8,
        ),
        build: (_) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Row(
              children: [
                pw.Image(pw.MemoryImage(logo), width: 28, height: 28),
                pw.SizedBox(width: 8),
                pw.Text(
                  'AL-HAKIM CENTER',
                  style: pw.TextStyle(
                    fontWeight: pw.FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            pw.Divider(),
            pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Expanded(
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text(
                        pdfText(card['name']),
                        style: pw.TextStyle(
                          fontWeight: pw.FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                      pw.SizedBox(height: 5),
                      pw.Text(
                        pdfText(card['number']),
                        style: const pw.TextStyle(fontSize: 9),
                      ),
                      pw.Text(
                        pdfText((card['courses'] as List?)?.join(', ')),
                        maxLines: 2,
                        style: const pw.TextStyle(fontSize: 7),
                      ),
                      pw.Text(
                        'Valide au ${dateLabel(card['validUntil'])}',
                        style: const pw.TextStyle(fontSize: 7),
                      ),
                      pw.Text(
                        pdfText(card['status']),
                        style: const pw.TextStyle(fontSize: 7),
                      ),
                    ],
                  ),
                ),
                pw.BarcodeWidget(
                  barcode: pw.Barcode.qrCode(),
                  data: label(card['verifyUrl']),
                  width: 62,
                  height: 62,
                ),
              ],
            ),
          ],
        ),
      ),
    );
    await Printing.sharePdf(
      bytes: await pdf.save(),
      filename: 'Carte_${card['number']}.pdf',
    );
  } catch (e) {
    if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }
}

class ProfileScreen extends StatefulWidget {
  final PortalApi api;
  final Json user;
  final VoidCallback onPassword, onCard;
  const ProfileScreen({
    super.key,
    required this.api,
    required this.user,
    required this.onPassword,
    required this.onCard,
  });
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  late TextEditingController phone, email;
  bool busy = false;
  String? result;
  final form = GlobalKey<FormState>();
  @override
  void initState() {
    super.initState();
    phone = TextEditingController(text: label(widget.user['phone'], ''));
    email = TextEditingController(text: label(widget.user['email'], ''));
  }

  @override
  void dispose() {
    phone.dispose();
    email.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      const PageTitle(
        'Mon profil',
        'Vos informations personnelles et la sécurité de votre compte.',
      ),
      Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label(widget.user['name']),
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            DetailRow(
              'Identifiant',
              label(widget.user['username'] ?? widget.user['reference']),
            ),
            const Text(
              'L’identité, les formations et les informations administratives sont gérées par le centre.',
              style: TextStyle(color: muted, fontSize: 12),
            ),
          ],
        ),
      ),
      const SizedBox(height: 20),
      if (widget.api.role == 'student')
        Panel(
          child: Form(
            key: form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: phone,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Téléphone'),
                  validator: (v) =>
                      !RegExp(r'^[+0-9 ().-]{6,30}$').hasMatch(v ?? '')
                      ? 'Numéro invalide'
                      : null,
                ),
                const SizedBox(height: 18),
                TextFormField(
                  controller: email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'E-mail'),
                  validator: (v) =>
                      (v ?? '').isNotEmpty &&
                          !RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$').hasMatch(v!)
                      ? 'E-mail invalide'
                      : null,
                ),
                const SizedBox(height: 20),
                if (result != null) Text(result!),
                FilledButton(
                  onPressed: busy
                      ? null
                      : () async {
                          if (!form.currentState!.validate()) return;
                          setState(() => busy = true);
                          try {
                            await widget.api.patch('/profile', {
                              'phone': phone.text.trim(),
                              'email': email.text.trim(),
                            });
                            if (mounted) {
                              setState(
                                () => result = 'Coordonnées enregistrées.',
                              );
                            }
                          } catch (e) {
                            if (mounted) setState(() => result = e.toString());
                          } finally {
                            if (mounted) setState(() => busy = false);
                          }
                        },
                  child: Text(
                    busy ? 'Enregistrement…' : 'Enregistrer mes coordonnées',
                  ),
                ),
              ],
            ),
          ),
        ),
      const SizedBox(height: 20),
      Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          OutlinedButton.icon(
            onPressed: widget.onPassword,
            icon: const Icon(Icons.lock_outline),
            label: const Text('Changer mon mot de passe'),
          ),
          if (widget.api.role == 'student')
            FilledButton.icon(
              onPressed: widget.onCard,
              icon: const Icon(Icons.badge_outlined),
              label: const Text('Ma carte étudiant'),
            ),
        ],
      ),
    ],
  );
}
