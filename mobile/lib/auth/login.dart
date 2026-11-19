import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/theme.dart';
import '../widgets/common.dart';

class LoginScreen extends StatefulWidget {
  final String role;
  final void Function(String role) onRole;
  final Future<void> Function(String, String) onLogin;
  const LoginScreen({
    super.key,
    required this.role,
    required this.onRole,
    required this.onLogin,
  });
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final form = GlobalKey<FormState>();
  final username = TextEditingController(), password = TextEditingController();
  bool busy = false, obscure = true;
  String? error;
  @override
  void dispose() {
    username.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.onLogin(username.text.trim(), password.text);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Column(
              children: [
                Image.asset('assets/logo.png', height: 110),
                const SizedBox(height: 24),
                Text(
                  'Bienvenue au centre.',
                  style: Theme.of(context).textTheme.headlineLarge,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 10),
                const Text(
                  'Votre espace personnel pour apprendre et avancer.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: muted),
                ),
                const SizedBox(height: 26),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(
                      value: 'student',
                      label: Text('Étudiant'),
                      icon: Icon(Icons.school_outlined),
                    ),
                    ButtonSegment(
                      value: 'marketing',
                      label: Text('Marketing'),
                      icon: Icon(Icons.campaign_outlined),
                    ),
                  ],
                  selected: {widget.role},
                  onSelectionChanged: busy
                      ? null
                      : (values) {
                          username.clear();
                          password.clear();
                          widget.onRole(values.first);
                        },
                ),
                const SizedBox(height: 22),
                Panel(
                  child: Form(
                    key: form,
                    child: AutofillGroup(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            widget.role == 'student'
                                ? 'Espace Étudiant'
                                : 'Espace Marketing',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 20),
                          TextFormField(
                            controller: username,
                            autofillHints: const [AutofillHints.username],
                            keyboardType: widget.role == 'marketing'
                                ? TextInputType.emailAddress
                                : TextInputType.text,
                            decoration: InputDecoration(
                              labelText: widget.role == 'student'
                                  ? 'Identifiant étudiant'
                                  : 'Adresse e-mail',
                              prefixIcon: const Icon(Icons.person_outline),
                            ),
                            validator: (value) =>
                                value == null || value.trim().isEmpty
                                ? 'Renseignez votre identifiant.'
                                : null,
                          ),
                          const SizedBox(height: 18),
                          TextFormField(
                            controller: password,
                            obscureText: obscure,
                            autofillHints: const [AutofillHints.password],
                            onFieldSubmitted: (_) => submit(),
                            decoration: InputDecoration(
                              labelText: 'Mot de passe',
                              prefixIcon: const Icon(Icons.lock_outline),
                              suffixIcon: IconButton(
                                tooltip: obscure ? 'Afficher' : 'Masquer',
                                onPressed: () =>
                                    setState(() => obscure = !obscure),
                                icon: Icon(
                                  obscure
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                ),
                              ),
                            ),
                            validator: (value) => value == null || value.isEmpty
                                ? 'Renseignez votre mot de passe.'
                                : null,
                          ),
                          if (error != null)
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              child: Text(
                                error!,
                                style: const TextStyle(color: Colors.red),
                              ),
                            ),
                          const SizedBox(height: 22),
                          FilledButton(
                            onPressed: busy ? null : submit,
                            child: Text(busy ? 'Connexion…' : 'Me connecter'),
                          ),
                          const SizedBox(height: 16),
                          const Text(
                            'Identifiants oubliés ? Contactez le centre pour rétablir votre accès.',
                            style: TextStyle(color: muted, fontSize: 12),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 22),
                const Text(
                  'AL-HAKIM CENTER · Formation, langues & technologie',
                  style: TextStyle(color: muted, fontSize: 10),
                  textAlign: TextAlign.center,
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

class PasswordScreen extends StatefulWidget {
  final PortalApi api;
  final void Function(Json) onChanged;
  final VoidCallback onLogout;
  const PasswordScreen({
    super.key,
    required this.api,
    required this.onChanged,
    required this.onLogout,
  });
  @override
  State<PasswordScreen> createState() => _PasswordScreenState();
}

class _PasswordScreenState extends State<PasswordScreen> {
  final form = GlobalKey<FormState>();
  final current = TextEditingController(),
      password = TextEditingController(),
      confirm = TextEditingController();
  bool busy = false;
  String? error;
  @override
  void dispose() {
    current.dispose();
    password.dispose();
    confirm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Sécurité du compte'),
      actions: [
        TextButton(
          onPressed: widget.onLogout,
          child: const Text('Déconnexion'),
        ),
      ],
    ),
    body: Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Panel(
            child: Form(
              key: form,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(Icons.shield_outlined, size: 48, color: pink),
                  const SizedBox(height: 20),
                  const PageTitle(
                    'Votre mot de passe personnel',
                    'Au moins 12 caractères, avec majuscules, minuscules, chiffres et symboles.',
                  ),
                  TextFormField(
                    controller: current,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Mot de passe actuel',
                    ),
                    validator: (v) =>
                        v == null || v.isEmpty ? 'Champ obligatoire' : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: password,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Nouveau mot de passe',
                    ),
                    validator: (v) => v == null || v.length < 12
                        ? 'Utilisez au moins 12 caractères'
                        : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: confirm,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Confirmer le mot de passe',
                    ),
                    validator: (v) => v != password.text
                        ? 'Les mots de passe diffèrent'
                        : null,
                  ),
                  if (error != null)
                    Text(error!, style: const TextStyle(color: Colors.red)),
                  const SizedBox(height: 24),
                  FilledButton(
                    onPressed: busy
                        ? null
                        : () async {
                            if (!form.currentState!.validate()) return;
                            setState(() => busy = true);
                            try {
                              final result = await widget.api.post(
                                '/auth/password',
                                {
                                  'currentPassword': current.text,
                                  'newPassword': password.text,
                                },
                              );
                              widget.onChanged(result);
                            } catch (e) {
                              if (mounted) setState(() => error = e.toString());
                            } finally {
                              if (mounted) setState(() => busy = false);
                            }
                          },
                    child: Text(
                      busy ? 'Enregistrement…' : 'Enregistrer mon mot de passe',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
