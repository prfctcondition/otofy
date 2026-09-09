import 'package:flutter/material.dart';
import 'liquid_glass.dart';
import 'theme.dart';

/// Library & Playlist View with frosted playlist headers,
/// frosted tracklist rows with ripples, and glowing source badges for YouTube Music & SoundCloud.
class LibraryView extends StatefulWidget {
  final VoidCallback? onPlayTrack;

  const LibraryView({super.key, this.onPlayTrack});

  @override
  State<LibraryView> createState() => _LibraryViewState();
}

class _LibraryViewState extends State<LibraryView> {
  int _selectedFilter = 0;
  final List<String> _filters = ['Playlists', 'Downloaded Hi-Res', 'Artists', 'Albums'];

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        // Title & Action Header
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
                      'Your Audio Vault',
                      style: TextStyle(
                        color: LiquidGlassTheme.textMuted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.8,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Library',
                      style: TextStyle(
                        color: LiquidGlassTheme.textPrimary,
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.6,
                      ),
                    ),
                  ],
                ),
                LiquidGlassContainer(
                  borderRadius: BorderRadius.circular(16),
                  glassOpacity: 0.12,
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: const Row(
                    children: [
                      Icon(Icons.add_rounded, size: 18, color: LiquidGlassTheme.cyberCyan),
                      SizedBox(width: 6),
                      Text(
                        'New Playlist',
                        style: TextStyle(
                          color: LiquidGlassTheme.textPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),

        // Filter Pills
        SliverToBoxAdapter(
          child: SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 24),
              children: List.generate(_filters.length, (index) {
                final isSelected = _selectedFilter == index;
                return Padding(
                  padding: const EdgeInsets.only(right: 10.0),
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedFilter = index),
                    child: LiquidGlassContainer(
                      borderRadius: BorderRadius.circular(20),
                      glassOpacity: isSelected ? 0.20 : 0.06,
                      borderWidth: isSelected ? 1.0 : 0.6,
                      borderGradient: isSelected
                          ? const LinearGradient(
                              colors: [LiquidGlassTheme.cyberCyan, LiquidGlassTheme.neonViolet],
                            )
                          : null,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Center(
                        child: Text(
                          _filters[index],
                          style: TextStyle(
                            color: isSelected ? Colors.white : LiquidGlassTheme.textSecondary,
                            fontSize: 12,
                            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
        ),

        // Featured Playlists Grid
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(24, 24, 24, 12),
            child: Text(
              'PINNED COLLECTIONS',
              style: TextStyle(
                color: LiquidGlassTheme.textMuted,
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 1.2,
              ),
            ),
          ),
        ),

        SliverToBoxAdapter(
          child: SizedBox(
            height: 160,
            child: ListView(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 24),
              children: [
                _buildCollectionCard(
                  title: 'Night Shift Code',
                  tracksCount: '64 Tracks',
                  dominantGradient: LiquidGlassTheme.violetCyanGradient,
                  imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80',
                  onTap: widget.onPlayTrack,
                ),
                _buildCollectionCard(
                  title: 'Binaural Deep Rest',
                  tracksCount: '28 Tracks',
                  dominantGradient: LiquidGlassTheme.coralVioletGradient,
                  imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&q=80',
                  onTap: widget.onPlayTrack,
                ),
                _buildCollectionCard(
                  title: 'SoundCloud Gems',
                  tracksCount: '112 Tracks',
                  dominantGradient: const LinearGradient(
                    colors: [Colors.orangeAccent, LiquidGlassTheme.electricCoral],
                  ),
                  imageUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
                  onTap: widget.onPlayTrack,
                ),
              ],
            ),
          ),
        ),

        // Tracklist Section
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(24, 24, 24, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'RECENTLY SAVED TRACKS',
                  style: TextStyle(
                    color: LiquidGlassTheme.textMuted,
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.2,
                  ),
                ),
                Text(
                  'Sorted by Date',
                  style: TextStyle(
                    color: LiquidGlassTheme.textSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
        ),

        // Track rows
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          sliver: SliverList(
            delegate: SliverChildListDelegate([
              _buildTrackItem(
                index: 1,
                title: 'Synthetic Aurora (Liquid Mix)',
                artist: 'Kavinsky & Tycho',
                album: 'Neon Horizons',
                duration: '3:58',
                source: 'YouTube Music',
                sourceColor: Colors.redAccent,
                albumArt: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&q=80',
                isPlaying: true,
                onTap: widget.onPlayTrack,
              ),
              _buildTrackItem(
                index: 2,
                title: 'Stardew Liquid Valley',
                artist: 'ConcernedApe (Synth Rework)',
                album: 'Peaceful Beats',
                duration: '4:15',
                source: 'SoundCloud',
                sourceColor: Colors.orangeAccent,
                albumArt: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&q=80',
                isPlaying: false,
                onTap: widget.onPlayTrack,
              ),
              _buildTrackItem(
                index: 3,
                title: 'Epilogue (Lossless DSD)',
                artist: 'Daft Punk',
                album: 'Random Access Memories',
                duration: '4:52',
                source: 'Master FLAC',
                sourceColor: LiquidGlassTheme.cyberCyan,
                albumArt: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&q=80',
                isPlaying: false,
                onTap: widget.onPlayTrack,
              ),
              _buildTrackItem(
                index: 4,
                title: 'Aerodynamic (Cyber Echoes)',
                artist: 'French 79 & Kid Francescoli',
                album: 'Midnight Pulse',
                duration: '3:45',
                source: 'YouTube Music',
                sourceColor: Colors.redAccent,
                albumArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=80',
                isPlaying: false,
                onTap: widget.onPlayTrack,
              ),
              _buildTrackItem(
                index: 5,
                title: 'Glow in the Mist',
                artist: 'Carbon Based Lifeforms',
                album: 'Derelicts',
                duration: '6:12',
                source: 'SoundCloud',
                sourceColor: Colors.orangeAccent,
                albumArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&q=80',
                isPlaying: false,
                onTap: widget.onPlayTrack,
              ),
            ]),
          ),
        ),

        const SliverToBoxAdapter(child: SizedBox(height: 32)),
      ],
    );
  }

  Widget _buildCollectionCard({
    required String title,
    required String tracksCount,
    required Gradient dominantGradient,
    required String imageUrl,
    VoidCallback? onTap,
  }) {
    return Container(
      width: 180,
      margin: const EdgeInsets.only(right: 14),
      child: LiquidGlassContainer(
        borderRadius: BorderRadius.circular(22),
        glassOpacity: 0.10,
        padding: const EdgeInsets.all(12),
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Image.network(
                    imageUrl,
                    height: 90,
                    width: double.infinity,
                    fit: BoxFit.cover,
                  ),
                ),
                Positioned(
                  bottom: 6,
                  right: 6,
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: dominantGradient,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.4),
                          blurRadius: 8,
                        ),
                      ],
                    ),
                    child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 18),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: LiquidGlassTheme.textPrimary,
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
            Text(
              tracksCount,
              style: const TextStyle(
                color: LiquidGlassTheme.textMuted,
                fontSize: 11,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTrackItem({
    required int index,
    required String title,
    required String artist,
    required String album,
    required String duration,
    required String source,
    required Color sourceColor,
    required String albumArt,
    required bool isPlaying,
    VoidCallback? onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: LiquidGlassContainer(
        borderRadius: BorderRadius.circular(16),
        glassOpacity: isPlaying ? 0.16 : 0.05,
        borderWidth: isPlaying ? 1.2 : 0.6,
        borderGradient: isPlaying
            ? const LinearGradient(
                colors: [LiquidGlassTheme.cyberCyan, LiquidGlassTheme.neonViolet],
              )
            : null,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        onTap: onTap,
        child: Row(
          children: [
            // Track Index or Equalizer animation
            SizedBox(
              width: 24,
              child: isPlaying
                  ? const Icon(Icons.equalizer_rounded, color: LiquidGlassTheme.cyberCyan, size: 18)
                  : Text(
                      '$index',
                      style: const TextStyle(
                        color: LiquidGlassTheme.textMuted,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
            ),
            const SizedBox(width: 8),

            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                albumArt,
                width: 42,
                height: 42,
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
                    style: TextStyle(
                      color: isPlaying ? LiquidGlassTheme.cyberCyan : LiquidGlassTheme.textPrimary,
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
                      // Glowing miniature tag badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
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
                            fontWeight: FontWeight.w700,
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
            const SizedBox(width: 8),
            IconButton(
              icon: const Icon(Icons.more_horiz_rounded, size: 20),
              color: LiquidGlassTheme.textMuted,
              onPressed: () {},
            ),
          ],
        ),
      ),
    );
  }
}
