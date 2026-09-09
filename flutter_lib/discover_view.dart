import 'package:flutter/material.dart';
import 'liquid_glass.dart';
import 'theme.dart';

/// Discover Screen with floating glass hero carousel, pill-shaped genre cards,
/// and frosted trending track cards with glass specular reflection highlights.
class DiscoverView extends StatelessWidget {
  final VoidCallback? onPlayTrack;

  const DiscoverView({super.key, this.onPlayTrack});

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        // App Bar / Greeting Area
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Good Evening',
                      style: TextStyle(
                        color: LiquidGlassTheme.textMuted,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        letterSpacing: 0.5,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Liquid Discover',
                      style: TextStyle(
                        color: LiquidGlassTheme.textPrimary,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.6,
                      ),
                    ),
                  ],
                ),
                // User Profile & Bell glass pill
                Row(
                  children: [
                    LiquidGlassContainer(
                      borderRadius: BorderRadius.circular(20),
                      padding: const EdgeInsets.all(8),
                      child: const Icon(
                        Icons.notifications_none_rounded,
                        color: LiquidGlassTheme.textSecondary,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.3),
                          width: 1,
                        ),
                        image: const DecorationImage(
                          image: NetworkImage(
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80',
                          ),
                          fit: BoxFit.cover,
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        // Floating Glass Hero Carousel ("Daily Mix", "Flow State", "Cyber Sunset")
        SliverToBoxAdapter(
          child: SizedBox(
            height: 220,
            child: ListView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                _buildHeroCard(
                  title: 'Daily Mix #1',
                  subtitle: 'Synthwave, Dream Pop, Cyber Ambient',
                  gradient: LiquidGlassTheme.violetCyanGradient,
                  imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80',
                  trackCount: '24 Tracks • 1h 48m',
                  badge: 'CURATED BY AI',
                  onTap: onPlayTrack,
                ),
                _buildHeroCard(
                  title: 'Deep Flow State',
                  subtitle: 'Binaural beats, Minimal Techno, Atmospheric',
                  gradient: LiquidGlassTheme.coralVioletGradient,
                  imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=500&q=80',
                  trackCount: '38 Tracks • 2h 30m',
                  badge: 'FOCUS FLOW',
                  onTap: onPlayTrack,
                ),
                _buildHeroCard(
                  title: 'Cyber Sunset Radio',
                  subtitle: 'Chillwave, French Electro, Neon Melodies',
                  gradient: const LinearGradient(
                    colors: [LiquidGlassTheme.cyberCyan, LiquidGlassTheme.mintGlow],
                  ),
                  imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80',
                  trackCount: '50 Tracks • 3h 15m',
                  badge: 'TOP STREAMING',
                  onTap: onPlayTrack,
                ),
              ],
            ),
          ),
        ),

        // Section Title: Liquid Soundscapes
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(24, 28, 24, 12),
            child: Text(
              'EXPLORE GENRES',
              style: TextStyle(
                color: LiquidGlassTheme.textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
          ),
        ),

        // Pill-shaped Genre Cards with layered glass reflections
        SliverToBoxAdapter(
          child: SizedBox(
            height: 48,
            child: ListView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                _buildGenrePill('🌌 Cyber Ambient', isSelected: true),
                _buildGenrePill('⚡ Synthwave 80s'),
                _buildGenrePill('🎹 Neo-Classical'),
                _buildGenrePill('🔮 Glitch Hop'),
                _buildGenrePill('☕ Lo-Fi Rainfall'),
                _buildGenrePill('🌊 Deep Liquid D&B'),
              ],
            ),
          ),
        ),

        // Section Title: Quick Play & Trending
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(24, 28, 24, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'HOTTEST RELEASES',
                  style: TextStyle(
                    color: LiquidGlassTheme.textMuted,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
                Text(
                  'View All',
                  style: TextStyle(
                    color: LiquidGlassTheme.cyberCyan,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),

        // Glass Track Rows
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              _buildTrackRow(
                title: 'Neon Odyssey (Overdrive Edit)',
                artist: 'Lorn & Perturbator',
                duration: '4:12',
                albumUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=200&q=80',
                source: 'YouTube Music',
                sourceColor: Colors.redAccent,
                onTap: onPlayTrack,
              ),
              _buildTrackRow(
                title: 'Resonance in Motion',
                artist: 'HOME & Disasterpeace',
                duration: '3:32',
                albumUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200&q=80',
                source: 'SoundCloud',
                sourceColor: Colors.orangeAccent,
                onTap: onPlayTrack,
              ),
              _buildTrackRow(
                title: 'Weightless Horizon (24-bit Flac)',
                artist: 'Marconi Union',
                duration: '8:05',
                albumUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&q=80',
                source: 'FLAC Master',
                sourceColor: LiquidGlassTheme.cyberCyan,
                onTap: onPlayTrack,
              ),
              _buildTrackRow(
                title: 'Solar Eclipse Dreams',
                artist: 'Tycho & Jon Hopkins',
                duration: '5:47',
                albumUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&q=80',
                source: 'YouTube Music',
                sourceColor: Colors.redAccent,
                onTap: onPlayTrack,
              ),
            ]),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 32)),
      ],
    );
  }

  Widget _buildHeroCard({
    required String title,
    required String subtitle,
    required Gradient gradient,
    required String imageUrl,
    required String trackCount,
    required String badge,
    VoidCallback? onTap,
  }) {
    return Container(
      width: 320,
      margin: const EdgeInsets.only(right: 16),
      child: LiquidGlassContainer(
        borderRadius: BorderRadius.circular(26),
        glassOpacity: 0.12,
        blurSigmaX: 28,
        blurSigmaY: 28,
        onTap: onTap,
        child: Stack(
          children: [
            // Background Artwork Image with soft opacity
            Positioned.fill(
              child: Opacity(
                opacity: 0.35,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(26),
                  child: Image.network(
                    imageUrl,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
            ),

            // Soft Gradient Glow Overlay
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(26),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.85),
                    ],
                  ),
                ),
              ),
            ),

            // Card Foreground Content
            Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  // Pill Badge
                  LiquidGlassContainer(
                    borderRadius: BorderRadius.circular(8),
                    glassOpacity: 0.2,
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    child: Text(
                      badge,
                      style: const TextStyle(
                        color: LiquidGlassTheme.cyberCyan,
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    title,
                    style: const TextStyle(
                      color: LiquidGlassTheme.textPrimary,
                      fontSize: 20,
                      fontWeight: FontWeight.w700,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: LiquidGlassTheme.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        trackCount,
                        style: const TextStyle(
                          color: LiquidGlassTheme.textMuted,
                          fontSize: 11,
                        ),
                      ),
                      // Floating Glass Play Orb
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: gradient,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.4),
                              blurRadius: 10,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGenrePill(String label, {bool isSelected = false}) {
    return Container(
      margin: const EdgeInsets.only(right: 10),
      child: LiquidGlassContainer(
        borderRadius: BorderRadius.circular(24),
        glassOpacity: isSelected ? 0.22 : 0.08,
        borderWidth: isSelected ? 1.2 : 0.8,
        borderGradient: isSelected
            ? const LinearGradient(
                colors: [LiquidGlassTheme.cyberCyan, LiquidGlassTheme.neonViolet],
              )
            : null,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? Colors.white : LiquidGlassTheme.textSecondary,
              fontSize: 13,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTrackRow({
    required String title,
    required String artist,
    required String duration,
    required String albumUrl,
    required String source,
    required Color sourceColor,
    VoidCallback? onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: LiquidGlassContainer(
        borderRadius: BorderRadius.circular(18),
        glassOpacity: 0.06,
        padding: const EdgeInsets.all(12),
        onTap: onTap,
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                albumUrl,
                width: 44,
                height: 44,
                fit: BoxFit.cover,
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: LiquidGlassTheme.textPrimary,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(
                        artist,
                        style: const TextStyle(
                          color: LiquidGlassTheme.textSecondary,
                          fontSize: 12,
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Glowing Source Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(4),
                          color: sourceColor.withValues(alpha: 0.15),
                          border: Border.all(
                            color: sourceColor.withValues(alpha: 0.3),
                            width: 0.5,
                          ),
                        ),
                        child: Text(
                          source,
                          style: TextStyle(
                            color: sourceColor,
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Text(
              duration,
              style: const TextStyle(
                color: LiquidGlassTheme.textMuted,
                fontSize: 12,
              ),
            ),
            const SizedBox(width: 10),
            IconButton(
              icon: const Icon(Icons.more_vert_rounded, size: 18),
              color: LiquidGlassTheme.textMuted,
              onPressed: () {},
            ),
          ],
        ),
      ),
    );
  }
}
