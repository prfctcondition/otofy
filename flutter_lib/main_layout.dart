import 'package:flutter/material.dart';
import 'ambient_background.dart';
import 'dock_player.dart';
import 'liquid_glass.dart';
import 'theme.dart';

/// Adaptive Shell Layout switching dynamically between:
/// 1. Desktop (Windows/macOS): Floating frosted sidebar + expanded canvas + floating dock player.
/// 2. Mobile (Android/iOS): Fullscreen canvas + floating iOS glass bottom navigation bar + floating mini-player.
class LiquidGlassMainLayout extends StatefulWidget {
  final Widget currentScreen;
  final int selectedIndex;
  final ValueChanged<int> onIndexChanged;
  final VoidCallback? onOpenNowPlaying;
  final VoidCallback? onOpenEqualizer;

  const LiquidGlassMainLayout({
    super.key,
    required this.currentScreen,
    required this.selectedIndex,
    required this.onIndexChanged,
    this.onOpenNowPlaying,
    this.onOpenEqualizer,
  });

  @override
  State<LiquidGlassMainLayout> createState() => _LiquidGlassMainLayoutState();
}

class _LiquidGlassMainLayoutState extends State<LiquidGlassMainLayout> {
  bool _isPlaying = true;
  double _playbackProgress = 0.42;

  final List<_NavDestination> _destinations = const [
    _NavDestination(icon: Icons.explore_rounded, label: 'Discover'),
    _NavDestination(icon: Icons.search_rounded, label: 'Search'),
    _NavDestination(icon: Icons.queue_music_rounded, label: 'Library'),
    _NavDestination(icon: Icons.favorite_rounded, label: 'Favorites'),
  ];

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final isDesktop = constraints.maxWidth >= 840;

        return AmbientBackground(
          isPlayingPulse: _isPlaying,
          child: SafeArea(
            bottom: false,
            child: isDesktop ? _buildDesktopLayout() : _buildMobileLayout(),
          ),
        );
      },
    );
  }

  /// Desktop Layout: Floating Glass Sidebar + Main Canvas + Floating Dock
  Widget _buildDesktopLayout() {
    return Stack(
      children: [
        Row(
          children: [
            // Floating Frosted Sidebar
            Padding(
              padding: const EdgeInsets.only(left: 20.0, top: 20.0, bottom: 96.0),
              child: LiquidGlassContainer(
                width: 240,
                borderRadius: BorderRadius.circular(24.0),
                glassOpacity: 0.10,
                blurSigmaX: 30,
                blurSigmaY: 30,
                padding: const EdgeInsets.all(18.0),
                borderGradient: LiquidGlassTheme.specularBorderGradient(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Brand Header
                    Row(
                      children: [
                        Container(
                          width: 38,
                          height: 38,
                          decoration: BoxDecoration(
                            gradient: LiquidGlassTheme.violetCyanGradient,
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(
                                color: LiquidGlassTheme.neonViolet.withValues(alpha: 0.4),
                                blurRadius: 14,
                              ),
                            ],
                          ),
                          child: const Icon(Icons.blur_on_rounded, color: Colors.white, size: 22),
                        ),
                        const SizedBox(width: 12),
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'AETHERIA',
                              style: TextStyle(
                                color: LiquidGlassTheme.textPrimary,
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 1.2,
                              ),
                            ),
                            Text(
                              'Liquid Audio Engine',
                              style: TextStyle(
                                color: LiquidGlassTheme.textMuted,
                                fontSize: 10,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 32),

                    // Navigation Items
                    const Text(
                      'MENU',
                      style: TextStyle(
                        color: LiquidGlassTheme.textMuted,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.0,
                      ),
                    ),
                    const SizedBox(height: 12),

                    ...List.generate(_destinations.length, (index) {
                      final item = _destinations[index];
                      final isSelected = widget.selectedIndex == index;

                      return Padding(
                        padding: const EdgeInsets.only(bottom: 6.0),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(14),
                          onTap: () => widget.onIndexChanged(index),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(14),
                              color: isSelected
                                  ? Colors.white.withValues(alpha: 0.12)
                                  : Colors.transparent,
                              border: isSelected
                                  ? Border.all(
                                      color: Colors.white.withValues(alpha: 0.25),
                                      width: 0.8,
                                    )
                                  : null,
                              boxShadow: isSelected
                                  ? [
                                      BoxShadow(
                                        color: LiquidGlassTheme.neonViolet.withValues(alpha: 0.2),
                                        blurRadius: 12,
                                      ),
                                    ]
                                  : null,
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  item.icon,
                                  size: 20,
                                  color: isSelected
                                      ? LiquidGlassTheme.cyberCyan
                                      : LiquidGlassTheme.textSecondary,
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  item.label,
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                                    color: isSelected
                                        ? LiquidGlassTheme.textPrimary
                                        : LiquidGlassTheme.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),

                    const Spacer(),

                    // Audio Engine Quality Indicator
                    LiquidGlassContainer(
                      padding: const EdgeInsets.all(12),
                      borderRadius: BorderRadius.circular(14),
                      glassOpacity: 0.06,
                      blurSigmaX: 12,
                      blurSigmaY: 12,
                      child: Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: LiquidGlassTheme.mintGlow,
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              '96kHz / 24-bit Hi-Res',
                              style: TextStyle(
                                color: LiquidGlassTheme.textSecondary,
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Expanded Main Content Canvas
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 96.0),
                child: widget.currentScreen,
              ),
            ),
          ],
        ),

        // Floating Bottom Dock-Style Player
        Positioned(
          left: 260,
          right: 24,
          bottom: 12,
          child: DockPlayer(
            isDesktop: true,
            title: 'Synthetic Aurora (Neon Horizon)',
            artist: 'Kavinsky & Tycho',
            albumArtUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&q=80',
            isPlaying: _isPlaying,
            progress: _playbackProgress,
            onPlayPause: () => setState(() => _isPlaying = !_isPlaying),
            onSeek: (v) => setState(() => _playbackProgress = v),
            onTap: widget.onOpenNowPlaying,
            onOpenEqualizer: widget.onOpenEqualizer,
          ),
        ),
      ],
    );
  }

  /// Mobile Layout: Fullscreen Canvas + Floating Mini-Player Island + Floating Glass Tab Bar
  Widget _buildMobileLayout() {
    return Stack(
      children: [
        // Main Screen Body with bottom padding for dock + nav bar
        Positioned.fill(
          child: Padding(
            padding: const EdgeInsets.only(bottom: 140.0),
            child: widget.currentScreen,
          ),
        ),

        // Bottom Controls Overlay
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Floating Mini-Player Island
              DockPlayer(
                isDesktop: false,
                title: 'Synthetic Aurora',
                artist: 'Kavinsky & Tycho',
                albumArtUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&q=80',
                isPlaying: _isPlaying,
                progress: _playbackProgress,
                onPlayPause: () => setState(() => _isPlaying = !_isPlaying),
                onSeek: (v) => setState(() => _playbackProgress = v),
                onTap: widget.onOpenNowPlaying,
                onOpenEqualizer: widget.onOpenEqualizer,
              ),

              // Floating iOS-Style Frosted Glass Bottom Navigation Bar
              Padding(
                padding: const EdgeInsets.only(left: 20.0, right: 20.0, bottom: 18.0),
                child: LiquidGlassContainer(
                  borderRadius: BorderRadius.circular(32.0),
                  glassOpacity: 0.14,
                  blurSigmaX: 32,
                  blurSigmaY: 32,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  borderGradient: LiquidGlassTheme.specularBorderGradient(),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: List.generate(_destinations.length, (index) {
                      final item = _destinations[index];
                      final isSelected = widget.selectedIndex == index;

                      return GestureDetector(
                        onTap: () => widget.onIndexChanged(index),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(20),
                            color: isSelected
                                ? Colors.white.withValues(alpha: 0.15)
                                : Colors.transparent,
                            boxShadow: isSelected
                                ? [
                                    BoxShadow(
                                      color: LiquidGlassTheme.cyberCyan.withValues(alpha: 0.25),
                                      blurRadius: 10,
                                    ),
                                  ]
                                : null,
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                item.icon,
                                size: 22,
                                color: isSelected
                                    ? LiquidGlassTheme.cyberCyan
                                    : LiquidGlassTheme.textSecondary,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                item.label,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                                  color: isSelected
                                      ? LiquidGlassTheme.textPrimary
                                      : LiquidGlassTheme.textMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _NavDestination {
  final IconData icon;
  final String label;

  const _NavDestination({required this.icon, required this.label});
}
