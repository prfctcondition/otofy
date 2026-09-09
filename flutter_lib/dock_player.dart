import 'package:flutter/material.dart';
import 'liquid_glass.dart';
import 'theme.dart';

/// Floating glass dock-style player widget (mini-player island).
/// Hovers gracefully above content with real-time blur and glowing controls.
class DockPlayer extends StatelessWidget {
  final String title;
  final String artist;
  final String albumArtUrl;
  final bool isPlaying;
  final double progress; // 0.0 to 1.0
  final VoidCallback? onPlayPause;
  final VoidCallback? onNext;
  final VoidCallback? onPrevious;
  final VoidCallback? onTap;
  final VoidCallback? onOpenEqualizer;
  final ValueChanged<double>? onSeek;
  final bool isDesktop;

  const DockPlayer({
    super.key,
    required this.title,
    required this.artist,
    required this.albumArtUrl,
    required this.isPlaying,
    required this.progress,
    this.onPlayPause,
    this.onNext,
    this.onPrevious,
    this.onTap,
    this.onOpenEqualizer,
    this.onSeek,
    this.isDesktop = true,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: isDesktop ? 24.0 : 14.0,
        vertical: 12.0,
      ),
      child: LiquidGlassContainer(
        borderRadius: BorderRadius.circular(24.0),
        glassOpacity: 0.12,
        blurSigmaX: 30.0,
        blurSigmaY: 30.0,
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        borderGradient: LiquidGlassTheme.specularBorderGradient(
          opacityTop: 0.35,
          opacityBottom: 0.05,
        ),
        shadows: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.45),
            blurRadius: 32,
            offset: const Offset(0, 16),
          ),
          BoxShadow(
            color: LiquidGlassTheme.neonViolet.withValues(alpha: 0.15),
            blurRadius: 28,
            spreadRadius: -4,
          ),
        ],
        onTap: onTap,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                // Album Art with glass highlight rim
                Container(
                  width: isDesktop ? 50 : 44,
                  height: isDesktop ? 50 : 44,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12.0),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.25),
                      width: 0.8,
                    ),
                    image: DecorationImage(
                      image: NetworkImage(albumArtUrl),
                      fit: BoxFit.cover,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: LiquidGlassTheme.neonViolet.withValues(alpha: 0.3),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),

                // Track Metadata
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: LiquidGlassTheme.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Text(
                            artist,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: LiquidGlassTheme.textSecondary,
                              fontSize: 12,
                              fontWeight: FontWeight.w400,
                            ),
                          ),
                          const SizedBox(width: 6),
                          // Mini source tag badge
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(4),
                              color: Colors.white.withValues(alpha: 0.08),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.15),
                                width: 0.5,
                              ),
                            ),
                            child: const Text(
                              'LOSSLESS',
                              style: TextStyle(
                                color: LiquidGlassTheme.cyberCyan,
                                fontSize: 8,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Desktop Scrubber Bar inside dock
                if (isDesktop) ...[
                  const SizedBox(width: 20),
                  Expanded(
                    flex: 2,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildScrubberBar(),
                        const SizedBox(height: 4),
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '1:42',
                              style: TextStyle(color: LiquidGlassTheme.textMuted, fontSize: 10),
                            ),
                            Text(
                              '3:58',
                              style: TextStyle(color: LiquidGlassTheme.textMuted, fontSize: 10),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 24),
                ],

                // Playback Controls
                if (isDesktop) ...[
                  IconButton(
                    icon: const Icon(Icons.skip_previous_rounded, size: 22),
                    color: LiquidGlassTheme.textSecondary,
                    onPressed: onPrevious,
                  ),
                ],

                // Glowing Play/Pause Island Button
                GestureDetector(
                  onTap: onPlayPause,
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LiquidGlassTheme.violetCyanGradient,
                      boxShadow: [
                        BoxShadow(
                          color: LiquidGlassTheme.neonViolet.withValues(alpha: 0.45),
                          blurRadius: 16,
                          spreadRadius: 1,
                        ),
                      ],
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.4),
                        width: 1.0,
                      ),
                    ),
                    child: Icon(
                      isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                      color: Colors.white,
                      size: 26,
                    ),
                  ),
                ),

                IconButton(
                  icon: const Icon(Icons.skip_next_rounded, size: 22),
                  color: LiquidGlassTheme.textSecondary,
                  onPressed: onNext,
                ),

                // Equalizer sheet trigger
                if (onOpenEqualizer != null)
                  IconButton(
                    icon: const Icon(Icons.tune_rounded, size: 20),
                    color: LiquidGlassTheme.cyberCyan,
                    onPressed: onOpenEqualizer,
                  ),
              ],
            ),

            // Compact Progress Bar on Mobile
            if (!isDesktop) ...[
              const SizedBox(height: 8),
              _buildScrubberBar(),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildScrubberBar() {
    return LayoutBuilder(
      builder: (context, constraints) {
        return GestureDetector(
          onHorizontalDragUpdate: (details) {
            if (onSeek != null) {
              final newProgress = (details.localPosition.dx / constraints.maxWidth).clamp(0.0, 1.0);
              onSeek!(newProgress);
            }
          },
          child: Container(
            height: 4,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(2),
              color: Colors.white.withValues(alpha: 0.1),
            ),
            child: Stack(
              children: [
                FractionallySizedBox(
                  widthFactor: progress.clamp(0.0, 1.0),
                  child: Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(2),
                      gradient: LiquidGlassTheme.violetCyanGradient,
                      boxShadow: [
                        BoxShadow(
                          color: LiquidGlassTheme.cyberCyan.withValues(alpha: 0.6),
                          blurRadius: 6,
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
    );
  }
}
