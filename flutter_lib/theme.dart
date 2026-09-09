import 'package:flutter/material.dart';

/// Design System Tokens for Ultra-Modern iOS Liquid Glass UI
/// Cross-platform support for Desktop (Windows/macOS/Linux) and Mobile (Android/iOS).
class LiquidGlassTheme {
  // Deep Moody Dark Canvas
  static const Color background = Color(0xFF08080B);
  static const Color surfaceDark = Color(0xFF0F0F14);
  static const Color surfaceElevated = Color(0xFF16161F);

  // Vibrancy Accents
  static const Color neonViolet = Color(0xFF8B5CF6);
  static const Color cyberCyan = Color(0xFF06B6D4);
  static const Color electricCoral = Color(0xFFF43F5E);
  static const Color solarAmber = Color(0xFFF59E0B);
  static const Color mintGlow = Color(0xFF10B981);

  // Text Colors
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);

  // Glass Opacities
  static const double glassSubtle = 0.05;
  static const double glassDefault = 0.08;
  static const double glassProminent = 0.14;
  static const double glassHighReflect = 0.22;

  // Specular Border Opacities (Hairline Highlight Gradients)
  static const double borderHighlightTop = 0.28;
  static const double borderHighlightBottom = 0.03;

  // Standard Blur Sigmas (GPU-friendly on Android)
  static const double blurLight = 12.0;
  static const double blurStandard = 24.0;
  static const double blurHeavy = 40.0;

  // Specular Border Linear Gradient for iOS Liquid Glass Edge
  static LinearGradient specularBorderGradient({
    double opacityTop = 0.25,
    double opacityBottom = 0.03,
  }) {
    return LinearGradient(
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
      colors: [
        Colors.white.withValues(alpha: opacityTop),
        Colors.white.withValues(alpha: opacityTop * 0.4),
        Colors.white.withValues(alpha: opacityBottom),
        Colors.white.withValues(alpha: opacityBottom * 0.2),
      ],
      stops: const [0.0, 0.35, 0.75, 1.0],
    );
  }

  // Accent Glow Gradients
  static const LinearGradient violetCyanGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [neonViolet, cyberCyan],
  );

  static const LinearGradient coralVioletGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [electricCoral, neonViolet],
  );

  // Typography
  static const TextStyle displayLarge = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w800,
    letterSpacing: -0.5,
    color: textPrimary,
  );

  static const TextStyle displayMedium = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.3,
    color: textPrimary,
  );

  static const TextStyle titleLarge = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
    color: textPrimary,
  );

  static const TextStyle bodyMedium = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: textSecondary,
    height: 1.5,
  );

  static const TextStyle caption = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: textMuted,
    letterSpacing: 0.2,
  );
}
