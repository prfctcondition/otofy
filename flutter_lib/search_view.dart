import 'package:flutter/material.dart';
import 'liquid_glass.dart';
import 'theme.dart';

/// Search Screen with frosted pill search bar, smooth segment filters
/// ("All", "YouTube Music", "SoundCloud"), and floating track results.
class SearchView extends StatefulWidget {
  final VoidCallback? onPlayTrack;

  const SearchView({super.key, this.onPlayTrack});

  @override
  State<SearchView> createState() => _SearchViewState();
}

class _SearchViewState extends State<SearchView> {
  String _selectedSource = 'All';
  final TextEditingController _searchController = TextEditingController();

  final List<String> _sourceSegments = ['All', 'YouTube Music', 'SoundCloud', 'Lossless FLAC'];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Screen Title
          const Text(
            'Search Streams',
            style: TextStyle(
              color: LiquidGlassTheme.textPrimary,
              fontSize: 28,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.6,
            ),
          ),
          const SizedBox(height: 16),

          // Frosted Pill Search Bar
          LiquidGlassContainer(
            borderRadius: BorderRadius.circular(28),
            glassOpacity: 0.12,
            blurSigmaX: 24,
            blurSigmaY: 24,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
            borderGradient: LiquidGlassTheme.specularBorderGradient(),
            child: Row(
              children: [
                const Icon(Icons.search_rounded, color: LiquidGlassTheme.textMuted, size: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _searchController,
                    style: const TextStyle(color: LiquidGlassTheme.textPrimary, fontSize: 15),
                    decoration: const InputDecoration(
                      hintText: 'Search songs, synth artists, albums, or playlists...',
                      hintStyle: TextStyle(color: LiquidGlassTheme.textMuted, fontSize: 14),
                      border: InputBorder.none,
                    ),
                  ),
                ),
                if (_searchController.text.isNotEmpty)
                  IconButton(
                    icon: const Icon(Icons.clear_rounded, size: 18, color: LiquidGlassTheme.textMuted),
                    onPressed: () {
                      setState(() {
                        _searchController.clear();
                      });
                    },
                  ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    color: Colors.white.withValues(alpha: 0.08),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.mic_none_rounded, size: 16, color: LiquidGlassTheme.cyberCyan),
                      SizedBox(width: 4),
                      Text(
                        'Voice',
                        style: TextStyle(
                          color: LiquidGlassTheme.cyberCyan,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Segment Filters ("All", "YouTube Music", "SoundCloud", "Lossless FLAC")
          SizedBox(
            height: 40,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: _sourceSegments.map((segment) {
                final isSelected = _selectedSource == segment;
                return Padding(
                  padding: const EdgeInsets.only(right: 10.0),
                  child: GestureDetector(
                    onTap: () => setState(() => _selectedSource = segment),
                    child: LiquidGlassContainer(
                      borderRadius: BorderRadius.circular(20),
                      glassOpacity: isSelected ? 0.22 : 0.06,
                      borderWidth: isSelected ? 1.2 : 0.8,
                      borderGradient: isSelected
                          ? const LinearGradient(
                              colors: [LiquidGlassTheme.cyberCyan, LiquidGlassTheme.neonViolet],
                            )
                          : null,
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      child: Center(
                        child: Text(
                          segment,
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
              }).toList(),
            ),
          ),
          const SizedBox(height: 20),

          // Results header
          const Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'TOP MATCHES',
                style: TextStyle(
                  color: LiquidGlassTheme.textMuted,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
              Text(
                'High Bitrate Only',
                style: TextStyle(
                  color: LiquidGlassTheme.mintGlow,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Floating Track Results
          Expanded(
            child: ListView(
              physics: const BouncingScrollPhysics(),
              children: [
                _buildResultItem(
                  title: 'Midnight City (Cyberpunk Remix)',
                  artist: 'M83 & Daniel Deluxe',
                  album: 'Hurry Up, We\'re Dreaming (Remixed)',
                  albumArt: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=80',
                  sourceTag: 'YouTube Music',
                  sourceTagColor: Colors.redAccent,
                  duration: '4:03',
                  onTap: widget.onPlayTrack,
                ),
                _buildResultItem(
                  title: 'A Walk Under Neon Rain',
                  artist: 'Tycho',
                  album: 'Dive (Deluxe Glass Edition)',
                  albumArt: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&q=80',
                  sourceTag: 'SoundCloud',
                  sourceTagColor: Colors.orangeAccent,
                  duration: '5:16',
                  onTap: widget.onPlayTrack,
                ),
                _buildResultItem(
                  title: 'Nightcall (Liquid Crystal Mix)',
                  artist: 'Kavinsky & Lovefoxxx',
                  album: 'OutRun OST',
                  albumArt: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=200&q=80',
                  sourceTag: 'FLAC Master',
                  sourceTagColor: LiquidGlassTheme.cyberCyan,
                  duration: '4:18',
                  onTap: widget.onPlayTrack,
                ),
                _buildResultItem(
                  title: 'Genesis of Cyberlight',
                  artist: 'Justice & Carpenter Brut',
                  album: 'Crossroads',
                  albumArt: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&q=80',
                  sourceTag: 'YouTube Music',
                  sourceTagColor: Colors.redAccent,
                  duration: '3:54',
                  onTap: widget.onPlayTrack,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildResultItem({
    required String title,
    required String artist,
    required String album,
    required String albumArt,
    required String sourceTag,
    required Color sourceTagColor,
    required String duration,
    VoidCallback? onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10.0),
      child: LiquidGlassContainer(
        borderRadius: BorderRadius.circular(20),
        glassOpacity: 0.08,
        padding: const EdgeInsets.all(12),
        onTap: onTap,
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.network(
                albumArt,
                width: 48,
                height: 48,
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
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(4),
                          color: sourceTagColor.withValues(alpha: 0.15),
                          border: Border.all(
                            color: sourceTagColor.withValues(alpha: 0.3),
                            width: 0.5,
                          ),
                        ),
                        child: Text(
                          sourceTag,
                          style: TextStyle(
                            color: sourceTagColor,
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
              icon: const Icon(Icons.play_circle_outline_rounded, size: 24),
              color: LiquidGlassTheme.cyberCyan,
              onPressed: onTap,
            ),
          ],
        ),
      ),
    );
  }
}
