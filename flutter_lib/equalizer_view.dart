import 'package:flutter/material.dart';
import 'liquid_glass.dart';
import 'theme.dart';

/// Floating Glass Modal Equalizer with vertical frosted sliders,
/// glowing neon thumb indicators, sound presets, and liquid visualizers.
class EqualizerSheet extends StatefulWidget {
  final VoidCallback? onClose;

  const EqualizerSheet({super.key, this.onClose});

  @override
  State<EqualizerSheet> createState() => _EqualizerSheetState();
}

class _EqualizerSheetState extends State<EqualizerSheet> {
  final List<String> _frequencies = [
    '32Hz',
    '64Hz',
    '125Hz',
    '250Hz',
    '500Hz',
    '1kHz',
    '2kHz',
    '4kHz',
    '8kHz',
    '16kHz',
  ];

  // dB values between -12.0 and +12.0
  List<double> _bandValues = [4.5, 6.0, 3.2, 0.0, -2.0, 1.5, 5.0, 7.5, 6.0, 4.0];
  String _selectedPreset = 'Electronic Synth';
  bool _spatialAudio = true;
  bool _bassEnhance = true;

  final Map<String, List<double>> _presets = {
    'Electronic Synth': [4.5, 6.0, 3.2, 0.0, -2.0, 1.5, 5.0, 7.5, 6.0, 4.0],
    'Deep Bass Boost': [8.0, 9.5, 6.0, 3.0, 1.0, 0.0, -1.0, 2.0, 3.0, 2.5],
    'Vocal Clarity': [-2.0, -1.0, 1.0, 3.5, 5.0, 6.0, 4.5, 3.0, 1.0, 0.0],
    'Acoustic Warmth': [3.0, 4.0, 2.5, 1.5, 2.0, 3.5, 3.0, 4.0, 5.0, 4.5],
    'Studio Flat': [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
  };

  void _applyPreset(String name) {
    if (_presets.containsKey(name)) {
      setState(() {
        _selectedPreset = name;
        _bandValues = List.from(_presets[name]!);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        constraints: const BoxConstraints(maxWidth: 680, maxHeight: 620),
        margin: const EdgeInsets.all(20),
        child: LiquidGlassContainer(
          borderRadius: BorderRadius.circular(32),
          glassOpacity: 0.16,
          blurSigmaX: 36,
          blurSigmaY: 36,
          borderGradient: LiquidGlassTheme.specularBorderGradient(
            opacityTop: 0.35,
            opacityBottom: 0.08,
          ),
          shadows: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.5),
              blurRadius: 40,
              offset: const Offset(0, 20),
            ),
            BoxShadow(
              color: LiquidGlassTheme.neonViolet.withValues(alpha: 0.25),
              blurRadius: 30,
              spreadRadius: -5,
            ),
          ],
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header with Title & Close Button
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LiquidGlassTheme.violetCyanGradient,
                          boxShadow: [
                            BoxShadow(
                              color: LiquidGlassTheme.neonViolet.withValues(alpha: 0.4),
                              blurRadius: 10,
                            ),
                          ],
                        ),
                        child: const Icon(Icons.graphic_eq_rounded, color: Colors.white, size: 20),
                      ),
                      const SizedBox(width: 12),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Parametric Liquid EQ',
                            style: TextStyle(
                              color: LiquidGlassTheme.textPrimary,
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            '10-Band Studio DSP Processing',
                            style: TextStyle(
                              color: LiquidGlassTheme.cyberCyan,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  if (widget.onClose != null)
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: LiquidGlassTheme.textSecondary),
                      onPressed: widget.onClose,
                    ),
                ],
              ),
              const SizedBox(height: 18),

              // Presets Pills
              SizedBox(
                height: 36,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: _presets.keys.map((preset) {
                    final isSelected = _selectedPreset == preset;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8.0),
                      child: GestureDetector(
                        onTap: () => _applyPreset(preset),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(18),
                            color: isSelected
                                ? LiquidGlassTheme.neonViolet.withValues(alpha: 0.3)
                                : Colors.white.withValues(alpha: 0.06),
                            border: Border.all(
                              color: isSelected
                                  ? LiquidGlassTheme.cyberCyan
                                  : Colors.white.withValues(alpha: 0.12),
                              width: 0.8,
                            ),
                          ),
                          child: Center(
                            child: Text(
                              preset,
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
              const SizedBox(height: 24),

              // Sliders Grid
              Expanded(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final itemWidth = (constraints.maxWidth / _frequencies.length);

                    return Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: List.generate(_frequencies.length, (index) {
                        final value = _bandValues[index];
                        final freq = _frequencies[index];

                        return SizedBox(
                          width: itemWidth,
                          child: Column(
                            children: [
                              // dB readout
                              Text(
                                '${value > 0 ? "+" : ""}${value.toStringAsFixed(1)}',
                                style: TextStyle(
                                  color: value.abs() > 0.1
                                      ? LiquidGlassTheme.cyberCyan
                                      : LiquidGlassTheme.textMuted,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 6),

                              // Vertical Frosted Slider Track
                              Expanded(
                                child: _buildVerticalSlider(
                                  value: value,
                                  onChanged: (newVal) {
                                    setState(() {
                                      _bandValues[index] = newVal;
                                      _selectedPreset = 'Custom';
                                    });
                                  },
                                ),
                              ),
                              const SizedBox(height: 6),

                              // Frequency label
                              Text(
                                freq,
                                style: const TextStyle(
                                  color: LiquidGlassTheme.textSecondary,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        );
                      }),
                    );
                  },
                ),
              ),

              const SizedBox(height: 16),

              // Bottom Toggles (Spatial Audio & Dynamic Bass Boost)
              Row(
                children: [
                  Expanded(
                    child: _buildToggleCard(
                      title: 'Spatial Liquid Soundstage',
                      subtitle: '3D Head-tracking acoustic simulation',
                      icon: Icons.spatial_audio_rounded,
                      isActive: _spatialAudio,
                      onToggle: () => setState(() => _spatialAudio = !_spatialAudio),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: _buildToggleCard(
                      title: 'Sub-Bass Resonance',
                      subtitle: 'Low-end psychoacoustic amplifier',
                      icon: Icons.surround_sound_rounded,
                      isActive: _bassEnhance,
                      onToggle: () => setState(() => _bassEnhance = !_bassEnhance),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildVerticalSlider({
    required double value,
    required ValueChanged<double> onChanged,
  }) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final height = constraints.maxHeight;
        // Normalized 0.0 (-12dB) to 1.0 (+12dB)
        final normalized = (value + 12.0) / 24.0;
        final thumbY = height * (1.0 - normalized);

        return GestureDetector(
          onVerticalDragUpdate: (details) {
            final dy = (details.localPosition.dy / height).clamp(0.0, 1.0);
            final newValue = ((1.0 - dy) * 24.0) - 12.0;
            onChanged(double.parse(newValue.toStringAsFixed(1)));
          },
          child: Container(
            width: 32,
            alignment: Alignment.center,
            color: Colors.transparent,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Frosted Groove Background
                Container(
                  width: 6,
                  height: height,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(3),
                    color: Colors.white.withValues(alpha: 0.08),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.12),
                      width: 0.5,
                    ),
                  ),
                ),

                // Active glowing fill from center (0dB is at 50% height)
                Positioned(
                  top: value >= 0 ? thumbY : height * 0.5,
                  bottom: value < 0 ? height - thumbY : height * 0.5,
                  child: Container(
                    width: 6,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(3),
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

                // Glowing Neon Thumb Indicator
                Positioned(
                  top: (thumbY - 10).clamp(0.0, height - 20),
                  child: Container(
                    width: 20,
                    height: 20,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: RadialGradient(
                        colors: [
                          Colors.white,
                          LiquidGlassTheme.cyberCyan,
                        ],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: LiquidGlassTheme.cyberCyan.withValues(alpha: 0.7),
                          blurRadius: 10,
                          spreadRadius: 2,
                        ),
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.4),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                      border: Border.all(
                        color: Colors.white,
                        width: 1.2,
                      ),
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

  Widget _buildToggleCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool isActive,
    required VoidCallback onToggle,
  }) {
    return GestureDetector(
      onTap: onToggle,
      child: LiquidGlassContainer(
        borderRadius: BorderRadius.circular(16),
        glassOpacity: isActive ? 0.14 : 0.06,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        borderGradient: isActive
            ? const LinearGradient(
                colors: [LiquidGlassTheme.cyberCyan, LiquidGlassTheme.neonViolet],
              )
            : null,
        child: Row(
          children: [
            Icon(
              icon,
              color: isActive ? LiquidGlassTheme.cyberCyan : LiquidGlassTheme.textMuted,
              size: 22,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      color: isActive ? Colors.white : LiquidGlassTheme.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: LiquidGlassTheme.textMuted,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
            Switch.adaptive(
              value: isActive,
              activeColor: LiquidGlassTheme.cyberCyan,
              onChanged: (_) => onToggle(),
            ),
          ],
        ),
      ),
    );
  }
}
