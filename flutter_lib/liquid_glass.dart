import 'dart:ui';
import 'package:flutter/material.dart';
import 'theme.dart';

/// Highly optimized, GPU-performant Liquid Glass Container for Flutter.
/// Implements real-time BackdropFilter, specular rim-light gradient border,
/// and subtle inner light depth for ultra-modern iOS glassmorphism.
class LiquidGlassContainer extends StatelessWidget {
  final Widget child;
  final double? width;
  final double? height;
  final double blurSigmaX;
  final double blurSigmaY;
  final BorderRadiusGeometry borderRadius;
  final Color? glassColor;
  final double glassOpacity;
  final double borderWidth;
  final Gradient? borderGradient;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final List<BoxShadow>? shadows;
  final Color? glowColor;
  final double glowRadius;
  final VoidCallback? onTap;
  final bool enableReflectionHighlight;

  const LiquidGlassContainer({
    super.key,
    required this.child,
    this.width,
    this.height,
    this.blurSigmaX = 24.0,
    this.blurSigmaY = 24.0,
    this.borderRadius = const BorderRadius.all(Radius.circular(20.0)),
    this.glassColor,
    this.glassOpacity = 0.08,
    this.borderWidth = 1.0,
    this.borderGradient,
    this.padding,
    this.margin,
    this.shadows,
    this.glowColor,
    this.glowRadius = 0.0,
    this.onTap,
    this.enableReflectionHighlight = true,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveBorderRadius = borderRadius.resolve(Directionality.of(context));
    
    // Outer shadow container
    Widget content = Container(
      width: width,
      height: height,
      margin: margin,
      decoration: BoxDecoration(
        borderRadius: effectiveBorderRadius,
        boxShadow: [
          if (glowColor != null && glowRadius > 0)
            BoxShadow(
              color: glowColor!.withValues(alpha: 0.25),
              blurRadius: glowRadius,
              spreadRadius: 1,
            ),
          ...?shadows,
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: effectiveBorderRadius,
        child: BackdropFilter(
          filter: ImageFilter.blur(
            sigmaX: blurSigmaX,
            sigmaY: blurSigmaY,
            tileMode: TileMode.clamp,
          ),
          child: CustomPaint(
            foregroundPainter: _SpecularBorderPainter(
              borderRadius: effectiveBorderRadius,
              borderWidth: borderWidth,
              gradient: borderGradient ?? LiquidGlassTheme.specularBorderGradient(),
            ),
            child: Container(
              padding: padding,
              decoration: BoxDecoration(
                borderRadius: effectiveBorderRadius,
                // Multi-layered glass fill with subtle top-to-bottom translucent sheen
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    (glassColor ?? Colors.white).withValues(alpha: glassOpacity * 1.35),
                    (glassColor ?? Colors.white).withValues(alpha: glassOpacity * 0.7),
                  ],
                ),
              ),
              child: enableReflectionHighlight
                  ? Stack(
                      children: [
                        // Subtle specular diagonal wash for liquid depth
                        Positioned.fill(
                          child: IgnorePointer(
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                borderRadius: effectiveBorderRadius,
                                gradient: LinearGradient(
                                  begin: const Alignment(-1.0, -1.0),
                                  end: const Alignment(1.0, 1.0),
                                  colors: [
                                    Colors.white.withValues(alpha: 0.05),
                                    Colors.transparent,
                                    Colors.white.withValues(alpha: 0.02),
                                  ],
                                  stops: const [0.0, 0.45, 1.0],
                                ),
                              ),
                            ),
                          ),
                        ),
                        child,
                      ],
                    )
                  : child,
            ),
          ),
        ),
      ),
    );

    if (onTap != null) {
      return RepaintBoundary(
        child: Material(
          color: Colors.transparent,
          borderRadius: effectiveBorderRadius,
          child: InkWell(
            borderRadius: effectiveBorderRadius,
            splashColor: Colors.white.withValues(alpha: 0.08),
            highlightColor: Colors.white.withValues(alpha: 0.04),
            onTap: onTap,
            child: content,
          ),
        ),
      );
    }

    return RepaintBoundary(child: content);
  }
}

/// Specialized Liquid Glass Card with gentle hover animation capabilities
class LiquidGlassCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final VoidCallback? onTap;
  final Color? glowColor;

  const LiquidGlassCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16.0),
    this.radius = 20.0,
    this.onTap,
    this.glowColor,
  });

  @override
  Widget build(BuildContext context) {
    return LiquidGlassContainer(
      borderRadius: BorderRadius.circular(radius),
      padding: padding,
      glowColor: glowColor,
      glowRadius: glowColor != null ? 18.0 : 0.0,
      onTap: onTap,
      child: child,
    );
  }
}

/// Precision Specular Highlight Border Painter for 0.5-1px hairline iOS glass edges
class _SpecularBorderPainter extends CustomPainter {
  final BorderRadius borderRadius;
  final double borderWidth;
  final Gradient gradient;

  _SpecularBorderPainter({
    required this.borderRadius,
    required this.borderWidth,
    required this.gradient,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final rrect = borderRadius.toRRect(rect);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth
      ..shader = gradient.createShader(rect);

    canvas.drawRRect(rrect.deflate(borderWidth / 2), paint);
  }

  @override
  bool shouldRepaint(covariant _SpecularBorderPainter oldDelegate) {
    return oldDelegate.borderRadius != borderRadius ||
        oldDelegate.borderWidth != borderWidth ||
        oldDelegate.gradient != gradient;
  }
}
