import 'dart:ui';
import 'package:flutter/material.dart';
import 'liquid_glass.dart';
import 'theme.dart';

/// Fullscreen Expanded Now Playing Modal.
/// Ambient liquid background matching dominant album cover glow,
/// floating oversized album art with 3D drop-shadow, liquid scrub bar,
/// and frosted haptic controls.
class NowPlayingModal extends StatefulWidget {
  final VoidCallback? onClose;
  final VoidCallback? onOpenEqualizer;

  const NowPlayingModal({super.key, this.onClose, this.onOpenEqualizer});

  @override
  State<NowPlayingModal> createState() => _NowPlayingModalState();
}

class _NowPlayingModalState extends State<NowPlayingModal> {
  bool _isPlaying = true;
  double _progress = 0.38;
  bool _isLiked = true;
  bool _isShuffle = false;
  int _repeatMode = 1; // 0: off, 1: all, 2: one

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Blurred Ambient Glow matching album art
          Positioned.fill(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 50, sigmaY: 50),
              child: Container(
                color: LiquidGlassTheme.background.withValues(alpha: 0.85),
              ),
            ),
          ),

          // Dynamic Ambient Fluid Glow Mesh
          Positioned(
            top: -100,
            left: 50,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    LiquidGlassTheme.neonViolet.withValues(alpha: 0.4),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 50,
            right: 50,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    LiquidGlassTheme.electricCoral.withValues(alpha: 0.3),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // Foreground Content
          SafeArea(
            child: Center(
              child: Container(
                constraints: const BoxConstraints(maxWidth: 520),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Top Bar
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 30),
                          color: LiquidGlassTheme.textSecondary,
                          onPressed: widget.onClose,
                        ),
                        const Column(
                          children: [
                            Text(
                              'PLAYING FROM PLAYLIST',
                              style: TextStyle(
                                color: LiquidGlassTheme.textMuted,
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 1.2,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Daily Liquid Flow #1',
                              style: TextStyle(
                                color: LiquidGlassTheme.textPrimary,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: const Icon(Icons.more_horiz_rounded, size: 24),
                          color: LiquidGlassTheme.textSecondary,
                          onPressed: () {},
                        ),
                      ],
                    ),

                    // Oversized Floating 3D Album Artwork
                    Center(
                      child: Container(
                        width: 280,
                        height: 280,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(32),
                          boxShadow: [
                            BoxShadow(
                              color: LiquidGlassTheme.neonViolet.withValues(alpha: 0.4),
                              blurRadius: 40,
                              offset: const Offset(0, 20),
                            ),
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.6),
                              blurRadius: 30,
                              offset: const Offset(0, 15),
                            ),
                          ],
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.35),
                            width: 1.2,
                          ),
                          image: const DecorationImage(
                            image: NetworkImage(
                              'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80',
                            ),
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                    ),

                    // Title, Artist, & Like Button
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Synthetic Aurora (Horizon)',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: LiquidGlassTheme.textPrimary,
                                  fontSize: 22,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: -0.4,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  const Text(
                                    'Kavinsky & Tycho',
                                    style: TextStyle(
                                      color: LiquidGlassTheme.textSecondary,
                                      fontSize: 15,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: LiquidGlassTheme.cyberCyan.withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(6),
                                      border: Border.all(
                                        color: LiquidGlassTheme.cyberCyan.withValues(alpha: 0.3),
                                        width: 0.5,
                                      ),
                                    ),
                                    child: const Text(
                                      'MASTER 24-BIT',
                                      style: TextStyle(
                                        color: LiquidGlassTheme.cyberCyan,
                                        fontSize: 9,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: Icon(
                            _isLiked ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                            color: _isLiked ? LiquidGlassTheme.electricCoral : LiquidGlassTheme.textSecondary,
                            size: 26,
                          ),
                          onPressed: () => setState(() => _isLiked = !_isLiked),
                        ),
                      ],
                    ),

                    // Liquid Scrub Bar
                    Column(
                      children: [
                        LayoutBuilder(
                          builder: (context, constraints) {
                            return GestureDetector(
                              onHorizontalDragUpdate: (details) {
                                final p = (details.localPosition.dx / constraints.maxWidth).clamp(0.0, 1.0);
                                setState(() => _progress = p);
                              },
                              child: Container(
                                height: 8,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(4),
                                  color: Colors.white.withValues(alpha: 0.1),
                                ),
                                child: Stack(
                                  children: [
                                    FractionallySizedBox(
                                      widthFactor: _progress,
                                      child: Container(
                                        decoration: BoxDecoration(
                                          borderRadius: BorderRadius.circular(4),
                                          gradient: LiquidGlassTheme.violetCyanGradient,
                                          boxShadow: [
                                            BoxShadow(
                                              color: LiquidGlassTheme.cyberCyan.withValues(alpha: 0.6),
                                              blurRadius: 8,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 8),
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '1:42',
                              style: TextStyle(color: LiquidGlassTheme.textMuted, fontSize: 12),
                            ),
                            Text(
                              '3:58',
                              style: TextStyle(color: LiquidGlassTheme.textMuted, fontSize: 12),
                            ),
                          ],
                        ),
                      ],
                    ),

                    // Frosted Playback Island Controls
                    LiquidGlassContainer(
                      borderRadius: BorderRadius.circular(30),
                      glassOpacity: 0.12,
                      blurSigmaX: 24,
                      blurSigmaY: 24,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      borderGradient: LiquidGlassTheme.specularBorderGradient(),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          IconButton(
                            icon: Icon(
                              Icons.shuffle_rounded,
                              color: _isShuffle ? LiquidGlassTheme.cyberCyan : LiquidGlassTheme.textMuted,
                              size: 22,
                            ),
                            onPressed: () => setState(() => _isShuffle = !_isShuffle),
                          ),
                          IconButton(
                            icon: const Icon(Icons.skip_previous_rounded, size: 28),
                            color: LiquidGlassTheme.textPrimary,
                            onPressed: () {},
                          ),
                          // Primary Play/Pause Orb
                          GestureDetector(
                            onTap: () => setState(() => _isPlaying = !_isPlaying),
                            child: Container(
                              width: 58,
                              height: 58,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                gradient: LiquidGlassTheme.violetCyanGradient,
                                boxShadow: [
                                  BoxShadow(
                                    color: LiquidGlassTheme.neonViolet.withValues(alpha: 0.5),
                                    blurRadius: 20,
                                    spreadRadius: 2,
                                  ),
                                ],
                                border: Border.all(
                                  color: Colors.white.withValues(alpha: 0.5),
                                  width: 1.5,
                                ),
                              ),
                              child: Icon(
                                _isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                                color: Colors.white,
                                size: 32,
                              ),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.skip_next_rounded, size: 28),
                            color: LiquidGlassTheme.textPrimary,
                            onPressed: () {},
                          ),
                          IconButton(
                            icon: Icon(
                              Icons.repeat_rounded,
                              color: _repeatMode > 0 ? LiquidGlassTheme.cyberCyan : LiquidGlassTheme.textMuted,
                              size: 22,
                            ),
                            onPressed: () => setState(() => _repeatMode = (_repeatMode + 1) % 3),
                          ),
                        ],
                      ),
                    ),

                    // Bottom Utility Row (AirPlay/Cast & Equalizer)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconButton(
                          icon: const Icon(Icons.speaker_group_rounded, color: LiquidGlassTheme.textSecondary),
                          onPressed: () {},
                        ),
                        if (widget.onOpenEqualizer != null)
                          TextButton.icon(
                            style: TextButton.styleFrom(
                              backgroundColor: Colors.white.withValues(alpha: 0.08),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            ),
                            icon: const Icon(Icons.tune_rounded, size: 16, color: LiquidGlassTheme.cyberCyan),
                            label: const Text(
                              'DSP Equalizer',
                              style: TextStyle(
                                color: LiquidGlassTheme.textPrimary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            onPressed: widget.onOpenEqualizer,
                          ),
                        IconButton(
                          icon: const Icon(Icons.queue_music_rounded, color: LiquidGlassTheme.textSecondary),
                          onPressed: () {},
                        ),
                      ],
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
}
