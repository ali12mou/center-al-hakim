import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/theme.dart';

class BannerCarousel extends StatefulWidget {
  final List<Json> items;
  final PortalApi api;
  final void Function(String link) onOpen;
  const BannerCarousel({
    super.key,
    required this.items,
    required this.api,
    required this.onOpen,
  });
  @override
  State<BannerCarousel> createState() => _BannerCarouselState();
}

class _BannerCarouselState extends State<BannerCarousel>
    with WidgetsBindingObserver {
  final controller = PageController();
  Timer? timer;
  int index = 0;
  bool paused = false, visible = true;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    restart();
  }

  @override
  void didUpdateWidget(BannerCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    restart();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    visible = state == AppLifecycleState.resumed;
    restart();
  }

  void restart() {
    timer?.cancel();
    if (widget.items.length < 2 ||
        paused ||
        !visible ||
        MediaQuery.disableAnimationsOf(context)) {
      return;
    }
    timer = Timer.periodic(const Duration(seconds: 8), (_) {
      if (controller.hasClients) {
        controller.animateToPage(
          (index + 1) % widget.items.length,
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    controller.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return const SizedBox.shrink();
    return Column(
      children: [
        SizedBox(
          height: 280,
          child: PageView.builder(
            controller: controller,
            onPageChanged: (value) => setState(() => index = value),
            itemCount: widget.items.length,
            itemBuilder: (context, i) {
              final item = widget.items[i];
              return ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    Container(color: navy),
                    if (label(item['imageUrl'], '').isNotEmpty)
                      Image.network(
                        widget.api.absolute(item['imageUrl'] as String),
                        fit: BoxFit.cover,
                        errorBuilder: (_, error, stack) =>
                            const SizedBox.shrink(),
                      ),
                    Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xF2193964), Color(0x80193964)],
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(26),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            label(item['title']),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 24,
                              fontWeight: FontWeight.w800,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            label(item['description'], ''),
                            style: const TextStyle(color: Color(0xFFDFE9F7)),
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (label(item['buttonLink'], '').isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 18),
                              child: FilledButton.tonal(
                                onPressed: () =>
                                    widget.onOpen(item['buttonLink'] as String),
                                child: Text(
                                  label(item['buttonLabel'], 'Découvrir'),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
        if (widget.items.length > 1)
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text(
                '${index + 1} / ${widget.items.length}',
                style: const TextStyle(color: muted, fontSize: 12),
              ),
              IconButton(
                tooltip: 'Annonce précédente',
                onPressed: () => controller.animateToPage(
                  (index - 1 + widget.items.length) % widget.items.length,
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeOut,
                ),
                icon: const Icon(Icons.chevron_left),
              ),
              IconButton(
                tooltip: paused ? 'Reprendre le défilement' : 'Mettre en pause',
                onPressed: () {
                  setState(() => paused = !paused);
                  restart();
                },
                icon: Icon(paused ? Icons.play_arrow : Icons.pause),
              ),
              IconButton(
                tooltip: 'Annonce suivante',
                onPressed: () => controller.animateToPage(
                  (index + 1) % widget.items.length,
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeOut,
                ),
                icon: const Icon(Icons.chevron_right),
              ),
            ],
          ),
      ],
    );
  }
}
