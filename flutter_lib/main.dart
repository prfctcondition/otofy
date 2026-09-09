import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'theme.dart';
import 'main_layout.dart';
import 'discover_view.dart';
import 'search_view.dart';
import 'library_view.dart';
import 'equalizer_view.dart';
import 'now_playing_modal.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const LiquidGlassMusicApp());
}

class LiquidGlassMusicApp extends StatelessWidget {
  const LiquidGlassMusicApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Aetheria - Liquid Glass Music',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: LiquidGlassTheme.background,
        colorScheme: const ColorScheme.dark(
          primary: LiquidGlassTheme.cyberCyan,
          secondary: LiquidGlassTheme.neonViolet,
          surface: LiquidGlassTheme.surfaceDark,
        ),
      ),
      home: const MainMusicShell(),
    );
  }
}

class MainMusicShell extends StatefulWidget {
  const MainMusicShell({super.key});

  @override
  State<MainMusicShell> createState() => _MainMusicShellState();
}

class _MainMusicShellState extends State<MainMusicShell> {
  int _selectedIndex = 0;
  bool _showNowPlaying = false;
  bool _showEqualizer = false;

  @override
  Widget build(BuildContext context) {
    Widget activeView;
    switch (_selectedIndex) {
      case 0:
        activeView = DiscoverView(
          onPlayTrack: () => setState(() => _showNowPlaying = true),
        );
        break;
      case 1:
        activeView = SearchView(
          onPlayTrack: () => setState(() => _showNowPlaying = true),
        );
        break;
      case 2:
      case 3:
      default:
        activeView = LibraryView(
          onPlayTrack: () => setState(() => _showNowPlaying = true),
        );
        break;
    }

    return Stack(
      children: [
        LiquidGlassMainLayout(
          currentScreen: activeView,
          selectedIndex: _selectedIndex,
          onIndexChanged: (idx) => setState(() => _selectedIndex = idx),
          onOpenNowPlaying: () => setState(() => _showNowPlaying = true),
          onOpenEqualizer: () => setState(() => _showEqualizer = true),
        ),

        // Fullscreen Expanded Now Playing Modal
        if (_showNowPlaying)
          Positioned.fill(
            child: NowPlayingModal(
              onClose: () => setState(() => _showNowPlaying = false),
              onOpenEqualizer: () => setState(() => _showEqualizer = true),
            ),
          ),

        // Floating Glass Equalizer Sheet
        if (_showEqualizer)
          Positioned.fill(
            child: Container(
              color: Colors.black.withValues(alpha: 0.6),
              child: EqualizerSheet(
                onClose: () => setState(() => _showEqualizer = false),
              ),
            ),
          ),
      ],
    );
  }
}
