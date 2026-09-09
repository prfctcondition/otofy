export interface FlutterFile {
  name: string;
  description: string;
  code: string;
}

export const FLUTTER_DELIVERABLES: FlutterFile[] = [
  {
    name: 'liquid_glass_panel.dart',
    description: 'Genuine iOS Light Mode Liquid White Glass container with high translucency (alpha 0.35-0.45), BackdropFilter blur (sigma 35), 1.2px directional specular border, and dual-layer shadow.',
    code: `import 'dart:ui';
import 'package:flutter/material.dart';

/// Reusable iOS Light Mode Liquid White Glass Panel Container.
///
/// Implements genuine refraction-heavy frosted milk glass surface rendering:
/// - Real-time background blur via [BackdropFilter] (sigma 35)
/// - High-translucency milky white glass fill ([fillAlpha]: 0.35 - 0.45)
/// - Directional 1.2px Specular Bevel Border (top-left crisp white, bottom-right dark sheen)
/// - Dual-layer box shadow: soft ambient spread (0x1A000000, blur 24, y: 10) + top rim gloss
class LiquidGlassPanel extends StatelessWidget {
  final Widget child;
  final double blurSigma;
  final double fillAlpha;
  final double borderWidth;
  final BorderRadius? borderRadius;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double? width;
  final double? height;
  final bool hasInnerGlossSheen;
  final List<BoxShadow>? customShadows;

  const LiquidGlassPanel({
    super.key,
    required this.child,
    this.blurSigma = 35.0,
    this.fillAlpha = 0.38, // 35% - 45% maximum for true liquid refraction
    this.borderWidth = 1.2,
    this.borderRadius,
    this.padding,
    this.margin,
    this.width,
    this.height,
    this.hasInnerGlossSheen = true,
    this.customShadows,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveRadius = borderRadius ?? BorderRadius.circular(20);

    return Container(
      width: width,
      height: height,
      margin: margin,
      decoration: BoxDecoration(
        borderRadius: effectiveRadius,
        // Dual-Layer Box Shadow: Soft spread + depth
        boxShadow: customShadows ??
            const [
              BoxShadow(
                color: Color(0x1A000000), // 10% black ambient depth
                blurRadius: 24,
                offset: Offset(0, 10),
                spreadRadius: -4,
              ),
              BoxShadow(
                color: Color(0x0A000000),
                blurRadius: 8,
                offset: Offset(0, 2),
                spreadRadius: 0,
              ),
            ],
      ),
      child: ClipRRect(
        borderRadius: effectiveRadius,
        child: BackdropFilter(
          filter: ImageFilter.blur(
            sigmaX: blurSigma,
            sigmaY: blurSigma,
          ),
          child: CustomPaint(
            foregroundPainter: _SpecularBorderPainter(
              borderRadius: effectiveRadius,
              borderWidth: borderWidth,
            ),
            child: Stack(
              children: [
                // High-Translucency Frosted Milk Glass Background Fill
                Container(
                  padding: padding,
                  color: Colors.white.withValues(alpha: fillAlpha),
                  child: child,
                ),

                // Inner Top Rim Gloss Reflection (Simulates upper specular refraction)
                if (hasInnerGlossSheen)
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 28,
                    child: IgnorePointer(
                      child: Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.white.withValues(alpha: 0.35),
                              Colors.white.withValues(alpha: 0.0),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Directional Specular Border Painter:
/// Renders a crisp 1.2px border with linear gradient:
/// Top-Left: Pure White (1.0) -> Middle: Semi-translucent (0.10) -> Bottom-Right: Soft dark rim (0.05)
class _SpecularBorderPainter extends CustomPainter {
  final BorderRadius borderRadius;
  final double borderWidth;

  _SpecularBorderPainter({
    required this.borderRadius,
    required this.borderWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final rrect = borderRadius.toRRect(rect).deflate(borderWidth / 2);

    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth
      ..shader = const LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [
          Colors.white,
          Color(0x1AFFFFFF), // Colors.white with alpha 0.10
          Color(0x0D000000), // Colors.black with alpha 0.05
        ],
        stops: [0.0, 0.45, 1.0],
      ).createShader(rect);

    canvas.drawRRect(rrect, paint);
  }

  @override
  bool shouldRepaint(covariant _SpecularBorderPainter oldDelegate) {
    return oldDelegate.borderWidth != borderWidth ||
        oldDelegate.borderRadius != borderRadius;
  }
}

/// Polished Wet Glass Drop Chip / Button widget:
/// Colors.white.withValues(alpha: 0.65) with bright white rim border.
class LiquidGlassWetDrop extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final BorderRadius? borderRadius;
  final bool isSelected;

  const LiquidGlassWetDrop({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
    this.borderRadius,
    this.isSelected = false,
  });

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(20);

    return InkWell(
      onTap: onTap,
      borderRadius: radius,
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          borderRadius: radius,
          color: isSelected
              ? Colors.white.withValues(alpha: 0.85)
              : Colors.white.withValues(alpha: 0.65),
          border: Border.all(
            color: Colors.white.withValues(alpha: isSelected ? 1.0 : 0.90),
            width: 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
            const BoxShadow(
              color: Color(0x66FFFFFF),
              blurRadius: 2,
              offset: Offset(0, 1),
            ),
          ],
        ),
        child: child,
      ),
    );
  }
}
`,
  },
  {
    name: 'app_shell_layout.dart',
    description: '3-column desktop layout scaffold with cool ice grey canvas (#E2E8F0), dynamic liquid gradient mesh (#6366F1, #38BDF8, #E879F9) refracting behind high-translucency floating glass panels, and 12px floating island margins.',
    code: `import 'dart:ui';
import 'package:flutter/material.dart';
import 'liquid_glass_panel.dart';
import 'liquid_hero_header.dart';
import 'dense_track_table.dart';
import 'dock_player_bar.dart';

/// Top-level shell layout matching the 3-column desktop blueprint
/// with floating island margins (12px) and real iOS Liquid White Glass refraction.
class AppShellLayout extends StatefulWidget {
  const AppShellLayout({super.key});

  @override
  State<AppShellLayout> createState() => _AppShellLayoutState();
}

class _AppShellLayoutState extends State<AppShellLayout> {
  bool _isSidebarCollapsed = false;
  bool _isRightInspectionOpen = true;
  String _selectedPlaylist = 'Liked Songs';

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktop = screenWidth >= 1024;

    return Scaffold(
      // Cool ice grey canvas
      backgroundColor: const Color(0xFFE2E8F0),
      body: Stack(
        children: [
          // 1. DYNAMIC ORGANIC LIQUID GRADIENT MESH BEHIND PANELS
          // Glass panels blur and refract these vibrant liquid hues beneath them
          _buildDynamicLiquidMesh(),

          // 2. MAIN APPLICATION CONTENT
          SafeArea(
            child: Column(
              children: [
                // Top Global Navigation Bar in Frosted Glass
                _buildTopNavBar(isDesktop),

                // Floating Islands: 12px margins around all columns
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: isDesktop
                        ? _buildDesktop3Column()
                        : _buildMobileFallback(),
                  ),
                ),

                // Floating Dock Player Bar Island (84px)
                if (isDesktop)
                  const Padding(
                    padding: EdgeInsets.fromLTRB(12, 0, 12, 12),
                    child: DockPlayerBar(),
                  ),
              ],
            ),
          ),
        ],
      ),
      // Mobile Bottom Navigation Bar
      bottomNavigationBar: !isDesktop ? _buildMobileBottomNav() : null,
    );
  }

  /// Dynamic Layered Liquid Gradient Mesh:
  /// - Top-Left & Center: Pastel Indigo (#6366F1) & Electric Cyan (#38BDF8) at 35% opacity
  /// - Mid-canvas fluid refraction orb
  /// - Right & Bottom: Soft Magenta / Orchid orb (#E879F9 at 25% opacity)
  Widget _buildDynamicLiquidMesh() {
    return Positioned.fill(
      child: IgnorePointer(
        child: Stack(
          children: [
            // Top-Left & Center Indigo / Cyan Glow (35% opacity, 75px blur)
            Positioned(
              top: -80,
              left: -60,
              width: 620,
              height: 580,
              child: ImageFiltered(
                imageFilter: ImageFilter.blur(sigmaX: 75, sigmaY: 75),
                child: Container(
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      center: Alignment(-0.2, -0.2),
                      colors: [
                        Color(0x596366F1), // #6366F1 at 35%
                        Color(0x5938BDF8), // #38BDF8 at 35%
                        Colors.transparent,
                      ],
                      stops: [0.0, 0.55, 0.85],
                    ),
                  ),
                ),
              ),
            ),

            // Mid-Canvas Refraction Orb: Electric Cyan & Soft Indigo
            Positioned(
              top: 200,
              left: 280,
              width: 520,
              height: 480,
              child: ImageFiltered(
                imageFilter: ImageFilter.blur(sigmaX: 80, sigmaY: 80),
                child: Container(
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        Color(0x4D38BDF8), // 30%
                        Color(0x4D818CF8),
                        Colors.transparent,
                      ],
                      stops: [0.0, 0.50, 0.80],
                    ),
                  ),
                ),
              ),
            ),

            // Right & Bottom Soft Magenta / Orchid Orb (#E879F9 at 25% opacity)
            Positioned(
              bottom: -60,
              right: -50,
              width: 560,
              height: 520,
              child: ImageFiltered(
                imageFilter: ImageFilter.blur(sigmaX: 75, sigmaY: 75),
                child: Container(
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      center: Alignment(0.2, 0.2),
                      colors: [
                        Color(0x40E879F9), // #E879F9 at 25%
                        Color(0x33C084FC),
                        Colors.transparent,
                      ],
                      stops: [0.0, 0.50, 0.80],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Top Frosted Navigation Bar in Liquid Glass
  Widget _buildTopNavBar(bool isDesktop) {
    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.40),
        border: Border(
          bottom: BorderSide(
            color: Colors.white.withValues(alpha: 0.80),
            width: 1.0,
          ),
        ),
      ),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.chevron_left, color: Color(0xFF64748B)),
            onPressed: () {},
          ),
          // Wet Glass Home Button
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.65),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white),
              boxShadow: const [
                BoxShadow(color: Color(0x0D000000), blurRadius: 6, offset: Offset(0, 2)),
              ],
            ),
            child: const Icon(Icons.home_outlined, color: Color(0xFF0F172A), size: 20),
          ),
          const SizedBox(width: 16),

          // Search Pill as Polished Wet Glass Drop
          Expanded(
            child: Center(
              child: Container(
                constraints: const BoxConstraints(maxWidth: 480),
                height: 38,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.60),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.95)),
                  boxShadow: const [
                    BoxShadow(color: Color(0x0A000000), blurRadius: 8, offset: Offset(0, 2)),
                  ],
                ),
                child: const Row(
                  children: [
                    Icon(Icons.search, color: Color(0xFF64748B), size: 18),
                    SizedBox(width: 8),
                    Text(
                      'What do you want to play?',
                      style: TextStyle(color: Color(0xFF64748B), fontSize: 13, fontWeight: FontWeight.w500),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),

          if (isDesktop) ...[
            IconButton(
              icon: Icon(
                _isRightInspectionOpen ? Icons.view_sidebar : Icons.view_sidebar_outlined,
                color: _isRightInspectionOpen ? const Color(0xFF0F172A) : const Color(0xFF64748B),
                size: 20,
              ),
              onPressed: () => setState(() => _isRightInspectionOpen = !_isRightInspectionOpen),
            ),
          ],
          CircleAvatar(
            radius: 16,
            backgroundColor: Colors.white.withValues(alpha: 0.85),
            child: const Text('A', style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 12)),
          ),
        ],
      ),
    );
  }

  /// Desktop 3-Column Layout: Left Dock (260px), Center Canvas, Right Inspector (300px)
  /// All floating as separate glass island panes with 12px spacing
  Widget _buildDesktop3Column() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Left Column: Library Dock
        SizedBox(
          width: _isSidebarCollapsed ? 72 : 260,
          child: LiquidGlassPanel(
            borderRadius: BorderRadius.circular(20),
            child: _buildLibraryDockContent(),
          ),
        ),
        const SizedBox(width: 12), // 12px floating island gap

        // Center Column: Main Canvas (Hero Header + High-Density Tracklist)
        Expanded(
          child: LiquidGlassPanel(
            borderRadius: BorderRadius.circular(20),
            padding: EdgeInsets.zero,
            child: ListView(
              padding: EdgeInsets.zero,
              children: const [
                LiquidHeroHeader(),
                DenseTrackTable(),
              ],
            ),
          ),
        ),

        // Right Column: Now Playing Inspection Panel
        if (_isRightInspectionOpen) ...[
          const SizedBox(width: 12), // 12px floating island gap
          SizedBox(
            width: 300,
            child: LiquidGlassPanel(
              borderRadius: BorderRadius.circular(20),
              child: _buildRightInspectionContent(),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildLibraryDockContent() {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(14.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(Icons.library_music_outlined, color: Color(0xFF0F172A)),
                  if (!_isSidebarCollapsed) ...[
                    const SizedBox(width: 10),
                    const Text('Your Library', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A), fontSize: 14)),
                  ],
                ],
              ),
              if (!_isSidebarCollapsed)
                IconButton(
                  icon: const Icon(Icons.chevron_left, color: Color(0xFF64748B)),
                  onPressed: () => setState(() => _isSidebarCollapsed = true),
                ),
            ],
          ),
        ),
        const Divider(color: Color(0x14000000), height: 1),
        // Playlist entries
        Expanded(
          child: ListView(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            children: [
              _buildPlaylistItem('Liked Songs', 'Playlist • 71 songs', Icons.favorite, true),
              _buildPlaylistItem('Cyber Wave 2026', 'Playlist • 42 songs', Icons.album, false),
              _buildPlaylistItem('Midnight Drive', 'Playlist • 28 songs', Icons.music_note, false),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPlaylistItem(String title, String subtitle, IconData icon, bool isSelected) {
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: isSelected ? Colors.white.withValues(alpha: 0.70) : Colors.transparent,
        borderRadius: BorderRadius.circular(12),
        border: isSelected ? Border.all(color: Colors.white) : null,
        boxShadow: isSelected
            ? const [
                BoxShadow(color: Color(0x0D000000), blurRadius: 10, offset: Offset(0, 3)),
              ]
            : null,
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: Colors.white.withValues(alpha: 0.80),
              border: Border.all(color: Colors.white),
            ),
            child: Icon(icon, color: const Color(0xFF0F172A), size: 22),
          ),
          if (!_isSidebarCollapsed) ...[
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A), fontSize: 13)),
                  Text(subtitle, style: const TextStyle(color: Color(0xFF64748B), fontSize: 11)),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildRightInspectionContent() {
    return ListView(
      padding: const EdgeInsets.all(14),
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              'NOW PLAYING',
              style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF64748B), fontSize: 11, letterSpacing: 1.2),
            ),
            IconButton(
              icon: const Icon(Icons.close, color: Color(0xFF64748B), size: 18),
              onPressed: () => setState(() => _isRightInspectionOpen = false),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // Vector artwork placeholder with specular sheen
        Container(
          height: 260,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            color: Colors.white.withValues(alpha: 0.70),
            border: Border.all(color: Colors.white),
            boxShadow: const [
              BoxShadow(color: Color(0x14000000), blurRadius: 18, offset: Offset(0, 8)),
            ],
          ),
          child: const Center(child: Icon(Icons.music_note, size: 80, color: Color(0xFF0F172A))),
        ),
        const SizedBox(height: 16),
        const Text('POKER FACE - Ultra Slowed', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
        const SizedBox(height: 4),
        const Text('Lady Gaga, slowed.club', style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
      ],
    );
  }

  Widget _buildMobileFallback() {
    return ListView(
      padding: EdgeInsets.zero,
      children: const [
        LiquidHeroHeader(),
        DenseTrackTable(),
      ],
    );
  }

  Widget _buildMobileBottomNav() {
    return Container(
      height: 64,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.50),
        border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.80))),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          Icon(Icons.home, color: Color(0xFF0F172A)),
          Icon(Icons.search, color: Color(0xFF64748B)),
          Icon(Icons.library_music_outlined, color: Color(0xFF64748B)),
        ],
      ),
    );
  }
}
`,
  },
  {
    name: 'dense_track_table.dart',
    description: 'High-density tracklist table featuring elevated glossy glass slabs for active rows, white specular edge lighting, hover states, and animated soundbars.',
    code: `import 'package:flutter/material.dart';
import 'placeholder_artwork.dart';

/// Compact track row data model
class TrackItem {
  final int number;
  final String title;
  final String artist;
  final String album;
  final String dateAdded;
  final String duration;
  final String source;
  final bool isLiked;
  final bool isPlaying;

  const TrackItem({
    required this.number,
    required this.title,
    required this.artist,
    required this.album,
    required this.dateAdded,
    required this.duration,
    required this.source,
    this.isLiked = false,
    this.isPlaying = false,
  });
}

/// High-Density Tracklist Table executing the iOS Liquid White Glass visual spec.
///
/// Features:
/// - Active track elevated as a glossy glass slab (Colors.white.withValues(alpha: 0.14))
/// - White specular rim highlights and inner top reflection
/// - Swapping # index to play icon on hover
/// - Minimal audio source badges (YT, SC, FLAC, MQA)
class DenseTrackTable extends StatefulWidget {
  const DenseTrackTable({super.key});

  @override
  State<DenseTrackTable> createState() => _DenseTrackTableState();
}

class _DenseTrackTableState extends State<DenseTrackTable> {
  int _activeTrackIndex = 6;
  int? _hoveredIndex;

  final List<TrackItem> _tracks = const [
    TrackItem(number: 1, title: 'ЯМАЙКА (Ultra Slowed)', artist: 'Guf, slowed.club', album: 'Ultra Slowed Vol. 1', dateAdded: '3 days ago', duration: '3:45', source: 'YT'),
    TrackItem(number: 2, title: 'DESIRE (Slowed + Reverb)', artist: 'Hucci', album: 'Desire EP', dateAdded: '1 week ago', duration: '4:12', source: 'SC'),
    TrackItem(number: 3, title: 'After Dark', artist: 'Mr.Kitty', album: 'Time', dateAdded: '2 weeks ago', duration: '4:17', source: 'FLAC', isLiked: true),
    TrackItem(number: 4, title: 'Weightless', artist: 'Marconi Union', album: 'Ambient Transmissions', dateAdded: '3 weeks ago', duration: '8:08', source: 'Master'),
    TrackItem(number: 5, title: 'Cola (Slowed Down)', artist: 'CamelPhat, Elderbrook', album: 'Defected Sessions', dateAdded: '1 month ago', duration: '4:55', source: 'YT'),
    TrackItem(number: 6, title: 'MILITANTUM', artist: 'DVRST, slowed.club', album: 'Drift Phonk Classics', dateAdded: '1 month ago', duration: '2:14', source: 'SC'),
    TrackItem(number: 7, title: 'POKER FACE - Ultra Slowed', artist: 'Lady Gaga, slowed.club', album: 'Ultra Slowed Vol. 1', dateAdded: 'Oct 24, 2024', duration: '4:28', source: 'FLAC', isLiked: true, isPlaying: true),
    TrackItem(number: 8, title: 'luxury - Slowed + Reverb', artist: 'Azealia Banks, slowed.club', album: 'Broke with Expensive Taste', dateAdded: 'Nov 12, 2024', duration: '3:40', source: 'YT'),
  ];

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 8.0),
      child: Column(
        children: [
          // Table Headers (Uppercase Muted Silver #6B7280)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
            child: Row(
              children: [
                const SizedBox(
                  width: 32,
                  child: Text(
                    '#',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF6B7280), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1),
                  ),
                ),
                const SizedBox(width: 16),
                const Expanded(
                  flex: 5,
                  child: Text(
                    'TITLE',
                    style: TextStyle(color: Color(0xFF6B7280), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1),
                  ),
                ),
                const Expanded(
                  flex: 3,
                  child: Text(
                    'ALBUM',
                    style: TextStyle(color: Color(0xFF6B7280), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1),
                  ),
                ),
                const Expanded(
                  flex: 2,
                  child: Text(
                    'DATE ADDED',
                    style: TextStyle(color: Color(0xFF6B7280), fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1),
                  ),
                ),
                const SizedBox(
                  width: 60,
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Icon(Icons.access_time, size: 14, color: Color(0xFF6B7280)),
                  ),
                ),
              ],
            ),
          ),
          const Divider(color: Colors.white10, height: 1),
          const SizedBox(height: 6),

          // Track Rows
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _tracks.length,
            itemBuilder: (context, index) {
              final track = _tracks[index];
              final isActive = index == _activeTrackIndex;
              final isHovered = index == _hoveredIndex;

              return MouseRegion(
                onEnter: (_) => setState(() => _hoveredIndex = index),
                onExit: (_) => setState(() => _hoveredIndex = null),
                child: GestureDetector(
                  onTap: () => setState(() => _activeTrackIndex = index),
                  child: Container(
                    height: 52,
                    margin: const EdgeInsets.only(bottom: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      // Active Track: Flat Colors.white.withValues(alpha: 0.10) with 1px specular white border
                      color: isActive
                          ? Colors.white.withValues(alpha: 0.10)
                          : isHovered
                              ? Colors.white.withValues(alpha: 0.06)
                              : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: isActive
                            ? Colors.white.withValues(alpha: 0.25)
                            : isHovered
                                ? Colors.white.withValues(alpha: 0.12)
                                : Colors.transparent,
                        width: 1.0,
                      ),
                      boxShadow: isActive
                          ? [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.25),
                                blurRadius: 14,
                                offset: const Offset(0, 4),
                              ),
                            ]
                          : null,
                    ),
                    child: Row(
                      children: [
                        // # / Play Button / Animated Soundbars
                        SizedBox(
                          width: 32,
                          child: Center(
                            child: isHovered
                                ? Icon(
                                    isActive ? Icons.pause : Icons.play_arrow,
                                    color: Colors.white,
                                    size: 16,
                                  )
                                : isActive
                                    ? _buildAnimatedSoundbars()
                                    : Text(
                                        '\${track.number}',
                                        style: const TextStyle(
                                          color: Color(0xFF9CA3AF),
                                          fontWeight: FontWeight.normal,
                                          fontSize: 13,
                                        ),
                                      ),
                          ),
                        ),
                        const SizedBox(width: 16),

                        // Artwork Thumbnail + Title + Artist
                        Expanded(
                          flex: 5,
                          child: Row(
                            children: [
                              const PlaceholderArtwork(
                                size: 38,
                                icon: Icons.music_note,
                                gradientColors: [Color(0xFF374151), Color(0xFF1F2937)],
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    // Pure White #FFFFFF Track Title
                                    Text(
                                      track.title,
                                      style: TextStyle(
                                        fontWeight: isActive ? FontWeight.bold : FontWeight.w600,
                                        color: const Color(0xFFFFFFFF),
                                        fontSize: 13,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    // Crisp Light Gray #9CA3AF Artist
                                    Text(
                                      track.artist,
                                      style: const TextStyle(
                                        color: Color(0xFF9CA3AF),
                                        fontSize: 11,
                                      ),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Album & Source Badge
                        Expanded(
                          flex: 3,
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  track.album,
                                  style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              _buildSourceBadge(track.source),
                              const SizedBox(width: 12),
                            ],
                          ),
                        ),

                        // Date Added (Crisp Light Gray #9CA3AF)
                        Expanded(
                          flex: 2,
                          child: Text(
                            track.dateAdded,
                            style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
                          ),
                        ),

                        // Duration & Heart Like
                        SizedBox(
                          width: 60,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            children: [
                              if (track.isLiked || isHovered)
                                Icon(
                                  track.isLiked ? Icons.favorite : Icons.favorite_border,
                                  color: track.isLiked ? Colors.white : const Color(0xFF9CA3AF),
                                  size: 15,
                                ),
                              const SizedBox(width: 8),
                              Text(
                                track.duration,
                                style: const TextStyle(color: Color(0xFF9CA3AF), fontSize: 12),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSourceBadge(String source) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
      ),
      child: Text(
        source,
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.85),
          fontSize: 9,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildAnimatedSoundbars() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Container(width: 2, height: 12, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(1))),
        const SizedBox(width: 2),
        Container(width: 2, height: 7, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.75), borderRadius: BorderRadius.circular(1))),
        const SizedBox(width: 2),
        Container(width: 2, height: 14, decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(1))),
      ],
    );
  }
}
`,
  },
  {
    name: 'liquid_hero_header.dart',
    description: 'Prominent collection banner featuring massive typography, frosted white glass overlay, luminous play button, and horizontal filter capsules.',
    code: `import 'dart:ui';
import 'package:flutter/material.dart';
import 'placeholder_artwork.dart';

/// Center Hero Header with prominent typography and horizontal filter capsules
/// sitting directly over the glowing violet/magenta liquid backdrop.
class LiquidHeroHeader extends StatelessWidget {
  const LiquidHeroHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.04),
        border: Border(
          bottom: BorderSide(
            color: Colors.white.withValues(alpha: 0.14),
            width: 1.0,
          ),
        ),
      ),
      padding: const EdgeInsets.fromLTRB(28, 32, 28, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Banner Area: Artwork Cover + Massive Typography
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Large Artwork with Specular Border
              Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.5),
                      blurRadius: 30,
                      offset: const Offset(0, 12),
                    ),
                  ],
                  border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
                ),
                child: const PlaceholderArtwork(
                  size: 152,
                  icon: Icons.favorite,
                  gradientColors: [Color(0xFF374151), Color(0xFF1F2937)],
                ),
              ),
              const SizedBox(width: 24),

              // Title & Metadata
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.08),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
                      ),
                      child: const Text(
                        'PLAYLIST',
                        style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2),
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Liked Songs',
                      style: TextStyle(
                        fontSize: 52,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFFFFFFFF),
                        letterSpacing: -1.5,
                        height: 1.0,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        CircleAvatar(
                          radius: 10,
                          backgroundColor: Colors.white.withValues(alpha: 0.15),
                          child: const Text('A', style: TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold)),
                        ),
                        const SizedBox(width: 8),
                        const Text('alex.stream', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 13)),
                        const Text(' • 71 songs • about 4 hr 32 min', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 13)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Action Controls Row
          Row(
            children: [
              // Glossy Pure White Circular Play Button
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.white.withValues(alpha: 0.35),
                      blurRadius: 18,
                      offset: const Offset(0, 4),
                    ),
                  ],
                  border: Border.all(color: Colors.white),
                ),
                child: const Icon(Icons.play_arrow, color: Colors.black, size: 28),
              ),
              const SizedBox(width: 18),
              const Icon(Icons.shuffle, color: Colors.white, size: 22),
              const SizedBox(width: 18),
              const Icon(Icons.arrow_circle_down, color: Color(0xFF9CA3AF), size: 22),
              const SizedBox(width: 18),
              const Icon(Icons.more_horiz, color: Color(0xFF9CA3AF), size: 22),
              const Spacer(),
              const Icon(Icons.search, color: Color(0xFF9CA3AF), size: 20),
              const SizedBox(width: 12),
              const Row(
                children: [
                  Text('Recently added', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 12)),
                  Icon(Icons.arrow_drop_down, color: Color(0xFF9CA3AF), size: 18),
                ],
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Horizontal Filter Pills as Frosted Capsules
          SizedBox(
            height: 32,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                _buildFilterPill('All', isSelected: true),
                _buildFilterPill('Dark'),
                _buildFilterPill('Fast'),
                _buildFilterPill('New Age'),
                _buildFilterPill('Rock'),
                _buildFilterPill('Sad'),
                _buildFilterPill('Beats'),
                _buildFilterPill('House'),
                _buildFilterPill('Ethereal'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterPill(String title, {bool isSelected = false}) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.18),
        ),
      ),
      child: Text(
        title,
        style: TextStyle(
          color: isSelected ? Colors.black : Colors.white.withValues(alpha: 0.85),
          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
          fontSize: 12,
        ),
      ),
    );
  }
}
`,
  },
  {
    name: 'dock_player_bar.dart',
    description: 'Edge-to-edge persistent bottom player bar (88px) in translucent white frosted glass with timeline scrubber and audio utilities.',
    code: `import 'dart:ui';
import 'package:flutter/material.dart';
import 'placeholder_artwork.dart';

/// 88px Edge-to-Edge Desktop Persistent Dock Player Bar.
///
/// Implemented with iOS Liquid White Glass backdrop filter and specular top rim.
class DockPlayerBar extends StatelessWidget {
  const DockPlayerBar({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 88,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.05),
        border: Border(
          top: BorderSide(
            color: Colors.white.withValues(alpha: 0.14),
            width: 1.0,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 20,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: Row(
        children: [
          // 1. Left Track Snapshot
          const Row(
            children: [
              PlaceholderArtwork(
                size: 52,
                icon: Icons.music_note,
                gradientColors: [Color(0xFF374151), Color(0xFF1F2937)],
              ),
              SizedBox(width: 12),
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('POKER FACE - Ultra Slowed', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 13)),
                  Text('Lady Gaga, slowed.club', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 11)),
                ],
              ),
              SizedBox(width: 12),
              Icon(Icons.favorite, color: Colors.white, size: 18),
            ],
          ),
          const Spacer(),

          // 2. Center Transport Controls + Progress Scrubber
          Expanded(
            flex: 2,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.shuffle, color: Colors.white, size: 18),
                    const SizedBox(width: 20),
                    const Icon(Icons.skip_previous, color: Colors.white, size: 22),
                    const SizedBox(width: 18),
                    // Play Button
                    Container(
                      width: 36,
                      height: 36,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white,
                      ),
                      child: const Icon(Icons.pause, color: Colors.black, size: 20),
                    ),
                    const SizedBox(width: 18),
                    const Icon(Icons.skip_next, color: Colors.white, size: 22),
                    const SizedBox(width: 20),
                    const Icon(Icons.repeat, color: Color(0xFF9CA3AF), size: 18),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Text('3:42', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 11)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Container(
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.white12,
                          borderRadius: BorderRadius.circular(2),
                        ),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: Container(
                            width: 220,
                            height: 4,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text('4:28', style: TextStyle(color: Color(0xFF9CA3AF), fontSize: 11)),
                  ],
                ),
              ],
            ),
          ),
          const Spacer(),

          // 3. Right Volume & Tools
          Row(
            children: [
              const Icon(Icons.mic_none, color: Color(0xFF9CA3AF), size: 18),
              const SizedBox(width: 12),
              const Icon(Icons.queue_music, color: Color(0xFF9CA3AF), size: 18),
              const SizedBox(width: 12),
              const Icon(Icons.devices, color: Color(0xFF9CA3AF), size: 18),
              const SizedBox(width: 12),
              const Icon(Icons.volume_up, color: Color(0xFF9CA3AF), size: 18),
              const SizedBox(width: 8),
              Container(
                width: 80,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white12,
                  borderRadius: BorderRadius.circular(2),
                ),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: Container(
                    width: 60,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
`,
  },
  {
    name: 'placeholder_artwork.dart',
    description: 'Clean neutral vector placeholder artwork widget using smooth dual-color gradients with flat monochrome iconography.',
    code: `import 'package:flutter/material.dart';

/// Reusable vector placeholder artwork for songs, playlists, and artists.
///
/// Replaces external photo assets with clean mathematical dual-color gradients
/// and flat monochrome iconography.
class PlaceholderArtwork extends StatelessWidget {
  final double size;
  final IconData icon;
  final List<Color> gradientColors;
  final BorderRadius? borderRadius;
  final double? iconSize;

  const PlaceholderArtwork({
    super.key,
    required this.size,
    required this.icon,
    required this.gradientColors,
    this.borderRadius,
    this.iconSize,
  });

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(10);

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        borderRadius: radius,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradientColors,
        ),
        boxShadow: [
          BoxShadow(
            color: gradientColors.first.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Center(
        child: Icon(
          icon,
          size: iconSize ?? (size * 0.45),
          color: Colors.white.withValues(alpha: 0.95),
        ),
      ),
    );
  }
}
`,
  },
];
