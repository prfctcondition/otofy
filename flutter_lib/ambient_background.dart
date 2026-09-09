import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'theme.dart';

/// Ambient animated glowing background layer.
/// Emits soft, pulsing multi-spectral aurora orbs underneath frosted glass.
/// Optimized for 60-120fps with minimal GPU overdraw on mobile and desktop.
class AmbientBackground extends StatefulWidget {
  final Widget child;
  final Color primaryOrbColor;
  final Color secondaryOrbColor;
  final Color tertiaryOrbColor;
  final double pulseSpeed;
  final bool isPlayingPulse;

  const AmbientBackground({
    super.key,
    required this.child,
    this.primaryOrbColor = LiquidGlassTheme.neonViolet,
    this.secondaryOrbColor = LiquidGlassTheme.cyberCyan,
    this.tertiaryOrbColor = LiquidGlassTheme.electricCoral,
    this.pulseSpeed = 1.0,
    this.isPlayingPulse = true,
  });

  @override
  State<AmbientBackground> createState() => _AmbientBackgroundState();
}

class _AmbientBackgroundState extends State<AmbientBackground>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 14),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: LiquidGlassTheme.background,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Base Deep Mood Background
          Container(
            color: LiquidGlassTheme.background,
          ),

          // Animated Aurora Mesh Layer (RepaintBoundary to isolate canvas repaints)
          RepaintBoundary(
            child: AnimatedBuilder(
              animation: _controller,
              builder: (context, _) {
                final progress = _controller.value * 2 * math.pi;
                return CustomPaint(
                  painter: _AuroraOrbsPainter(
                    progress: progress,
                    primaryColor: widget.primaryOrbColor,
                    secondaryColor: widget.secondaryOrbColor,
                    tertiaryColor: widget.tertiaryOrbColor,
                    isPlayingPulse: widget.isPlayingPulse,
                  ),
                  size: Size.infinite,
                );
              },
            ),
          ),

          // Subtle Vignette and dark depth overlay
          IgnorePointer(
            child: Container(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.center,
                  radius: 1.3,
                  colors: [
                    Colors.transparent,
                    LiquidGlassTheme.background.withValues(alpha: 0.65),
                  ],
                ),
              ),
            ),
          ),

          // Main Foreground Content
          widget.child,
        ],
      ),
    );
  }
}

class _AuroraOrbsPainter extends CustomPainter {
  final double progress;
  final Color primaryColor;
  final Color secondaryColor;
  final Color tertiaryColor;
  final bool isPlayingPulse;

  _AuroraOrbsPainter({
    required this.progress,
    required this.primaryColor,
    required this.secondaryColor,
    required this.tertiaryColor,
    required this.isPlayingPulse,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final width = size.width;
    final height = size.height;

    // Music pulse modulation
    final musicPulse = isPlayingPulse ? math.sin(progress * 4) * 0.08 : 0.0;

    // Orb 1: Primary Neon Violet (Top-Left quadrant floating down)
    final p1X = width * (0.28 + 0.12 * math.sin(progress));
    final p1Y = height * (0.22 + 0.08 * math.cos(progress * 0.8));
    final r1 = (width * 0.42) * (1.0 + musicPulse);

    final paint1 = Paint()
      ..shader = RadialGradient(
        colors: [
          primaryColor.withValues(alpha: 0.38),
          primaryColor.withValues(alpha: 0.15),
          Colors.transparent,
        ],
        stops: const [0.0, 0.55, 1.0],
      ).createShader(Rect.fromCircle(center: Offset(p1X, p1Y), radius: r1));

    canvas.drawCircle(Offset(p1X, p1Y), r1, paint1);

    // Orb 2: Cyber Cyan (Right side hovering vertically)
    final p2X = width * (0.75 + 0.10 * math.cos(progress * 0.9));
    final p2Y = height * (0.45 + 0.14 * math.sin(progress * 1.1));
    final r2 = (width * 0.38) * (1.0 - musicPulse * 0.5);

    final paint2 = Paint()
      ..shader = RadialGradient(
        colors: [
          secondaryColor.withValues(alpha: 0.32),
          secondaryColor.withValues(alpha: 0.12),
          Colors.transparent,
        ],
        stops: const [0.0, 0.5, 1.0],
      ).createShader(Rect.fromCircle(center: Offset(p2X, p2Y), radius: r2));

    canvas.drawCircle(Offset(p2X, p2Y), r2, paint2);

    // Orb 3: Electric Coral (Bottom center pulsing)
    final p3X = width * (0.45 + 0.15 * math.sin(progress * 0.7));
    final p3Y = height * (0.80 + 0.07 * math.cos(progress));
    final r3 = (width * 0.45) * (1.0 + musicPulse * 0.8);

    final paint3 = Paint()
      ..shader = RadialGradient(
        colors: [
          tertiaryColor.withValues(alpha: 0.28),
          tertiaryColor.withValues(alpha: 0.08),
          Colors.transparent,
        ],
        stops: const [0.0, 0.6, 1.0],
      ).createShader(Rect.fromCircle(center: Offset(p3X, p3Y), radius: r3));

    canvas.drawCircle(Offset(p3X, p3Y), r3, paint3);
  }

  @override
  bool shouldRepaint(covariant _AuroraOrbsPainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.primaryColor != primaryColor ||
        oldDelegate.secondaryColor != secondaryColor ||
        oldDelegate.tertiaryColor != tertiaryColor;
  }
}
